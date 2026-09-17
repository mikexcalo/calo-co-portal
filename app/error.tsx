'use client';

/**
 * When something breaks mid-render.
 *
 * The alternative is Next's stock error screen, which says "Application error:
 * a client-side exception has occurred" — a sentence written for whoever wrote
 * the application, shown to whoever was using it.
 *
 * Try again first, because a lot of these are a dropped connection.
 */

import { useEffect } from 'react';
import { PRODUCT } from '@/lib/brand';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Visible in the browser console for whoever is debugging, never on screen.
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '48px 24px',
        background: '#FFFFFF',
        color: '#1D1F24',
      }}
    >
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 10px' }}>
          That screen did not load
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.6, color: '#383D45', margin: '0 0 22px' }}>
          Nothing you did, and nothing was lost. Trying again usually works.
        </p>
        <button
          onClick={reset}
          style={{
            background: '#141414',
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '10px 22px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Try again
        </button>
        <p style={{ fontSize: 12.5, color: '#8A9099', marginTop: 28 }}>{PRODUCT}</p>
      </div>
    </main>
  );
}
