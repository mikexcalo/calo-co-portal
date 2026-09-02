'use client';

/**
 * The brand's own rules, checked on the way out.
 *
 * The guardrail checker has existed for a while and only ran inside the brand
 * module, which is the one place the rules were already in front of you. The
 * moment they matter is the moment something leaves: a proposal, a case study,
 * an update.
 *
 * A working name reached a live homepage once. It did not get there through
 * the brand screen.
 *
 * Free and instant, because it is string matching. That is the whole reason it
 * can run on everything rather than on the things somebody remembers to check.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { checkCopy, type Rule } from '@/lib/spine/guardrails';
import { C } from './ui';

export function OutboundCheck({
  text,
  customerId,
  label = 'about to go out',
}: {
  text: string;
  /** Whose rules apply. Their brand's, not yours. */
  customerId: string | null;
  label?: string;
}) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [brandName, setBrandName] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!customerId) return;
    const res = await supabase
      .from('brands')
      .select('name, guardrails')
      .eq('customer_id', customerId)
      .maybeSingle();
    const g = (res.data?.guardrails ?? {}) as { never?: Rule[] };
    setRules(g.never ?? []);
    setBrandName(res.data?.name ?? null);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const violations = useMemo(
    () => (rules.length && text.trim() ? checkCopy(text, rules, ['em_dash']) : []),
    [text, rules]
  );

  if (violations.length === 0) return null;

  return (
    <div
      style={{
        border: `1px solid ${C.amber}44`,
        background: C.amberSoft,
        borderRadius: 8,
        padding: '11px 13px',
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, marginBottom: 6 }}>
        {violations.length} {violations.length === 1 ? 'thing' : 'things'} {brandName ? `${brandName} ` : ''}
        does not say, in copy {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {violations.slice(0, 5).map((v, i) => (
          <div key={i} style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.55 }}>
            <span style={{ color: C.amber, fontWeight: 600 }}>{v.term}</span>
            {v.reason ? ` · ${v.reason}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
