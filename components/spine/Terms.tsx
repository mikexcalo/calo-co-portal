'use client';

import type { CSSProperties } from 'react';

/**
 * What was agreed with this client.
 *
 * The deal with John and Mark existed entirely in one person's head: sixty an
 * hour instead of the usual hundred and twenty because they are friends,
 * twenty a month for hosting, billed on the first, paid by Venmo. An
 * arrangement that lives in a memory is the one that gets misremembered in six
 * months, when somebody queries an invoice and there is nothing to point at.
 *
 * What this deliberately is not: a switch that starts charging. Nothing bills
 * from it. Recording a rate and charging it are different acts, and the screen
 * says which one this is.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, SectionLabel, inputStyle, money } from './ui';
import { human } from '@/lib/spine/errors';
import { save as saveOrFail } from '@/lib/spine/save';

interface Row {
  hourly_rate: number | null;
  standard_rate: number | null;
  why_discounted: string | null;
  monthly_fee: number | null;
  monthly_fee_for: string | null;
  platform_fee: number | null;
  bills_on: number;
  pay_by: string | null;
  billing_live: boolean;
  note: string | null;
}

const EMPTY: Row = {
  hourly_rate: null, standard_rate: null, why_discounted: null,
  monthly_fee: null, monthly_fee_for: null, platform_fee: null,
  bills_on: 1, pay_by: null, billing_live: false, note: null,
};

const num = (v: string) => (v.trim() === '' ? null : Number.parseFloat(v) || 0);
const str = (v: string) => (v.trim() === '' ? null : v.trim());

/** Label left, figure right, a hairline between. How terms read off paper. */
const termRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 16,
  padding: '10px 0',
  borderTop: `1px solid ${C.border}`,
};

