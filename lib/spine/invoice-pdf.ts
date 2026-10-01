/**
 * The invoice, drawn.
 *
 * Split out of the button so the exact code that ships can be run outside a
 * browser and the file it makes can be read back and checked. A renderer that
 * can only be exercised by clicking is a renderer nobody checks twice.
 *
 * See `app/i/[token]/InvoicePdf.tsx` for why an invoice has its own renderer
 * and for the type rules this follows.
 */

import type { jsPDF } from 'jspdf';

export interface PdfInvoiceLine {
  name: string;
  note?: string | null;
  /** "1.0" - blank for anything not charged by the hour. */
  hours?: string | null;
  standard?: string | null;
  /** What they pay. "Waived" is a value here, not a flag. */
  yours: string;
  /** A price struck through immediately before `yours`, where one was dropped. */
  struck?: string | null;
}

export interface PdfInvoice {
  studioName: string;
  studioLogo?: string | null;
  email?: string | null;
  phone?: string | null;
  number: string;
  billedTo: string[];
  issued: string;
  due: string;
  dueNote?: string | null;
  rate?: { yours: string; standard?: string | null; label?: string | null } | null;
  months: Array<{ heading: string; lines: PdfInvoiceLine[] }>;
  totals: { standard?: string | null; savings?: string | null; due: string };
  pay: Array<{ label: string; value: string }>;
  questionsEmail?: string | null;
  questionsPhone?: string | null;
  thanksName?: string | null;
}

/** A logo already loaded, so the drawing stays synchronous and testable. */
export interface LoadedLogo { data: string; w: number; h: number }

