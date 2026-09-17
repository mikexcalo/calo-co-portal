/**
 * What a customer sees when a link has stopped working.
 *
 * Estimates and invoices are sent as unguessable links, and links get
 * forwarded, expire, and are revoked. Until now that landed on Next's stock
 * 404 — black, unbranded, and indistinguishable from the whole site being
 * down. Somebody deciding whether to pay you should not see that.
 *
 * It says the one thing they need: this is not your fault, and here is what
 * to do. No navigation, because they have no account to navigate.
 */

import { PRODUCT } from '@/lib/brand';

export default function NotFound() {
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
          This link has stopped working
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.6, color: '#383D45', margin: '0 0 8px' }}>
          It may have expired, been replaced by a newer version, or been turned off.
        </p>
        <p style={{ fontSize: 15.5, lineHeight: 1.6, color: '#383D45', margin: 0 }}>
          Ask whoever sent it for a fresh link — nothing is lost at their end.
        </p>
        <p style={{ fontSize: 12.5, color: '#8A9099', marginTop: 28 }}>{PRODUCT}</p>
      </div>
    </main>
  );
}
