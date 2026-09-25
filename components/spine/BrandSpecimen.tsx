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
import { C, Card, SectionLabel, numeric, radius } from './ui';
import { contrast, grade, readableOn, type Kit, type KitColor, type Stamped } from '@/lib/spine/brandkit';

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
        {c.rgb && <Copyable text={c.rgb} />}
      </div>
      {/*
        Print values and provenance, under the copyable ones.

        "Not decided" is printed rather than omitted, because a blank where a
        Pantone should be reads as an oversight and somebody fills it in from
        a converter. Saying it was never decided is the thing that stops that.
      */}
      {(c.cmyk || c.pantone || c.status || c.clientApproved !== undefined) && (
        <div
          style={{
            display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
            padding: '0 10px 10px', fontSize: 11, color: C.faint,
          }}
        >
          {c.cmyk && <span>CMYK {c.cmyk}</span>}
          {c.pantone && <span>Pantone {c.pantone}</span>}
          <StatusChip of={c} />
        </div>
      )}
    </div>
  );
}

/**
 * How settled one thing is, in the smallest space that can carry it.
 *
 * Two facts, and they are not the same fact: who decided it, and whether the
 * client agreed. A brand mid-flight is almost entirely "decided by us, never
 * shown to them", and a kit that prints only the first half will eventually
 * put a proposal in front of the person who never said yes.
 *
 * Renders nothing when nobody has ruled. That is a real state - most items in
 * most kits - and inventing a label for it would be the one thing this whole
 * pattern exists to prevent.
 *
 * Grey rather than green, amber and red. These are not health, they are
 * provenance, and a green "decided" would read as approved, which is precisely
 * the confusion being avoided.
 */
export function StatusChip({ of, size = 'sm' }: { of: Stamped; size?: 'sm' | 'md' }) {
  const bits: string[] = [];
  if (of.status) bits.push(of.status);
  if (of.clientApproved === false) bits.push('not client-approved');
  else if (of.clientApproved === true) bits.push('client-approved');
  if (bits.length === 0) return null;

  return (
    <span
      title={of.statusNote || undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: size === 'md' ? 11.5 : 10.5,
        lineHeight: 1.4,
        color: C.faint,
        background: C.panelAlt,
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        padding: size === 'md' ? '2px 7px' : '1px 5px',
        whiteSpace: 'nowrap',
      }}
    >
      {bits.join(' · ')}
      {/* An asterisk rather than the caveat itself: the note is a sentence and
          this is a chip. It is on the title attribute for whoever hovers. */}
      {of.statusNote ? <span aria-hidden>*</span> : null}
    </span>
  );
}

/**
 * The colour rules the brand actually wrote down.
 *
 * Sits directly under the palette, above the contrast matrix, because it is
 * the stricter of the two and the one a designer is answerable to. The matrix
 * below will happily report that Wet slate on Buoy clears 3:1 for large text;
 * it has no way of knowing somebody decided white on Buoy is never acceptable
 * whatever the number says.
 *
 * Any brand can have these. Most will not, and a brand without them renders
 * nothing here rather than an empty heading — same rule as everywhere else in
 * this product: a line appears when there is something behind it.
 */
