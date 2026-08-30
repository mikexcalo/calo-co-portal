'use client';

/**
 * Overheads — what it costs to keep the doors open.
 *
 * Distinct from receipts, which belong to a job and get billed on to a
 * customer. Nothing here is billable to anyone: software subscriptions,
 * insurance, fuel, the accountant, the phone. Money that leaves whether or not
 * you worked this month.
 *
 * Leaving these out of the picture does not make Profit & Loss neutral, it
 * makes it wrong in a flattering direction — showing what the jobs earned and
 * none of what it costs to be open. That is the number that convinces a
 * business it is doing better than it is.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import {
  Button,
  C,
  Card,
  Empty,
  Field,
  Metric,
  Page,
  Pill,
  Row,
  SectionLabel,
  Table,
  inputStyle,
  money,
  money0,
  shortDate,
  today,
} from '@/components/spine/ui';
import { Confirm } from '@/components/spine/Confirm';
import { PRODUCT } from '@/lib/brand';

interface Overhead {
  id: string;
  vendor: string | null;
  description: string | null;
  amount: number;
  purchased_on: string;
  recurrence: string;
  kind: string;
}

const RECURRENCE = [
  { id: 'once', label: 'One-off' },
  { id: 'monthly', label: 'Every month' },
  { id: 'quarterly', label: 'Every 3 months' },
  { id: 'yearly', label: 'Every year' },
] as const;

const RECURRENCE_LABEL: Record<string, string> = {
  once: 'One-off',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

/** What a repeating cost works out to per month, whatever its billing period. */
const perMonth = (amount: number, recurrence: string) =>
  recurrence === 'monthly'
    ? amount
    : recurrence === 'quarterly'
    ? amount / 3
    : recurrence === 'yearly'
    ? amount / 12
    : 0;

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

export default function ExpensesPage() {
  const { org } = useOrg();
  const [rows, setRows] = useState<Overhead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Overhead | null>(null);

  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [recurrence, setRecurrence] = useState<string>('monthly');
  const [purchasedOn, setPurchasedOn] = useState(today());

  const load = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    // Explicitly scoped rather than relying on the policy alone, so a mismatch
    // shows as empty rather than as somebody else's numbers.
    const res = await supabase
      .from('costs')
      .select('id, vendor, description, amount, purchased_on, recurrence, kind')
      .eq('org_id', org.id)
      .is('job_id', null)
      .order('purchased_on', { ascending: false });

    if (res.error) setError(res.error.message);
    else
      setRows(
        (res.data ?? []).map((r: Record<string, unknown>) => ({
          ...(r as unknown as Overhead),
          amount: num(r.amount),
          recurrence: (r.recurrence as string) || 'once',
        }))
      );
    setLoading(false);
  }, [org]);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setVendor('');
    setDescription('');
    setAmount('');
    setRecurrence('monthly');
    setPurchasedOn(today());
  };

  const add = async () => {
    if (!org || !vendor.trim() || !parseFloat(amount)) return;
    setBusy(true);
    setError(null);
    const res = await supabase.from('costs').insert({
      org_id: org.id,
      job_id: null,
      kind: 'overhead',
      vendor: vendor.trim(),
      description: description.trim() || null,
      amount: parseFloat(amount),
      purchased_on: purchasedOn,
      recurrence,
      // Overheads are never billable — there is no customer who caused them.
      billable: false,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    reset();
    setAdding(false);
    await load();
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    const res = await supabase.from('costs').delete().eq('id', confirmDelete.id);
    setBusy(false);
    setConfirmDelete(null);
    if (res.error) setError(res.error.message);
    else await load();
  };

  const monthly = rows.reduce((s, r) => s + perMonth(r.amount, r.recurrence), 0);
  const subs = rows.filter((r) => r.recurrence !== 'once').length;
  const oneOffTotal = rows
    .filter((r) => r.recurrence === 'once')
    .reduce((s, r) => s + r.amount, 0);

  return (
    <Page
      title="Overheads"
      subtitle="What it costs to keep the business open, separate from any one job."
      action={
        !adding ? <Button onClick={() => setAdding(true)}>Add an expense</Button> : undefined
      }
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      {adding && (
        <Card style={{ maxWidth: 560, marginBottom: 18 }}>
          <SectionLabel>New expense</SectionLabel>
          <div style={{ marginTop: 12 }}>
            <Field label="Who it goes to">
              <input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                style={inputStyle}
                placeholder="Supabase"
                autoFocus
              />
            </Field>

            <Field label="What it's for (optional)">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={inputStyle}
                placeholder={`Database and hosting for ${PRODUCT}`}
              />
            </Field>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px' }}>
                <Field label="Amount ($)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={inputStyle}
                    placeholder="25.00"
                  />
                </Field>
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <Field label="How often">
                  <select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value)}
                    style={inputStyle}
                  >
                    {RECURRENCE.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <Field label="Starting">
                  <input
                    type="date"
                    value={purchasedOn}
                    onChange={(e) => setPurchasedOn(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={add} disabled={busy || !vendor.trim() || !parseFloat(amount)}>
                {busy ? 'Saving…' : 'Add expense'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  reset();
                  setAdding(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <Card><Empty>Loading…</Empty></Card>
      ) : rows.length === 0 ? (
        <Card>
          <Empty>
            Nothing recorded yet. This is where software subscriptions, insurance, fuel and
            anything else that isn&apos;t caused by one particular job belongs — so Profit &amp;
            Loss shows what the business actually made, not just what the work earned.
          </Empty>
        </Card>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <Metric
              label="Every month"
              value={money0(monthly)}
              hint="Recurring costs, normalized"
            />
            <Metric label="Every year" value={money0(monthly * 12)} hint="The same, annually" />
            <Metric label="Subscriptions" value={String(subs)} hint="Costs that repeat" />
          </div>

          <SectionLabel>Recorded</SectionLabel>
          <Table>
            <Row cols="1fr 110px 110px 110px 70px" header>
              <div>Expense</div>
              <div>How often</div>
              <div>Amount</div>
              <div>Per month</div>
              <div />
            </Row>
            {rows.map((r) => (
              <Row key={r.id} cols="1fr 110px 110px 110px 70px" labels={['Expense', 'How often', 'Amount', 'Per month', '']}>
                <div>
                  <div style={{ fontWeight: 500 }}>{r.vendor}</div>
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 2 }}>
                    {r.description || 'No description'} · from {shortDate(r.purchased_on)}
                  </div>
                </div>
                <div>
                  <Pill tone={r.recurrence === 'once' ? 'neutral' : 'blue'}>
                    {RECURRENCE_LABEL[r.recurrence] ?? r.recurrence}
                  </Pill>
                </div>
                <div>{money(r.amount)}</div>
                <div style={{ color: C.dim }}>
                  {r.recurrence === 'once' ? '—' : money(perMonth(r.amount, r.recurrence))}
                </div>
                <div>
                  <Button variant="danger" onClick={() => setConfirmDelete(r)}>
                    Delete
                  </Button>
                </div>
              </Row>
            ))}
          </Table>

          {oneOffTotal > 0 && (
            <div style={{ fontSize: 12, color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
              Plus {money(oneOffTotal)} of one-off costs, which aren&apos;t counted in the monthly
              figure above.
            </div>
          )}
        </>
      )}

      {confirmDelete && (
        <Confirm
          title={`Delete ${confirmDelete.vendor}?`}
          body="This removes it from your overheads and from Profit & Loss."
          confirmLabel="Delete"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </Page>
  );
}
