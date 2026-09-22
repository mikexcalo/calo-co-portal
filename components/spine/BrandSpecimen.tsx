'use client';

/**
 * A brand shown working, rather than an inventory of its parts.
 *
 * The kit was two boxes: a grid of colours and a list of typeface names. That
 * is a parts bin. It tells you a brand owns a navy and a serif and leaves the
 * only questions anybody actually has — how big is the headline, what sits on
 * the navy, which pairing is against the rules — to be answered by opening the
 * website in another tab.
 *
 * So: type is set as the pairs it is used in, at the sizes it is used at.
 * Colour is shown as grounds with the type that can legally sit on them, with
 * the contrast ratio printed, because "don't put Gold on Ivory" is a rule you
 * can state or a number you can show, and the number does not get argued with.
 * Tokens are here because a developer copying --navy-deep is the commonest
 * reason anybody opens this screen.
 */

import { useEffect, useState } from 'react';
import { C, Card, SectionLabel, numeric } from './ui';
import { contrast, grade, readableOn, type Kit, type KitColor } from '@/lib/spine/brandkit';

/** Load a Google face so a specimen is the face and not a fallback. */
function useFace(families: string[]) {
  useEffect(() => {
    for (const raw of families) {
      const name = raw.trim();
      if (!name) continue;
      const id = `gf-${name.replace(/\s+/g, '-').toLowerCase()}`;
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(
        /%20/g,
        '+'
      )}:wght@300;400;500;600;700;800&display=swap`;
      document.head.appendChild(link);
    }
  }, [families.join('|')]);
}

function Copyable({ text, mono = true }: { text: string; mono?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1100);
      }}
      title={`Copy ${text}`}
      style={{
        ...(mono ? numeric : {}),
        background: done ? C.green : 'transparent',
        border: `1px solid ${done ? C.green : C.border}`,
        color: done ? '#fff' : C.dim,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: mono ? undefined : 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {done ? 'Copied' : text}
    </button>
  );
}

/* ------------------------------------------------------------------ type -- */

export function TypeSpecimen({ kit }: { kit: Kit }) {
  useFace(kit.fonts.map((f) => f.family));
  if (kit.fonts.length === 0) return null;

  // The first face is the display face and gets display treatment; everything
  // after it is text and is shown at reading size. A kit that names one face
  // uses it for both, which is a real and common answer.
  return (
    <Card>
      <SectionLabel>Type</SectionLabel>
      <div style={{ display: 'grid', gap: 14, marginTop: 10 }}>
        {kit.fonts.map((f, i) => {
          const display = i === 0;
          const stack = `"${f.family}", Georgia, system-ui, sans-serif`;
          return (
            <div key={`${f.family}-${i}`} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  gap: 10, flexWrap: 'wrap', padding: '8px 13px',
                  background: C.panelAlt, borderBottom: `1px solid ${C.border}`,
                }}
              >
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: C.faint, fontWeight: 600 }}>
                  {f.role}
                </span>
                <span style={{ fontSize: 12.5, color: C.dim }}>
                  {f.family}
                  {f.weight ? ` · ${f.weight}` : ''}
                  {f.tracking ? ` · ${f.tracking}` : ''}
                  {f.source ? ` · ${f.source}` : ''}
                </span>
              </div>

              <div style={{ padding: '18px 16px 16px' }}>
                {display ? (
                  <>
                    <div style={{ fontFamily: stack, fontSize: 44, fontWeight: 600, lineHeight: 1.08, letterSpacing: '-0.02em', color: C.text }}>
                      {kit.name}
                    </div>
                    <div style={{ fontFamily: stack, fontSize: 21, fontWeight: 400, lineHeight: 1.3, color: C.dim, marginTop: 10 }}>
                      A subhead, at the size a subhead is actually set.
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: stack, fontSize: 16, lineHeight: 1.6, color: C.text, maxWidth: '62ch' }}>
                    Body copy, at reading size. The invoice goes out on the first, built from the
                    hours logged and the receipts filed, with every line pointing back at what it
                    came from.
                  </div>
                )}
                <div style={{ fontFamily: stack, fontSize: 13, color: C.faint, marginTop: 12, letterSpacing: '.02em' }}>
                  ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 $&amp;
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- colour -- */

export function Swatch({ c }: { c: KitColor }) {
  const fg = readableOn(c.hex);
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: C.panel }}>
      {/* The name sits on the colour, which is the only way to see whether the
          colour can hold text at all. */}
      <div
        style={{
          background: c.hex, color: fg, padding: '14px 12px 12px',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)',
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</div>
        {c.role && <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2, lineHeight: 1.4 }}>{c.role}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '9px 10px' }}>
        <Copyable text={c.hex.toUpperCase()} />
        {c.token && <Copyable text={c.token} />}
      </div>
    </div>
  );
}

export function Pairings({ kit }: { kit: Kit }) {
  // Grounds worth testing: the darkest and the lightest few. Every colour
  // against every colour is a hundred cells nobody reads.
  const sorted = [...kit.colors].sort((a, b) => contrast(b.hex, '#FFFFFF') - contrast(a.hex, '#FFFFFF'));
  const grounds = [sorted[0], sorted[sorted.length - 1]].filter(Boolean);
  if (grounds.length === 0 || kit.colors.length < 2) return null;

  return (
    <Card>
      <SectionLabel>What sits on what</SectionLabel>
      <div style={{ fontSize: 12.5, color: C.faint, marginTop: 4, marginBottom: 12, lineHeight: 1.6, maxWidth: '64ch' }}>
        The ratio is WCAG contrast, the same arithmetic an accessibility audit runs. 4.5 is the
        floor for body text, 3 for large. Below 3 it is not a preference, it is unreadable.
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {grounds.map((g) => (
          <div key={g.hex} style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            <div style={{ background: g.hex, padding: '13px 14px' }}>
              <div style={{ fontSize: 11.5, color: readableOn(g.hex), opacity: 0.75, marginBottom: 9 }}>
                On {g.name}
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {kit.colors
                  .filter((c) => c.hex.toUpperCase() !== g.hex.toUpperCase())
                  .map((c) => {
                    const r = contrast(c.hex, g.hex);
                    const gr = grade(r);
                    return (
                      <div key={c.hex} style={{ minWidth: 118 }}>
                        <div style={{ color: c.hex, fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>
                          {c.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <span style={{ ...numeric, fontSize: 11.5, color: readableOn(g.hex), opacity: 0.7 }}>
                            {r.toFixed(1)}
                          </span>
                          <span
                            style={{
                              fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                              background: gr.tone === 'green' ? C.green : gr.tone === 'amber' ? C.amber : C.red,
                              color: '#fff',
                            }}
                          >
                            {gr.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------- whole -- */

export function BrandSpecimen({ kit }: { kit: Kit }) {
  const logo = kit.logos[0];
  const dark = [...kit.colors].sort((a, b) => contrast(b.hex, '#FFFFFF') - contrast(a.hex, '#FFFFFF'))[0];

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 760 }}>
      {logo && (
        <Card>
          <SectionLabel>The mark</SectionLabel>
          {/* On both grounds, because a mark that only works on white is a
              mark nobody has tested. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 10 }}>
            {[{ bg: '#FFFFFF', label: 'On white' }, { bg: dark?.hex ?? '#141414', label: `On ${dark?.name ?? 'dark'}` }].map((g) => (
              <div key={g.label} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: g.bg, padding: '28px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 110 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo} alt={kit.name} style={{ maxHeight: 54, maxWidth: '100%', objectFit: 'contain' }} />
                </div>
                <div style={{ fontSize: 11.5, color: C.faint, padding: '7px 11px', borderTop: `1px solid ${C.border}` }}>
                  {g.label}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <TypeSpecimen kit={kit} />

      {kit.colors.length > 0 && (
        <Card>
          <SectionLabel>Colour</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12, marginTop: 10 }}>
            {kit.colors.map((c, i) => <Swatch key={`${c.hex}-${i}`} c={c} />)}
          </div>
        </Card>
      )}

      <Pairings kit={kit} />

      {kit.voice && (
        <Card>
          <SectionLabel>Voice</SectionLabel>
          <div style={{ fontSize: 15, color: C.text, lineHeight: 1.6, marginTop: 8, maxWidth: '62ch' }}>
            {kit.voice}
          </div>
        </Card>
      )}
    </div>
  );
}
