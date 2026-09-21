'use client';

/**
 * A typeface, shown as itself.
 *
 * The kit listed a font by name in a grey input box, set in the interface's
 * own face. So the one question a type section exists to answer — what does
 * this actually look like — was the one thing it could not tell you, and
 * managing a brand from here meant opening Google Fonts in another tab.
 *
 * This loads the face and sets specimens in it, at the sizes the face is
 * actually used at, so the heading sample is the size of a heading.
 *
 * It also replaces a lie. The kit printed "Ancizar Serif never loads" as fixed
 * text on every brand — Mammoth uses Manrope and Inter and was still told
 * about a serif it has never referenced. Whether a face loads is a fact about
 * that face, so it is measured: the browser is asked whether the family
 * resolved, and the warning names the font that actually failed.
 */

import { useEffect, useState } from 'react';
import { C } from './ui';

/** Faces the interface itself ships, which need no fetching. */
const LOCAL = ['figtree', 'inter', 'geist', 'geist mono', 'source serif 4', 'georgia', 'system-ui'];

export function FontSpecimen({
  family,
  role,
  sample,
  size,
  weight = 400,
}: {
  family: string;
  role: string;
  sample: string;
  size: number;
  weight?: number;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const name = family.trim();

  useEffect(() => {
    if (!name) return;
    const local = LOCAL.includes(name.toLowerCase());
    const id = `gf-${name.replace(/\s+/g, '-').toLowerCase()}`;

    if (!local && !document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
        name
      ).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(link);
    }

    let dead = false;
    const check = () => {
      if (dead) return;
      // Asking the browser rather than assuming. A name nobody publishes never
      // resolves, and that is exactly what somebody needs to be told.
      const ok = local || document.fonts.check(`16px "${name}"`);
      setState(ok ? 'ok' : 'missing');
    };
    document.fonts.ready.then(() => setTimeout(check, 400));
    return () => {
      dead = true;
    };
  }, [name]);

  if (!name) return null;

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 10, padding: '8px 12px', borderBottom: `1px solid ${C.border}`,
          background: C.panelAlt,
        }}
      >
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: C.faint, fontWeight: 600 }}>
          {role}
        </span>
        <span style={{ fontSize: 12.5, color: C.dim }}>
          {name} · {size}px
        </span>
      </div>

      <div style={{ padding: '16px 14px' }}>
        <div
          style={{
            fontFamily: `"${name}", system-ui, sans-serif`,
            fontSize: size,
            fontWeight: weight,
            lineHeight: 1.25,
            color: C.text,
            wordBreak: 'break-word',
          }}
        >
          {sample}
        </div>
        <div
          style={{
            fontFamily: `"${name}", system-ui, sans-serif`,
            fontSize: 13,
            color: C.faint,
            marginTop: 10,
            letterSpacing: '.02em',
          }}
        >
          ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
        </div>
      </div>

      {state === 'missing' && (
        <div
          style={{
            fontSize: 12.5, color: C.amber, lineHeight: 1.55,
            padding: '9px 12px', background: C.amberSoft, borderTop: `1px solid ${C.amber}44`,
          }}
        >
          <strong style={{ fontWeight: 600 }}>{name} didn&apos;t load.</strong> Nothing published
          under that name was found, so what you&apos;re seeing above is a fallback. Check the
          spelling, or name a face you do load.
        </div>
      )}
    </div>
  );
}