export function drawInvoice(pdf: jsPDF, doc: PdfInvoice, logo?: LoadedLogo | null) {
      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();
      const M = 54;
      const RIGHT = W - M;
      const ink = [17, 17, 17] as const;
      let y = M;

      const room = (need: number) => {
        if (y + need > H - M) { pdf.addPage(); y = M; }
      };

      const set = (size: number, bold = false) => {
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setFontSize(size);
        pdf.setTextColor(ink[0], ink[1], ink[2]);
      };

      /*
        No orphan.

        jsPDF wraps on width alone, so a paragraph whose last line is one word
        is the common case rather than the rare one. Pulling the previous word
        down with it costs a little ragged edge and buys a line that reads.
      */
      const wrap = (s: string, maxWidth: number): string[] => {
        const lines = pdf.splitTextToSize(s, maxWidth) as string[];
        if (lines.length > 1) {
          const last = lines[lines.length - 1].trim();
          if (last && !last.includes(' ')) {
            const prev = lines[lines.length - 2].trim().split(' ');
            if (prev.length > 1) {
              lines[lines.length - 1] = `${prev.pop()} ${last}`;
              lines[lines.length - 2] = prev.join(' ');
            }
          }
        }
        return lines;
      };

      const say = (
        s: string,
        x: number,
        size: number,
        o: { bold?: boolean; align?: 'left' | 'right'; maxWidth?: number; lead?: number } = {}
      ) => {
        set(size, o.bold);
        const lead = o.lead ?? size * 1.32;
        for (const ln of o.maxWidth ? wrap(s, o.maxWidth) : [s]) {
          pdf.text(ln, x, y, { align: o.align ?? 'left' });
          y += lead;
        }
      };

      /** Text with a rule through it, at the baseline the text sits on. */
      const struck = (s: string, x: number, size: number, align: 'left' | 'right' = 'left') => {
        set(size);
        pdf.text(s, x, y, { align });
        const w = pdf.getTextWidth(s);
        const x0 = align === 'right' ? x - w : x;
        pdf.setDrawColor(ink[0], ink[1], ink[2]);
        pdf.setLineWidth(0.6);
        pdf.line(x0, y - size * 0.3, x0 + w, y - size * 0.3);
        return w;
      };

      const hr = () => {
        pdf.setDrawColor(ink[0], ink[1], ink[2]);
        pdf.setLineWidth(0.4);
        pdf.line(M, y, RIGHT, y);
        y += 1;
      };

      /* Columns. Description runs to the first number. */
      const C_HOURS = RIGHT - 232;
      const C_STD = RIGHT - 118;
      const C_YOURS = RIGHT;
      const DESC_W = C_HOURS - M - 54;

      // ---- Header -------------------------------------------------------
      const top = y;
      set(13, true);
      pdf.text('INVOICE', RIGHT, top, { align: 'right' });
      set(10.5);
      pdf.text(doc.number, RIGHT, top + 16, { align: 'right' });

      y = top;
      let drewLogo = false;
      {
        const got = logo ?? null;
        if (got) {
          const h = 26;
          const w = Math.min(150, (got.w / got.h) * h);
          try {
            pdf.addImage(got.data, 'PNG', M, y - 10, w, h);
            drewLogo = true;
            y += h - 4;
          } catch { /* falls through to the name */ }
        }
      }
      if (!drewLogo) say(doc.studioName, M, 13, { bold: true });

      const contact = [doc.email, doc.phone].filter(Boolean).join('  ·  ');
      if (contact) say(contact, M, 9.5);

      y = Math.max(y, top + 40);
      y += 10;
      hr();
      y += 16;

      // ---- Billed to / Issued / Due --------------------------------------
      const colTop = y;
      const c2 = M + 210;
      const c3 = M + 340;

      say('BILLED TO', M, 8);
      for (const l of doc.billedTo.filter(Boolean)) say(l, M, 10.5);
      const leftEnd = y;

      y = colTop;
      say('ISSUED', c2, 8);
      say(doc.issued, c2, 10.5);
      const midEnd = y;

      y = colTop;
      say('DUE', c3, 8);
      if (doc.dueNote) {
        struck(doc.due, c3, 10.5);
        y += 10.5 * 1.32;
        say(doc.dueNote, c3, 10.5, { maxWidth: RIGHT - c3 });
      } else {
        say(doc.due, c3, 10.5);
      }

      y = Math.max(leftEnd, midEnd, y);

      // ---- The rate ------------------------------------------------------
      if (doc.rate) {
        y += 14;
        set(10.5);
        const lead = `Rate ${doc.rate.yours} an hour`;
        pdf.text(lead, M, y);
        let x = M + pdf.getTextWidth(lead) + 8;
        if (doc.rate.standard) {
          x += struck(doc.rate.standard, x, 10.5) + 10;
        }
        if (doc.rate.label) {
          set(10.5);
          pdf.text(doc.rate.label, x, y);
        }
        y += 10.5 * 1.32;
      }

      y += 10;

      // ---- Column headings ------------------------------------------------
      hr();
      y += 12;
      set(8);
      pdf.text('DESCRIPTION', M, y);
      pdf.text('HOURS', C_HOURS, y, { align: 'right' });
      pdf.text('STANDARD', C_STD, y, { align: 'right' });
      pdf.text('YOUR PRICE', C_YOURS, y, { align: 'right' });
      y += 10;
      hr();
      y += 14;

      // ---- Lines, by month -------------------------------------------------
      for (const month of doc.months) {
        room(46);
        say(month.heading.toUpperCase(), M, 8);
        y += 2;

        for (const l of month.lines) {
          room(34);
          const rowTop = y;

          say(l.name, M, 10.5, { bold: true, maxWidth: DESC_W });
          if (l.note) say(l.note, M, 9.5, { maxWidth: DESC_W });
          const descEnd = y;

          /* The numbers sit on the line item's own baseline, not the note's. */
          y = rowTop;
          set(10.5);
          if (l.hours) pdf.text(l.hours, C_HOURS, y, { align: 'right' });
          if (l.standard) pdf.text(l.standard, C_STD, y, { align: 'right' });
          if (l.struck) {
            const w = pdf.getTextWidth(l.yours);
            struck(l.struck, C_YOURS - w - 8, 10.5, 'right');
            set(10.5);
            pdf.text(l.yours, C_YOURS, y, { align: 'right' });
          } else {
            set(10.5);
            pdf.text(l.yours, C_YOURS, y, { align: 'right' });
          }

          y = Math.max(descEnd, rowTop + 10.5 * 1.32) + 6;
        }
        y += 4;
      }

      // ---- Totals ----------------------------------------------------------
      room(84);
      y += 2;
      hr();
      y += 14;

      const totalRow = (label: string, value: string, o: { strike?: boolean; bold?: boolean } = {}) => {
        set(10.5, o.bold);
        pdf.text(label, C_STD - 90, y, { align: 'left' });
        if (o.strike) struck(value, C_YOURS, 10.5, 'right');
        else { set(10.5, o.bold); pdf.text(value, C_YOURS, y, { align: 'right' }); }
        y += 10.5 * 1.5;
      };

      if (doc.totals.standard) totalRow('Standard price', doc.totals.standard, { strike: true });
      if (doc.totals.savings) totalRow('Your savings', doc.totals.savings);
      totalRow('Total due', doc.totals.due, { bold: true });

      // ---- Footer -----------------------------------------------------------
      y += 8;
      room(96);
      hr();
      y += 14;

      const footTop = y;
      say('HOW TO PAY', M, 8);
      for (const p of doc.pay) say(`${p.label}: ${p.value}`, M, 10.5);
      const payEnd = y;

      y = footTop;
      const qx = M + 260;
      say('QUESTIONS', qx, 8);
      const how = doc.questionsEmail && doc.questionsPhone
        ? `Reply to ${doc.questionsEmail} or call ${doc.questionsPhone}.`
        : doc.questionsEmail
          ? `Reply to ${doc.questionsEmail}.`
          : doc.questionsPhone
            ? `Call ${doc.questionsPhone}.`
            : '';
      if (how) say(how, qx, 10.5, { maxWidth: RIGHT - qx });

      y = Math.max(payEnd, y) + 18;
      if (doc.thanksName) say(`Thanks ${doc.thanksName}!`, M, 10.5);

}
