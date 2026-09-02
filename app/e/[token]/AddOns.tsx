'use client';

/**
 * Things the customer can add themselves.
 *
 * The cheapest revenue in any trade. Not a new customer and not a higher
 * price: the one already reading your estimate, given a way to say yes to
 * something else.
 *
 * Nobody upsells on a quote because it feels like pushing, and asking out loud
 * is a conversation most people avoid having. A tick box is not a
 * conversation. It sits there, costs nothing to ignore, and turns the awkward
 * part into the customer's own decision.
 *
 * Unticked by default, always. A pre-ticked add-on is a trick, and the one
 * time somebody notices it costs more trust than the extra line was worth.
 */

import { useState } from 'react';
import { DecisionButtons } from './DecisionButtons';

interface Line {
  id: string;
  description: string;
  total: number;
}

const money = (n: number) =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AddOns({
  token,
  accent,
  options,
  baseTotal,
  decided,
}: {
  token: string;
  accent: string;
  options: Line[];
  baseTotal: number;
  decided: boolean;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const extra = options
    .filter((o) => picked.has(o.id))
    .reduce((s, o) => s + Number(o.total), 0);

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      {options.length > 0 && !decided && (
        <div style={{ borderTop: '1px solid #e4e4e0', padding: '22px 30px' }}>
          <div style={{ fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#777', fontWeight: 600, marginBottom: 4 }}>
            Optional
          </div>
          <p style={{ fontSize: 14, color: '#666', margin: '0 0 14px', lineHeight: 1.6 }}>
            Add any of these if you want them. Leave them and the price above stands.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {options.map((o) => {
              const on = picked.has(o.id);
              return (
                <label
                  key={o.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 13px', borderRadius: 9, cursor: 'pointer',
                    border: `1px solid ${on ? accent : '#eceae4'}`,
                    background: on ? `${accent}0d` : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(o.id)}
                    style={{ width: 18, height: 18, accentColor: accent, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 15, color: '#222', flex: 1 }}>{o.description}</span>
                  <span style={{ fontSize: 15, color: '#222', whiteSpace: 'nowrap' }}>
                    + {money(Number(o.total))}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Only appears once something is ticked. Showing a "new total"
              identical to the old one reads like a trick even when it is not. */}
          {extra > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 14, marginTop: 18 }}>
              <span style={{ fontSize: 14, color: '#666' }}>New total</span>
              <span style={{ fontSize: 26, fontWeight: 600, color: '#14161A' }}>
                {money(baseTotal + extra)}
              </span>
            </div>
          )}
        </div>
      )}

      {!decided && (
        <div style={{ borderTop: '1px solid #e4e4e0', padding: '22px 30px 26px', background: '#fafaf8' }}>
          <DecisionButtons token={token} accent={accent} selected={Array.from(picked)} />
        </div>
      )}
    </>
  );
}
