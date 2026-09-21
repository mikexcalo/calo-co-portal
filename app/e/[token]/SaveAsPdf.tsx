'use client';

/**
 * Save this proposal as a PDF.
 *
 * Mike asked for a PDF he and his clients can email around. This prints the
 * page, which every browser turns into a real PDF through its own Save as PDF
 * destination — no renderer on the server, no second copy of the document that
 * can drift from the one on screen, and nothing to keep in step when the
 * layout changes. What you print is exactly what the client is looking at.
 *
 * The print rules live in globals.css so they apply whether the button is
 * pressed or somebody hits Cmd-P themselves.
 */

export function SaveAsPdf({ accent }: { accent: string }) {
  return (
    <button
      onClick={() => window.print()}
      data-print-hide
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        background: 'transparent',
        border: `1px solid ${accent}33`,
        color: accent,
        borderRadius: 7,
        padding: '8px 13px',
        fontSize: 13.5,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8 1.8v8.4" />
        <path d="M4.6 7l3.4 3.2L11.4 7" />
        <path d="M2.4 12.1v1.1a1 1 0 0 0 1 1h9.2a1 1 0 0 0 1-1v-1.1" />
      </svg>
      Save as PDF
    </button>
  );
}
