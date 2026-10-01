'use client';

/**
 * The invoice as a document, not a print of the page it is shown on.
 *
 * WHY IT IS NOT THE SHARED RENDERER
 *
 * `SaveAsPdf` draws a proposal: a title, a run of described lines, a total.
 * An invoice has a shape of its own - a rate line with two numbers in it, work
 * grouped by the month it happened in, four columns, prices struck through
 * where something was let off, and a savings line that only means anything
 * next to the standard price above it. Bending one renderer around both would
 * have made every change to either risky to the other.
 *
 * WHY IT IS DRAWN RATHER THAN PRINTED
 *
 * Printing the page gave three pages for a two-line invoice, with the sticky
 * "How to pay" bar reprinted on each one and a "Download as PDF" button inside
 * the file. A document has none of that: the page breaks fall between things,
 * the type is real type, and nothing that only works on a screen comes along.
 *
 * THE TYPE RULES, WHICH ARE THE BRIEF
 *
 * One font. No grey - everything a person is meant to read is black, and the
 * things that would have been grey are instead smaller or set in caps. Bold is
 * spent on three things only: the word INVOICE, each line item's name, and the
 * total due. Everything else is regular, which is what makes those three carry.
 *
 * A single word is never left alone on the last line of a wrapped paragraph.
 */

import { useState } from 'react';
import { drawInvoice, type PdfInvoice, type LoadedLogo } from '@/lib/spine/invoice-pdf';

export type { PdfInvoice, PdfInvoiceLine } from '@/lib/spine/invoice-pdf';

/** A logo as a data URL, or null if it will not come. */
async function logoData(url: string): Promise<LoadedLogo | null> {
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = no;
      r.readAsDataURL(blob);
    });
    const size = await new Promise<{ w: number; h: number }>((ok) => {
      const img = new Image();
      img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => ok({ w: 0, h: 0 });
      img.src = data;
    });
    if (!size.w || !size.h) return null;
    return { data, w: size.w, h: size.h };
  } catch {
    return null;
  }
}

export function InvoicePdf({ name, doc }: { name: string; doc: PdfInvoice }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    setBusy(true);
    setError('');
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });

      let logo = null;
      if (doc.studioLogo) logo = await logoData(doc.studioLogo);
      drawInvoice(pdf, doc, logo);

      pdf.save(`${name}.pdf`);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? `The file could not be built. ${e.message}`
          : 'The file could not be built. Nothing was sent and nothing changed.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <button
        onClick={download}
        disabled={busy}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'transparent', border: '1px solid #D8D8D4',
          borderRadius: 999, padding: '9px 15px', fontSize: 14,
          color: '#111', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8 2v8" /><path d="M4.6 7.1 8 10.5l3.4-3.4" /><path d="M2.6 13.4h10.8" />
        </svg>
        {busy ? 'Building it…' : 'Download as PDF'}
      </button>
      {error && <span style={{ fontSize: 12.5, color: '#B42318', maxWidth: 260 }}>{error}</span>}
    </div>
  );
}
