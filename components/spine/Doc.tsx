'use client';

/**
 * A reference document, rendered rather than dumped.
 *
 * The market library stored John's shrimp and squid research and showed it in a
 * monospace box, on the reasoning that a table keeps its alignment if you do
 * not touch it. True, and it produced something nobody can read, send or pull a
 * number out of: a wall of fixed-width text with the most valuable material in
 * the product inside it.
 *
 * THE WHEEL THIS DOES NOT REINVENT
 *
 * Markdown. It is what Notion, Linear, GitHub and every other tool of this kind
 * settled on for exactly this problem: plain text going in, structure coming
 * out. The storage stays text, so nothing had to become a schema and the next
 * document does not have to fit the shape of the last one. Only the reading
 * changed.
 *
 * Deliberately a small subset rather than a library: headings, pipe tables,
 * bullets, paragraphs. Anything it does not recognise renders as the paragraph
 * it already was, which is the failure mode you want.
 */

import { useMemo, useState } from 'react';
import { C } from './ui';

type Block =
  | { kind: 'h'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] };

const cells = (line: string) =>
  line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

const isDivider = (line: string) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');

export function parseDoc(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: Block[] = [];
  let para: string[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (para.length) { out.push({ kind: 'p', text: para.join(' ') }); para = []; }
    if (bullets.length) { out.push({ kind: 'ul', items: bullets }); bullets = []; }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    if (!t) { flush(); continue; }

    if (/^#{1,3}\s/.test(t)) {
      flush();
      out.push({ kind: 'h', text: t.replace(/^#{1,3}\s*/, '') });
      continue;
    }

    // A pipe table: a header row, a divider, then rows until the pipes stop.
    if (t.includes('|') && lines[i + 1] && isDivider(lines[i + 1].trim())) {
      flush();
      const head = cells(t);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(cells(lines[i].trim()));
        i++;
      }
      i--;
      out.push({ kind: 'table', head, rows });
      continue;
    }

    if (/^[-*]\s+/.test(t)) { if (para.length) flush(); bullets.push(t.replace(/^[-*]\s+/, '')); continue; }

    if (bullets.length) flush();
    para.push(t);
  }
  flush();
  return out;
}

/** **bold** only. Enough to let a writer stress one word in a cell. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} style={{ fontWeight: 600, color: C.text }}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

export function Doc({ source }: { source: string }) {
  const blocks = useMemo(() => parseDoc(source), [source]);

  return (
    <div style={{ maxWidth: '100%' }}>
      {blocks.map((b, i) => {
        if (b.kind === 'h') {
          return (
            <div
              key={i}
              style={{
                fontSize: 11.5, fontWeight: 600, letterSpacing: '.07em',
                textTransform: 'uppercase', color: C.faint,
                margin: i === 0 ? '0 0 8px' : '22px 0 8px',
              }}
            >
              {b.text}
            </div>
          );
        }
        if (b.kind === 'p') {
          return (
            <p key={i} style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.65, margin: '0 0 10px', maxWidth: '72ch' }}>
              <Inline text={b.text} />
            </p>
          );
        }
        if (b.kind === 'ul') {
          return (
            <ul key={i} style={{ margin: '0 0 12px', paddingLeft: 18 }}>
              {b.items.map((it, n) => (
                <li key={n} style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.6, marginBottom: 3 }}>
                  <Inline text={it} />
                </li>
              ))}
            </ul>
          );
        }
        // A real table, scrolling inside itself so the page never does.
        return (
          <div key={i} style={{ overflowX: 'auto', margin: '0 0 16px' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420 }}>
              <thead>
                <tr>
                  {b.head.map((h, n) => (
                    <th
                      key={n}
                      style={{
                        textAlign: n === 0 ? 'left' : 'right',
                        fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em',
                        textTransform: 'uppercase', color: C.faint,
                        padding: '0 12px 6px 0', whiteSpace: 'nowrap',
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, n) => (
                  <tr key={n}>
                    {r.map((cell, m) => (
                      <td
                        key={m}
                        style={{
                          textAlign: m === 0 ? 'left' : 'right',
                          fontSize: 13, color: m === 0 ? C.text : C.dim,
                          padding: '6px 12px 6px 0',
                          borderBottom: `1px solid ${C.border}`,
                          // Numbers line up or the column cannot be compared,
                          // which is the only reason anybody reads a table.
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: m === 0 ? 'normal' : 'nowrap',
                        }}
                      >
                        <Inline text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Copy the source, not the rendering.
 *
 * What gets pasted into an email should be the text a person wrote, with its
 * tables intact, rather than the HTML of this component. Half the point of the
 * library is that a number in it can be quoted at a buyer.
 */
export function CopyDoc({ source, label = 'Copy' }: { source: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(source);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
      style={{
        background: 'transparent', border: 'none', padding: 0,
        color: done ? C.green : C.blue, fontSize: 12.5,
        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}
