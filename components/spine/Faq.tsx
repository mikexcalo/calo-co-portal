'use client';

/**
 * The terms, as questions somebody would actually ask.
 *
 * They were one pre-wrapped block of text running the height of the page —
 * three headings and six paragraphs, set at the same size and weight as each
 * other, with blank lines doing the work that structure should do. Nobody
 * reads that on a document they are deciding about. They scroll past it and
 * then ask you the question it answered.
 *
 * So each heading is a real heading and opens on a press. The first one is
 * open, because what it costs is the question everybody has.
 */

import { useState } from 'react';

export function Faq({ items, accent }: { items: Array<{ q: string; a: string }>; accent: string }) {
  const [open, setOpen] = useState(0);
  if (items.length === 0) return null;

  return (
    <div style={{ marginTop: 26, borderTop: '1px solid #e4e4e0' }}>
      {items.map((it, i) => {
        const on = open === i;
        return (
          <div key={it.q} style={{ borderBottom: '1px solid #e4e4e0' }}>
            <button
              onClick={() => setOpen(on ? -1 : i)}
              aria-expanded={on}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '16px 2px', textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#111', letterSpacing: '-0.01em' }}>
                {it.q}
              </span>
              {/* A plus that becomes a minus. Nothing rotates, so nothing
                  wobbles on a slow phone. */}
              <span
                style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: on ? accent : '#f0f0ed', color: on ? '#fff' : '#555',
                  fontSize: 15, lineHeight: 1, fontWeight: 500,
                }}
              >
                {on ? '−' : '+'}
              </span>
            </button>
            {on && (
              <div
                style={{
                  fontSize: 14.5, color: '#444', lineHeight: 1.65,
                  whiteSpace: 'pre-wrap', padding: '0 2px 18px', maxWidth: '62ch',
                }}
              >
                {it.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Split the stored note into those questions.
 *
 * The copy is written as a heading line, a blank line, then its paragraphs —
 * so that is the rule, rather than a second column somebody has to keep in
 * step with the first. A heading is a short line with no full stop that has a
 * blank line under it. Anything before the first heading, or a note that
 * follows no convention at all, comes back as a single block and still renders.
 */
export function asQuestions(notes: string | null | undefined): Array<{ q: string; a: string }> {
  const text = (notes ?? '').trim();
  if (!text) return [];

  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out: Array<{ q: string; a: string }> = [];

  for (const b of blocks) {
    const oneLine = !b.includes('\n');
    const heading = oneLine && b.length <= 60 && !/[.!?:,]$/.test(b);
    if (heading) out.push({ q: b, a: '' });
    else if (out.length) out[out.length - 1].a += (out[out.length - 1].a ? '\n\n' : '') + b;
    else out.push({ q: 'The detail', a: b });
  }

  return out.filter((x) => x.a);
}