export function ColorRules({ kit }: { kit: Kit }) {
  if (!kit.pairings?.length) return null;

  return (
    <Card>
      <SectionLabel>Rules for these colors</SectionLabel>
      <div
        style={{
          fontSize: 12.5, color: C.faint, marginTop: 4, marginBottom: 12,
          lineHeight: 1.6, maxWidth: '64ch',
        }}
      >
        Decided for this brand, not derived from the numbers. Where one of these
        disagrees with the contrast table below, this wins.
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
        {kit.pairings.map((p) => (
          <li
            key={p.rule}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              fontSize: 14, color: C.text, lineHeight: 1.5,
            }}
          >
            {/* A mark rather than a bullet: these are prohibitions more often
                than permissions, and a list of dots reads as options. */}
            <span
              aria-hidden
              style={{
                flexShrink: 0, marginTop: 6, width: 6, height: 6,
                borderRadius: 2, background: C.text,
              }}
            />
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span>{p.rule}</span>
              <StatusChip of={p} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * How the logo may be built and used, beside the files it governs.
 *
 * The files answer "what is the logo". This answers the questions somebody
 * actually has with the files already downloaded: which one goes here, how
 * small can it go, what am I not allowed to do. A kit that ships the artwork
 * and leaves those in a PDF gets the artwork used wrongly by people acting in
 * good faith.
 *
 * Every section is optional and an absent one renders nothing, because almost
 * no brand has all of this and a brand with only a don'ts list has a don'ts
 * list rather than a broken record.
 */
export function LogoRules({ kit }: { kit: Kit }) {
  const r = kit.logoRules;
  if (!r) return null;

  return (
    <Card>
      <SectionLabel>Using the logo</SectionLabel>

      {r.versions?.length ? (
        <Section title="Versions">
          {r.versions.map((v) => (
            <Line key={v.name} left={v.name} right={v.use} stamp={v} />
          ))}
        </Section>
      ) : null}

      {r.construction?.length ? (
        <Section title="Construction of the stacked lockup">
          {r.construction.map((c) => (
            <Line key={c.rule} left={c.rule} right={c.spec} stamp={c} />
          ))}
        </Section>
      ) : null}

      {r.clearSpace ? (
        <Section title="Clear space">
          <Line left={r.clearSpace.rule} stamp={r.clearSpace} />
        </Section>
      ) : null}

      {r.minimumSizes?.length ? (
        <Section title="Minimum sizes">
          {r.minimumSizes.map((m) => (
            <Line
              key={m.item}
              left={m.item}
              right={[m.screen, m.print].filter(Boolean).join(' · ')}
              stamp={m}
            />
          ))}
        </Section>
      ) : null}

      {r.colorVersions?.length ? (
        <Section title="Color versions">
          {r.colorVersions.map((c) => (
            <Line key={c.name} left={c.name} right={c.rule} stamp={c} />
          ))}
        </Section>
      ) : null}

      {r.donts?.length ? (
        <Section title="Don'ts">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {r.donts.map((d) => (
              <li key={d} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>
                <span aria-hidden style={{ color: C.red, flexShrink: 0, fontWeight: 700 }}>&times;</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {r.notes?.length ? (
        <Section title="Notes">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {r.notes.map((n) => (
              <li key={n} style={{ fontSize: 13, color: C.faint, lineHeight: 1.55 }}>{n}</li>
            ))}
          </ul>
        </Section>
      ) : null}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 12, fontWeight: 700, color: C.dim,
          textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 7,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'grid', gap: 5 }}>{children}</div>
    </div>
  );
}

/** One rule: what it governs on the left, what it says on the right. */
function Line({ left, right, stamp }: { left: string; right?: string; stamp?: Stamped }) {
  return (
    <div
      style={{
        display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap',
        fontSize: 13.5, lineHeight: 1.5,
        borderBottom: `1px solid ${C.border}`, paddingBottom: 5,
      }}
    >
      <span style={{ color: C.dim, minWidth: 150, flexShrink: 0 }}>{left}</span>
      {right ? <span style={{ color: C.text, flex: 1, minWidth: 180 }}>{right}</span> : null}
      {stamp ? <StatusChip of={stamp} /> : null}
    </div>
  );
}

/**
 * Where the brand stands with the person whose brand it is.
 *
 * At the top, before any of the artwork, because it changes what everything
 * below means. A kit read as finished and a kit read as a proposal are the
 * same pixels and different objects, and the difference is one line that has
 * to be passed before the swatches.
 */
export function ApprovalBanner({ kit }: { kit: Kit }) {
  const a = kit.approval;
  if (!a?.client && !a?.note) return null;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        border: `1px solid ${C.amber}55`, background: C.amberSoft,
        borderRadius: radius.lg, padding: '12px 14px', marginBottom: 22,
      }}
    >
      <span aria-hidden style={{ color: C.amber, fontWeight: 700, fontSize: 14, lineHeight: 1.5 }}>!</span>
      <div>
        {a.client ? (
          <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>
            Client approval: {a.client}
          </div>
        ) : null}
        {a.note ? (
          <div style={{ fontSize: 13, color: C.dim, marginTop: 3, lineHeight: 1.55, maxWidth: '72ch' }}>
            {a.note}
          </div>
        ) : null}
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
          <SectionLabel>Color</SectionLabel>
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
