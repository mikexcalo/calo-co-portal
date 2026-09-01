/**
 * What the prospect opens.
 *
 * Rendered on the server so the content is in the page when it arrives. A
 * pitch that flashes a spinner at somebody deciding whether to hire you is a
 * bad first sentence, and search-engine niceties matter less here than the
 * two seconds before they form an opinion.
 *
 * Deliberately quiet: no navigation, no sign-in prompt, no product branding
 * competing with the sender's. The page belongs to whoever sent it.
 */

import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface Section { heading: string; body: string }

interface PitchPayload {
  title: string;
  recipient: string | null;
  sections: Section[];
  org: { name: string; brand: Record<string, unknown> };
}

const INK = '#14161A';
const BODY = '#3A424C';
const MUTED = '#69727D';
const RULE = '#E4E7EB';

export default async function PitchPage({ params }: { params: { token: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let pitch: PitchPayload | null = null;

  if (url && anon) {
    const ua = headers().get('user-agent') ?? '';
    const supabase = createClient(url, anon, { auth: { persistSession: false } });
    const { data } = await supabase.rpc('read_pitch', {
      token: params.token,
      is_mobile: /Mobile|Android|iPhone|iPad/i.test(ua),
    });
    pitch = (data as PitchPayload | null) ?? null;
  }

  if (!pitch) {
    return (
      <main style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <h1 style={{ fontSize: 19, fontWeight: 600, color: INK, margin: '0 0 10px' }}>
            This link isn&apos;t available
          </h1>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, margin: 0 }}>
            It may have been taken down, or the address may be wrong. Get in touch with whoever
            sent it and they can send a fresh one.
          </p>
        </div>
      </main>
    );
  }

  /**
   * The sender's own colors, when they have set them. Falling back to
   * near-black rather than to a house color, because a pitch wearing our
   * accent instead of theirs is a pitch that looks like it came from software.
   */
  const brand = pitch.org.brand as { colors?: Array<{ hex: string; role?: string }> };
  const accent =
    brand?.colors?.find((c) => /primary/i.test(c.role ?? ''))?.hex ??
    brand?.colors?.[0]?.hex ??
    INK;

  return (
    <main style={{ minHeight: '100vh', background: '#FFFFFF', padding: '0 20px 90px' }}>
      <div style={{ maxWidth: 660, margin: '0 auto' }}>
        <header style={{ paddingTop: 64, marginBottom: 46 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: accent,
              marginBottom: 22,
            }}
          >
            {pitch.org.name}
          </div>
          <h1
            style={{
              fontSize: 'clamp(30px, 5.5vw, 44px)',
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              fontWeight: 600,
              color: INK,
              margin: 0,
              textWrap: 'balance',
            }}
          >
            {pitch.title}
          </h1>
          {pitch.recipient && (
            <p style={{ fontSize: 16, color: MUTED, margin: '16px 0 0' }}>
              Prepared for {pitch.recipient}
            </p>
          )}
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {pitch.sections
            .filter((s) => (s.heading ?? '').trim() || (s.body ?? '').trim())
            .map((s, i) => (
              <section key={i}>
                {s.heading?.trim() && (
                  <h2
                    style={{
                      fontSize: 19,
                      fontWeight: 600,
                      letterSpacing: '-0.012em',
                      color: INK,
                      margin: '0 0 12px',
                      paddingTop: i === 0 ? 0 : 8,
                      borderTop: i === 0 ? 'none' : `1px solid ${RULE}`,
                    }}
                  >
                    {i === 0 ? s.heading : <span style={{ display: 'block', paddingTop: 26 }}>{s.heading}</span>}
                  </h2>
                )}
                {/* whiteSpace preserves the paragraph breaks somebody typed.
                    Reflowing their spacing into one block is a small way of
                    telling them their writing did not matter. */}
                <p
                  style={{
                    fontSize: 16,
                    lineHeight: 1.72,
                    color: BODY,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {s.body}
                </p>
              </section>
            ))}
        </div>

        <footer style={{ marginTop: 60, paddingTop: 24, borderTop: `1px solid ${RULE}`, fontSize: 13.5, color: MUTED, lineHeight: 1.7 }}>
          Questions about any of this? Reply to the message this came from and{' '}
          {pitch.org.name} will pick it up.
        </footer>
      </div>
    </main>
  );
}
