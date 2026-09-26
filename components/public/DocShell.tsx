/**
 * The frame around a document somebody's customer opens.
 *
 * Not `Page`, and deliberately not. Page carries the app's padding, its
 * heading pattern and the assumption that a sidebar sits beside it. This is a
 * document: the business at the top, the paper in the middle, one line of our
 * small print at the bottom, and nothing anywhere that says which software
 * produced it.
 *
 * Phone first, because a customer opens an invoice on a phone in a van and a
 * proposal on whatever they happen to be holding. The column simply stops
 * growing at a readable width rather than becoming a second desktop layout.
 *
 * Server component. Everything it needs has already been resolved.
 */

import { C, radius } from '@/lib/spine/tokens';
import { telHref, type ClientFace } from '@/lib/spine/client-face';

/**
 * A quiet outlined action — Download, a phone number, an address.
 *
 * Shaped like the spine's ghost button and sized for a thumb, but it is an
 * anchor rather than a Button because every one of these leaves the page.
 */
export function Ink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 48, padding: '0 20px', borderRadius: radius.pill,
        border: `1px solid ${C.border}`, background: C.panel, color: C.text,
        fontSize: 15, fontWeight: 500, textDecoration: 'none', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </a>
  );
}

/**
 * The whole of our presence on somebody else's document.
 *
 * One line, small, at the foot, under the paper rather than on it. It says
 * the thing a customer might reasonably want to know - that the link they
 * were sent is a real one and not a forwarded attachment - and nothing about
 * what we sell.
 */
export function Sent() {
  return (
    <div style={{ textAlign: 'center', fontSize: 12, color: C.faint, margin: '22px 0 8px' }}>
      Sent securely through CALO&amp;CO
    </div>
  );
}

/**
 * The business, at the top, as itself.
 *
 * Their logo where the brand kit holds one and their initials where it does
 * not, on their own colour. Never our mark, never the product name, and never
 * a bracketed placeholder: the address line only appears if somebody actually
 * typed an address.
 */
export function DocShell({
  face,
  phone,
  action,
  width = 640,
  children,
}: {
  face: ClientFace;
  phone?: string | null;
  /** The one control that is not part of the document. Usually a download. */
  action?: React.ReactNode;
  /** An invoice is a column; a proposal has a panel beside it. */
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: C.panelAlt, minHeight: '100vh' }}>
      <header
        style={{
          background: C.panel,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1180, margin: '0 auto', padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              width: 42, height: 42, borderRadius: radius.lg, flexShrink: 0,
              background: face.logo ? 'transparent' : face.accent,
              color: face.accentInk,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
              overflow: 'hidden',
            }}
          >
            {face.logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={face.logo} alt={face.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              face.initials
            )}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
                fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: C.text,
              }}
            >
              {face.name}
            </div>
            {face.address && (
              <div style={{ fontSize: 13, color: C.faint, marginTop: 1 }}>{face.address}</div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            {phone && (
              <a
                href={telHref(phone)}
                style={{ fontSize: 15, color: face.accent, textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap' }}
              >
                {phone}
              </a>
            )}
            {action}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: width, margin: '0 auto', padding: '18px 16px 40px' }}>
        {children}
      </main>
    </div>
  );
}
