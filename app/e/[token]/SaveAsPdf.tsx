'use client';

/**
 * A document, not a photograph of a web page.
 *
 * The first version drew the screen onto a canvas and wrapped it in a PDF,
 * which is why it came out looking like a screenshot of software: the
 * accordion toggles rendered as navy blobs, strikethrough came out as a rule
 * floating above the number rather than through it, and the file carried an
 * "Accept this estimate" button and a "Send me a note" link — neither of which
 * does anything in a file. Content repeated across the page break because the
 * image was sliced rather than laid out.
 *
 * A proposal is a simple document. It is drawn here with real type, so the
 * text is selectable and searchable, the page breaks fall between things
 * rather than through them, and nothing that only makes sense on a screen
 * comes along for the ride.
 */

import { useState } from 'react';

export interface PdfLine {
  title: string;
  detail?: string;
  qty: string;
  amount: string;
  wasAmount?: string;
}

export interface PdfDoc {
  org: string;
  preparedBy?: string | null;
  reference: string;
  title: string;
  preparedFor?: string | null;
  lines: PdfLine[];
  totals: Array<{ label: string; value: string }>;
  note?: string | null;
  included: string[];
  sections: Array<{ heading: string; body: string }>;
}

export function SaveAsPdf({ accent, name = 'Document', doc }: { accent: string; name?: string; doc: PdfDoc }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    setBusy(true);
    setError('');
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });

      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();
      const M = 56;                       // Margin, roughly 20mm.
      const RIGHT = W - M;
      let y = M;

      const ink = [17, 17, 17] as const;
      const grey = [110, 110, 110] as const;
      const faint = [165, 165, 165] as const;
      const rule = [225, 225, 222] as const;

      /* A page break falls between things, never through one. */
      const room = (need: number) => {
        if (y + need > H - M) {
          pdf.addPage();
          y = M;
        }
      };

      const text = (
        s: string,
        x: number,
        size: number,
        opts: { bold?: boolean; color?: readonly number[]; align?: 'left' | 'right'; maxWidth?: number } = {}
      ) => {
        pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal');
        pdf.setFontSize(size);
        const c = opts.color ?? ink;
        pdf.setTextColor(c[0], c[1], c[2]);
        const lines = opts.maxWidth ? pdf.splitTextToSize(s, opts.maxWidth) : [s];
        for (const ln of lines) {
          pdf.text(ln, x, y, { align: opts.align ?? 'left' });
          y += size * 1.45;
        }
        return lines.length;
      };

      const hr = (weight = 0.5, color: readonly number[] = rule) => {
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(weight);
        pdf.line(M, y, RIGHT, y);
        y += 1;
      };

      // ---- Header -------------------------------------------------------
      /*
        Two columns, each drawn from its own top.

        The first version drew the left column, then rewound y to put
        "Prepared by" on the right, which put it wherever the title happened to
        have got to. A two-line title landed underneath it and the two collided.

        Each column is measured from the same starting line and neither reaches
        into the other's width.
      */
      const headTop = y;
      const rightW = 150;
      const leftW = RIGHT - M - rightW - 24;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(ink[0], ink[1], ink[2]);
      pdf.text(doc.reference, RIGHT, headTop, { align: 'right' });
      if (doc.preparedBy) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);
        pdf.setTextColor(grey[0], grey[1], grey[2]);
        pdf.text(`Prepared by ${doc.preparedBy}`, RIGHT, headTop + 16, { align: 'right' });
      }

      y = headTop;
      text(doc.org.toUpperCase(), M, 9.5, { bold: true });
      y += 2;
      text(doc.title, M, 18, { bold: true, maxWidth: leftW });
      if (doc.preparedFor) {
        y += 2;
        text(`Prepared for ${doc.preparedFor}`, M, 10.5, { color: grey });
      }
      y = Math.max(y, headTop + 34);

      y += 18;
      hr();
      y += 18;

      // ---- Lines --------------------------------------------------------
      const qtyX = RIGHT - 150;
      text('WORK', M, 8.5, { color: faint, bold: true });
      y -= 8.5 * 1.45;
      pdf.setFontSize(8.5);
      pdf.setTextColor(faint[0], faint[1], faint[2]);
      pdf.text('QTY', qtyX, y, { align: 'right' });
      pdf.text('AMOUNT', RIGHT, y, { align: 'right' });
      y += 8.5 * 1.45 + 6;
      hr();
      y += 12;

      for (const l of doc.lines) {
        room(52);
        const top = y;
        text(l.title, M, 11, { bold: true, maxWidth: qtyX - M - 24 });
        if (l.detail) text(l.detail, M, 9.5, { color: grey, maxWidth: qtyX - M - 24 });
        const bottom = y;

        // Qty and amount sit against the first line of the row.
        y = top;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(grey[0], grey[1], grey[2]);
        pdf.text(l.qty, qtyX, y, { align: 'right' });

        let amtX = RIGHT;
        pdf.setFontSize(10.5);
        pdf.setTextColor(ink[0], ink[1], ink[2]);
        pdf.text(l.amount, amtX, y, { align: 'right' });

        /*
          A real strikethrough.

          The screenshot version drew the rule above the digits, which read as
          a stray line rather than a crossed-out price. Here it is measured and
          drawn through the middle of the text.
        */
        if (l.wasAmount) {
          amtX -= pdf.getTextWidth(l.amount) + 10;
          pdf.setFontSize(9.5);
          pdf.setTextColor(faint[0], faint[1], faint[2]);
          const w = pdf.getTextWidth(l.wasAmount);
          pdf.text(l.wasAmount, amtX, y, { align: 'right' });
          pdf.setDrawColor(faint[0], faint[1], faint[2]);
          pdf.setLineWidth(0.7);
          pdf.line(amtX - w, y - 3, amtX, y - 3);
        }

        y = Math.max(bottom, top + 16) + 12;
        hr(0.4, [240, 240, 237]);
        y += 14;
      }

      // ---- Totals -------------------------------------------------------
      room(80);
      y += 2;
      hr(1.2, [26, 26, 26]);
      y += 20;
      let tx = RIGHT;
      for (const t of [...doc.totals].reverse()) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.setTextColor(ink[0], ink[1], ink[2]);
        const vw = pdf.getTextWidth(t.value);
        pdf.text(t.value, tx, y + 16, { align: 'right' });
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(grey[0], grey[1], grey[2]);
        const lw = pdf.getTextWidth(t.label.toUpperCase());
        pdf.text(t.label.toUpperCase(), tx, y, { align: 'right' });
        tx -= Math.max(vw, lw) + 38;
      }
      y += 38;

      if (doc.note) {
        y += 6;
        room(50);
        text(doc.note, M, 10.5, { color: [51, 51, 51], maxWidth: RIGHT - M });
      }

      // ---- What you get -------------------------------------------------
      if (doc.included.length) {
        y += 18;
        room(60);
        room(12.5 * 1.45 + 30);
        text('What you get', M, 12.5, { bold: true });
        y += 6;
        doc.included.forEach((line, i) => {
          room(26);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(faint[0], faint[1], faint[2]);
          pdf.text(String(i + 1).padStart(2, '0'), M, y);
          const before = y;
          text(line, M + 24, 10.5, { maxWidth: RIGHT - M - 24 });
          y = Math.max(y, before) + 4;
        });
      }

      // ---- The terms, open ----------------------------------------------
      /*
        A heading never sits alone at the foot of a page.

        "What this costs" ended page one with its answer on page two, which is
        the one thing typesetting has always refused to do. The space needed is
        measured before the heading is drawn: the heading plus its first
        paragraph, or the break comes first.
      */
      for (const sec of doc.sections) {
        const paras = sec.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
        const firstHeight = paras.length
          ? pdf.splitTextToSize(paras[0].replace(/\n/g, ' '), RIGHT - M).length * 10.5 * 1.45
          : 0;

        y += 20;
        room(12.5 * 1.45 + firstHeight + 14);
        text(sec.heading, M, 12.5, { bold: true });
        y += 3;
        for (const para of paras) {
          room(28);
          text(para.replace(/\n/g, ' '), M, 10.5, { color: [60, 60, 60], maxWidth: RIGHT - M });
          y += 5;
        }
      }

      // ---- Foot ----------------------------------------------------------
      const pages = pdf.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        pdf.setPage(p);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(faint[0], faint[1], faint[2]);
        pdf.text(`${doc.org} · ${doc.reference}`, M, H - 28);
        pdf.text(`${p} of ${pages}`, RIGHT, H - 28, { align: 'right' });
      }

      /*
        The ampersand survives.

        The old sanitiser stripped anything that was not a word character, so
        CALO&CO came out as CALOCO in the filename of a document whose whole
        job is carrying the name.
      */
      const safe = name.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
      pdf.save(`${safe || 'Document'}.pdf`);
    } catch (e) {
      setError((e as Error).message || 'That did not download.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-print-hide style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {error && <span style={{ fontSize: 12.5, color: '#b91c1c' }}>{error}</span>}
      <button
        onClick={download}
        disabled={busy}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'transparent', border: `1px solid ${accent}33`, color: accent,
          borderRadius: 999, padding: '8px 15px', fontSize: 13.5, fontWeight: 500,
          cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8 1.8v8.4" /><path d="M4.6 7l3.4 3.2L11.4 7" />
          <path d="M2.4 12.1v1.1a1 1 0 0 0 1 1h9.2a1 1 0 0 0 1-1v-1.1" />
        </svg>
        {busy ? 'Building it…' : 'Download as PDF'}
      </button>
    </div>
  );
}
