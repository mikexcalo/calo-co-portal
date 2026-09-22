'use client';

/**
 * Download as PDF. A file, in Downloads, no dialog.
 *
 * This used to call window.print(), which opens the printer sheet and asks
 * somebody to choose "Save as PDF" from a menu. That is the browser's PDF
 * writer, so it produced a correct file, and it made every download a
 * three-step errand through a dialog nobody asked for.
 *
 * The page is already laid out and already prints correctly, so it is drawn to
 * a canvas and written into a PDF at the same proportions. What lands in
 * Downloads is the document on screen.
 *
 * THE TRADE-OFF, STATED
 *
 * Text in the file is drawn rather than selected: you cannot highlight a line
 * of it or search inside it. For a proposal somebody reads, signs and files
 * that is a fair price for a one-press download. The version with selectable
 * text means laying the whole document out a second time in a PDF library, and
 * two layouts of the same document drift apart the first time anybody edits
 * one of them.
 */

import { useState } from 'react';

export function SaveAsPdf({ accent, name = 'Document' }: { accent: string; name?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    setBusy(true);
    setError('');
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const page = document.querySelector('[data-document]') as HTMLElement | null;
      if (!page) throw new Error('Could not find the document on the page.');

      /*
        Unfold everything first.

        A PDF cannot be clicked, so anything collapsed on screen is simply
        absent from the file. The terms were four headings with a plus beside
        them and nothing underneath.
      */
      window.dispatchEvent(new Event('calo:expand-all'));
      await new Promise((r) => setTimeout(r, 120));

      const canvas = await html2canvas(page, {
        scale: 2,          // Legible when somebody zooms in or prints it.
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: page.scrollWidth,
      });

      window.dispatchEvent(new Event('calo:collapse-all'));

      const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Fit the width, then walk down the image a page at a time so a long
      // proposal becomes several pages rather than one squashed one.
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const img = canvas.toDataURL('image/jpeg', 0.92);

      /*
        A white page under every slice.

        Pages after the first were drawn onto whatever jsPDF had left there,
        which showed as dark bands above and below the content. Each page gets
        its own white ground before the image lands on it.
      */
      let offset = 0;
      let first = true;
      while (offset < imgH - 1) {
        if (!first) pdf.addPage();
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageW, pageH, 'F');
        pdf.addImage(img, 'JPEG', 0, -offset, imgW, imgH);
        offset += pageH;
        first = false;
      }

      pdf.save(`${name.replace(/[^\w\- ]+/g, '').trim() || 'Document'}.pdf`);
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
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          background: 'transparent',
          border: `1px solid ${accent}33`,
          color: accent,
          borderRadius: 999,
          padding: '8px 15px',
          fontSize: 13.5,
          fontWeight: 500,
          cursor: busy ? 'default' : 'pointer',
          fontFamily: 'inherit',
          opacity: busy ? 0.6 : 1,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8 1.8v8.4" />
          <path d="M4.6 7l3.4 3.2L11.4 7" />
          <path d="M2.4 12.1v1.1a1 1 0 0 0 1 1h9.2a1 1 0 0 0 1-1v-1.1" />
        </svg>
        {busy ? 'Building it…' : 'Download as PDF'}
      </button>
    </div>
  );
}
