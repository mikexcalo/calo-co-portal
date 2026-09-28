/**
 * The way in, for somebody who is not signed in yet.
 *
 * Two doors, one shell. The front door is ours and says so quietly. The other
 * is a client's own: they arrived from an invitation, from their workspace's
 * sign-in link, or from a reset email, so we already know whose business this
 * is and there is no reason to make them wonder.
 *
 * WHY THE CLIENT'S COLOUR IS NOT HERE
 *
 * Their logo and their name, and nothing else of theirs. A sign-in screen is
 * not a document from their business, it is the door to software, and a
 * coloured button here would be the one place the product borrowed a brand to
 * decorate its own furniture. Every button on these pages is black.
 *
 * WHY IT IS NOT `Page`
 *
 * Nobody here has a workspace open. `Page` belongs inside the application and
 * brings the shell with it; section 4b of the rulebook is explicit that a
 * person who has not signed in must never be shown the inside of somebody
 * else's software.
 */

import { PRODUCT } from '@/lib/brand';

export interface DoorWorkspace {
  name: string;
  /** Their mark, where the brand kit holds one. */
  logo?: string | null;
  initials: string;
}

const INK = '#141414';
const TEXT = '#1a1a1a';
const DIM = '#5a5a5a';
const FAINT = '#8a8a88';

/**
 * How long a password or sign-in link actually lasts.
 *
 * One hour. It is GoTrue's `MAILER_OTP_EXP`, whose default is 3600 seconds,
 * and it is what the emailed template already claims. The reset page used to
 * say "about a day", which matched nothing. Written once, here, so the page
 * and the email cannot drift apart again.
 */
export const LINK_LASTS = 'This link works once, and only for an hour.';

/**
 * No word left alone on a line.
 *
 * `balance` evens a heading across its lines; `pretty` stops a paragraph
 * ending on a single word. Browsers without either fall back to ordinary
 * wrapping, which is what these pages did before.
 */
/**
 * Never a single word alone on the last line.
 *
 * `text-wrap: pretty` asks a browser to avoid it and several browsers decline,
 * so the last two words are bound with a non-breaking space, which no
 * browser can pull apart. Belt for the CSS's braces: the CSS still improves
 * the lines above it, this guarantees the one at the bottom.
 */
export function noWidow(text: string): string {
  const i = text.trimEnd().lastIndexOf(' ');
  return i < 0 ? text : `${text.slice(0, i)}\u00A0${text.slice(i + 1)}`;
}

export const HEADING_WRAP = { textWrap: 'balance' } as React.CSSProperties;
export const PROSE_WRAP = { textWrap: 'pretty' } as React.CSSProperties;

export function Door({
  workspace,
  heading,
  subline,
  children,
  footer,
  beforeCard,
  maxWidth = 400,
  top = false,
}: {
  /** Whose door this is. Null is ours. */
  workspace?: DoorWorkspace | null;
  heading: string;
  subline: string;
  children: React.ReactNode;
  /** Anything below the card. */
  footer?: React.ReactNode;
  /**
   * Anything between the header and the card. First-run setup puts its
   * progress bar here, which belongs to the run of questions rather than to
   * any one of them.
   */
  beforeCard?: React.ReactNode;
  /** Wider than a sign-in box, for a form with more than two fields in it. */
  maxWidth?: number;
  /**
   * Sit at the top rather than centred. A sign-in box is short enough to
   * centre; a setup question with a list of payment methods in it is taller
   * than a phone, and centring taller-than-viewport content puts its heading
   * above the top of the page where nothing can scroll to it.
   */
  top?: boolean;
}) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: top ? 'flex-start' : 'center',
        justifyContent: 'center',
        background: '#f7f7f5',
        padding: top ? '40px 20px 64px' : '32px 20px',
        color: TEXT,
        fontFamily: 'inherit',
      }}
    >
      <div style={{ width: '100%', maxWidth }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          {workspace ? (
            <>
              {/*
                Their mark, or their initials on black.

                Black rather than their colour, for the same reason the button
                is: this is the door to the software, not a page of theirs.
              */}
              {workspace.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={workspace.logo}
                  alt=""
                  style={{ height: 40, maxWidth: 190, objectFit: 'contain', margin: '0 auto 12px', display: 'block' }}
                />
              ) : (
                <div
                  style={{
                    width: 44, height: 44, borderRadius: 11, background: INK, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, letterSpacing: '.02em',
                    margin: '0 auto 12px',
                  }}
                >
                  {workspace.initials}
                </div>
              )}
              <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{workspace.name}</div>
            </>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.12em', color: FAINT }}>
              {PRODUCT.toUpperCase()}
            </div>
          )}

          <h1
            style={{
              fontSize: 23, fontWeight: 600, letterSpacing: '-0.021em',
              color: TEXT, margin: workspace ? '18px 0 6px' : '14px 0 6px', ...HEADING_WRAP,
            }}
          >
            {heading}
          </h1>
          <p style={{ fontSize: 14, color: DIM, margin: 0, lineHeight: 1.6, ...PROSE_WRAP }}>
            {subline}
          </p>
        </div>

        {beforeCard}

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e4e4e0',
            borderRadius: 12,
            padding: 26,
          }}
        >
          {children}
        </div>

        <div
          style={{
            textAlign: 'center', marginTop: 20, fontSize: 13,
            color: FAINT, lineHeight: 1.7, ...PROSE_WRAP,
          }}
        >
          {footer}
          {workspace && (
            <div style={{ marginTop: footer ? 12 : 0 }}>Workspace by {PRODUCT}</div>
          )}
        </div>
      </div>
    </main>
  );
}