export function Terms({ orgId, customerId }: { orgId: string; customerId: string }) {
  const [row, setRow] = useState<Row | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Row>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /*
    Whether they are being billed is a fact about their invoices.

    This read billing_live, a flag somebody has to remember to set, and the
    flag was false for Global Seafood while GSEA-001 sat in their own Invoices
    screen billing the $20 printed directly above the banner. So the client
    record said "nothing is invoiced from this yet" about money that was on an
    invoice. A record that contradicts the bill is worse than no record.

    An invoice that exists and is not void is the answer, and nobody has to
    remember anything.
  */
  const [invoiced, setInvoiced] = useState<{ count: number; draft: number } | null>(null);

  const load = useCallback(async () => {
    const [termRes, jobRes] = await Promise.all([
      supabase
        .from('customer_terms')
        .select('hourly_rate, standard_rate, why_discounted, monthly_fee, monthly_fee_for, platform_fee, bills_on, pay_by, billing_live, note')
        .eq('customer_id', customerId)
        .maybeSingle(),
      supabase.from('jobs').select('id').eq('customer_id', customerId),
    ]);
    if (!termRes.error) setRow((termRes.data as Row) ?? null);

    const jobIds = ((jobRes.data ?? []) as Array<{ id: string }>).map((j) => j.id);
    if (!jobIds.length) { setInvoiced({ count: 0, draft: 0 }); return; }
    const inv = await supabase
      .from('job_invoices')
      .select('status')
      .in('job_id', jobIds)
      .neq('status', 'void');
    const rows = (inv.data ?? []) as Array<{ status: string }>;
    setInvoiced({
      count: rows.filter((r) => r.status !== 'draft').length,
      draft: rows.filter((r) => r.status === 'draft').length,
    });
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const start = () => { setDraft(row ?? EMPTY); setEditing(true); setError(''); };

  const keep = async () => {
    setBusy(true); setError('');
    const res = await saveOrFail(
      supabase.from('customer_terms').upsert(
        { org_id: orgId, customer_id: customerId, ...draft },
        { onConflict: 'customer_id' }
      ),
      'What you agreed'
    );
    setBusy(false);
    if (res.error) { setError(human(res.error)); return; }
    setEditing(false);
    load();
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    hint?: string,
    placeholder?: string
  ) => (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 12, color: C.faint, display: 'block', marginBottom: 4 }}>{label}</span>
      <input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} style={inputStyle} />
      {hint && <span style={{ fontSize: 11.5, color: C.faint, display: 'block', marginTop: 3 }}>{hint}</span>}
    </label>
  );

  if (!editing) {
    const nth = row ? (row.bills_on === 1 ? '1st' : row.bills_on === 2 ? '2nd' : row.bills_on === 3 ? '3rd' : `${row.bills_on}th`) : '';
    const saved =
      row?.hourly_rate != null && row?.standard_rate != null && row.standard_rate > row.hourly_rate
        ? Math.round(((row.standard_rate - row.hourly_rate) / row.standard_rate) * 100)
        : null;
    return (
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <SectionLabel>What you agreed</SectionLabel>
          <Button variant="ghost" onClick={start}>{row ? 'Edit' : 'Write it down'}</Button>
        </div>
        <Card>
          {!row ? (
            <p style={{ fontSize: 13.5, color: C.faint, margin: 0, lineHeight: 1.6 }}>
              Nothing written down. What you charge them, anything flat each month, when it bills
              and how they pay, put it here while you still remember agreeing it.
            </p>
          ) : (
            <>
              {/*
                A list, not a two by two.

                Four figures in a grid inside a bordered card was a fourth
                layout on a screen that already had tiles, cards and a table,
                and the quadrants meant the eye had to travel in two directions
                to read four facts. They are four lines of one thing each now:
                label on the left, number on the right, the way terms are read
                off any agreement.
              */}
              <div style={{ display: 'flex', flexDirection: 'column' }} className="termList">
                {row.hourly_rate != null && (
                  <div style={termRow}>
                    <div style={{ fontSize: 13, color: C.dim }}>Their rate</div>
                    <div style={{ textAlign: 'right' }}>
                    {/*
                      A discount is a price with a line through it.

                      This read "50% off $120.00, friends and family" — the
                      arithmetic written out underneath the answer, in a
                      sentence, when the whole convention for showing a
                      discount is the old number struck through beside the new
                      one. You see it rather than read it, and the percentage
                      was never the point: what you want at a glance is what
                      they pay and what they would have paid.
                    */}
                    <div style={{ fontSize: 16, color: C.text, fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 7, alignItems: 'baseline', justifyContent: 'flex-end' }}>
                      {saved != null && (
                        <span style={{ fontSize: 13, color: C.faint, textDecoration: 'line-through' }}>
                          {money(row.standard_rate ?? 0)}
                        </span>
                      )}
                      <span>{money(row.hourly_rate)}<span style={{ fontSize: 12.5, color: C.faint }}>/hr</span></span>
                    </div>
                    {saved != null && row.why_discounted && (
                      <div style={{ fontSize: 11.5, color: C.green, marginTop: 1 }}>
                        {row.why_discounted.toLowerCase()}
                      </div>
                    )}
                    </div>
                  </div>
                )}
                {row.monthly_fee != null && (
                  <div style={termRow}>
                    <div style={{ fontSize: 13, color: C.dim }}>
                      Every month
                      <div style={{ fontSize: 11.5, color: C.faint }}>
                        {row.monthly_fee_for ?? 'Flat fee'}, on the {nth}
                      </div>
                    </div>
                    <div style={{ fontSize: 16, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                      {money(row.monthly_fee)}
                    </div>
                  </div>
                )}
                <div style={termRow}>
                  <div style={{ fontSize: 13, color: C.dim }}>Platform use</div>
                  <div style={{ fontSize: 16, color: row.platform_fee == null ? C.faint : C.text, fontVariantNumeric: 'tabular-nums' }}>
                    {row.platform_fee == null ? 'Not decided' : money(row.platform_fee)}
                  </div>
                </div>
                {row.pay_by && (
                  <div style={termRow}>
                    <div style={{ fontSize: 13, color: C.dim }}>They pay by</div>
                    <div style={{ fontSize: 14.5, color: C.text }}>{row.pay_by}</div>
                  </div>
                )}
              </div>

              {/*
                The note used to sit here saying "platform use will be charged
                once the amount is decided" underneath a platform fee of $20,
                because it was typed when the amount was not decided and free
                text does not update itself. It is still shown, but only while
                it is not being contradicted by a number directly above it.
              */}
              {row.note && row.platform_fee == null && (
                <p style={{ fontSize: 13, color: C.dim, margin: '14px 0 0', lineHeight: 1.6 }}>{row.note}</p>
              )}

              {/*
                The line that stops somebody assuming this is live.

                A rate on a screen looks like a rate being charged. It is not,
                and it will not be until somebody decides it is.
              */}
              <div
                style={{
                  marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`,
                  fontSize: 12.5,
                  color: invoiced && (invoiced.count || invoiced.draft) ? C.green : C.amber,
                }}
              >
                {!invoiced
                  ? 'Checking their invoices…'
                  : invoiced.count
                    ? `Being billed. ${invoiced.count} invoice${invoiced.count === 1 ? '' : 's'} sent.`
                    : invoiced.draft
                      ? `Drafted and waiting for you. Goes out on the ${nth}.`
                      : 'Written down, not being charged. Nothing is invoiced from this yet.'}
              </div>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 26 }}>
      <SectionLabel>What you agreed</SectionLabel>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          {field('Their hourly rate', draft.hourly_rate?.toString() ?? '', (v) => setDraft({ ...draft, hourly_rate: num(v) }), 'What this client pays.', '60')}
          {field('Your usual rate', draft.standard_rate?.toString() ?? '', (v) => setDraft({ ...draft, standard_rate: num(v) }), 'So the discount is visible later.', '120')}
          {field('Why the discount', draft.why_discounted ?? '', (v) => setDraft({ ...draft, why_discounted: str(v) }), undefined, 'Friends and family')}
          {field('Flat monthly', draft.monthly_fee?.toString() ?? '', (v) => setDraft({ ...draft, monthly_fee: num(v) }), undefined, '20')}
          {field('What that covers', draft.monthly_fee_for ?? '', (v) => setDraft({ ...draft, monthly_fee_for: str(v) }), 'Naming it stops an argument.', 'Hosting')}
          {field('Platform use', draft.platform_fee?.toString() ?? '', (v) => setDraft({ ...draft, platform_fee: num(v) }), 'Leave blank until decided.', 'Not decided')}
          {field('Bills on day', draft.bills_on?.toString() ?? '1', (v) => setDraft({ ...draft, bills_on: Math.min(28, Math.max(1, Number.parseInt(v, 10) || 1)) }), 'Of each month.', '1')}
          {field('They pay by', draft.pay_by ?? '', (v) => setDraft({ ...draft, pay_by: str(v) }), undefined, 'Venmo or PayPal')}
        </div>

        <div style={{ marginTop: 12 }}>
          <textarea
            value={draft.note ?? ''}
            onChange={(e) => setDraft({ ...draft, note: str(e.target.value) })}
            rows={2}
            placeholder="Anything else about the arrangement"
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.billing_live}
            onChange={(e) => setDraft({ ...draft, billing_live: e.target.checked })}
            style={{ marginTop: 3 }}
          />
          <span style={{ fontSize: 13, color: C.dim, lineHeight: 1.55 }}>
            Actually charge this
            <span style={{ display: 'block', fontSize: 12, color: C.faint }}>
              Off while you are still deciding. Nothing is invoiced until this is on.
            </span>
          </span>
        </label>

        {error && <p style={{ fontSize: 12.5, color: C.red, margin: '10px 0 0' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14 }}>
          <Button onClick={keep} disabled={busy}>{busy ? 'Saving…' : 'Keep it'}</Button>
          <button
            onClick={() => setEditing(false)}
            style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
        </div>
      </Card>
    </div>
  );
}
