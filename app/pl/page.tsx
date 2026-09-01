'use client';

/**
 * Profit & Loss.
 *
 * Built entirely from the job ledger — logged hours, filed receipts, issued
 * invoices. Nothing is entered here, which means it can't drift from reality;
 * it's only ever as honest as the filing behind it, and it says so.
 *
 * The per-job table is the real point. An average hides the one remodel that
 * went sideways; this names it.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listInvoices, listJobLedger } from '@/lib/spine/db';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import type { JobInvoice, JobLedger } from '@/lib/spine/types';
import { CONSIDERATION_LABEL, JOB_STATUS_LABEL } from '@/lib/spine/types';
import { PRODUCT } from '@/lib/brand';
import {
  Button,
  C,
  Card,
  Empty,
  Metric,
  Page,
  Pill,
  Row,
  DISPLAY,
  SectionLabel,
  Table,
  money,
  money0,
  hours as fmtHours,
} from '@/components/spine/ui';

type Period = 'all' | 'ytd' | 'quarter' | 'month';

const PERIOD_LABEL: Record<Period, string> = {
  month: 'This month',
  quarter: 'This quarter',
  ytd: 'Year to date',
  all: 'All time',
};

/**
 * Takes `now` rather than reading the clock, so nothing time-dependent is
 * computed during render. That is the same mistake that produced the
 * hydration error on the old dashboard.
 */
function periodStart(p: Period, now: Date): Date | null {
  switch (p) {
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    case 'ytd':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return null;
  }
}

export default function ProfitLossPage() {
  const router = useRouter();
  const { vocab, org } = useOrg();
  // Null when nobody has set a rate, which is deliberately different from
  // zero: zero is a decision, null is a question nobody has answered.
  const taxPct = org?.tax_set_aside_pct ?? null;

  const [ledger, setLedger] = useState<JobLedger[]>([]);
  const [invoices, setInvoices] = useState<JobInvoice[]>([]);
  const [period, setPeriod] = useState<Period>('ytd');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Set after mount — never read the clock during render. */
  const [todayMs, setTodayMs] = useState<number | null>(null);
  /** What the system caught, as opposed to what the business earned. */
  const [recovery, setRecovery] = useState<{
    recovered: number;
    recoveredItems: number;
    avgDays: number | null;
    months: number;
  } | null>(null);
  const [overheadMonthly, setOverheadMonthly] = useState(0);


  useEffect(() => setTodayMs(Date.now()), []);

  useEffect(() => {
    (async () => {
      try {
        const [l, inv, rec, oh] = await Promise.all([
          listJobLedger(),
          listInvoices(),
          supabase.from('recovery_metrics').select('*'),
          supabase.from('overhead_summary').select('monthly_run_rate').maybeSingle(),
        ]);

        if (!oh.error && oh.data) setOverheadMonthly(Number(oh.data.monthly_run_rate) || 0);

        if (!rec.error && rec.data?.length) {
          const rows = rec.data as Array<Record<string, unknown>>;
          const n = (v: unknown) => Number(v) || 0;
          const totalItems = rows.reduce((s, r) => s + n(r.items_billed), 0);
          setRecovery({
            recovered: rows.reduce((s, r) => s + n(r.recovered), 0),
            recoveredItems: rows.reduce((s, r) => s + n(r.recovered_items), 0),
            // Weight the average by volume rather than by month, or one quiet
            // month distorts it.
            avgDays: totalItems
              ? rows.reduce((s, r) => s + n(r.avg_days_to_bill) * n(r.items_billed), 0) / totalItems
              : null,
            months: rows.length,
          });
        }
        setLedger(l);
        setInvoices(inv);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Revenue is recognized from issued invoices, so the period filter applies
  // to invoices rather than to jobs — a job spanning two quarters shouldn't
  // land entirely in one.
  const scoped = useMemo(() => {
    const start = todayMs ? periodStart(period, new Date(todayMs)) : null;
    const live = invoices.filter((i) => i.status !== 'void');
    const inPeriod = start
      ? live.filter((i) => i.issued_on && new Date(i.issued_on) >= start)
      : live;

    const revenue = inPeriod.reduce((s, i) => s + i.total, 0);
    const collected = inPeriod.reduce((s, i) => s + i.amount_paid, 0);
    const outstanding = revenue - collected;

    const jobCosts = ledger.reduce((s, r) => s + r.cost_total, 0);
    const unbilled = ledger.reduce((s, r) => s + r.unbilled_labor + r.unbilled_cost, 0);

    /**
     * Overheads for the span being looked at. Recurring costs are held as a
     * monthly figure, so they are spread across the period rather than
     * counted once — a $25 monthly subscription is $75 in a quarter, not $25.
     *
     * "All time" gets twelve months rather than a guess at how long the
     * business has existed. Inventing a longer history would quietly inflate
     * costs and understate profit.
     */
    const months =
      period === 'month'
        ? 1
        : period === 'quarter'
        ? 3
        : period === 'ytd'
        // Months elapsed so far this year, not a full twelve — charging a
        // whole year of subscriptions in February would invent costs.
        ? (todayMs ? new Date(todayMs).getMonth() + 1 : 1)
        : 12;
    const overhead = overheadMonthly * months;
    const costs = jobCosts + overhead;

    /**
     * Money to hold back for tax.
     *
     * Taken off collected rather than invoiced, because you cannot set aside a
     * share of money that has not arrived. An invoice sent in March and paid in
     * June creates the obligation in June, and reserving against it in March is
     * how a business ends up with a number it cannot honor.
     */
    const setAside = taxPct != null ? collected * (taxPct / 100) : null;

    return {
      revenue,
      collected,
      outstanding,
      costs,
      jobCosts,
      overhead,
      unbilled,
      setAside,
      profit: revenue - costs,
      margin: revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0,
      count: inPeriod.length,
    };
  }, [invoices, ledger, period, todayMs, overheadMonthly, taxPct]);

  /**
   * Work being paid for in something other than money.
   *
   * Reported beside the numbers, never inside them. Equity has no defensible
   * dollar value until it has one, and putting a guess into your own profit
   * and loss is how a business talks itself into believing it has been paid.
   *
   * The reason this exists at all is that leaving it out was worse than a gap:
   * a client paying in equity showed nothing invoiced and nothing owed, which
   * is indistinguishable on screen from a client who never paid.
   */
  const nonCash = useMemo(
    () => ledger.filter((r) => r.consideration && r.consideration !== 'cash'),
    [ledger]
  );

  /**
   * Retainers where the hours have run past the fee.
   *
   * The only number a flat monthly can go wrong by. The invoice is identical
   * every month by definition, so nothing in revenue will ever show you the
   * month you worked sixty hours against a fee that assumed twenty. This is
   * that month, named while you can still do something about it.
   */
  const overdelivering = useMemo(
    () => ledger.filter((r) => r.retainer_variance != null && r.retainer_variance < 0),
    [ledger]
  );

  const ranked = useMemo(
    () => [...ledger].sort((a, b) => a.margin_to_date - b.margin_to_date),
    [ledger]
  );

  const losing = ranked.filter((r) => r.margin_to_date < 0);

  return (
    <Page
      title="Profit &amp; Loss"
      subtitle={`Built from logged hours, filed receipts and issued invoices${
        org ? ` for ${org.name}` : ''
      }. Nothing is typed in here.`}
      action={
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          style={{
            background: C.panel,
            border: `1px solid ${C.borderStrong}`,
            borderRadius: 6,
            padding: '9px 12px',
            fontSize: 14,
            color: C.text,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <option key={p} value={p}>{PERIOD_LABEL[p]}</option>
          ))}
        </select>
      }
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}

      {loading ? (
        <Empty>Loading…</Empty>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <Metric
              label="Revenue"
              value={money0(scoped.revenue)}
              hint={`${scoped.count} invoice${scoped.count === 1 ? '' : 's'}`}
            />
            <Metric
              label="Costs"
              value={money0(scoped.costs)}
              hint={
                scoped.overhead > 0
                  ? `${money0(scoped.jobCosts)} jobs + ${money0(scoped.overhead)} overheads`
                  : 'Materials, subs, permits'
              }
            />
            <Metric
              label="Profit"
              value={money0(scoped.profit)}
              tone={scoped.profit >= 0 ? 'green' : 'red'}
              hint={`${scoped.margin.toFixed(0)}% margin`}
            />
            <Metric
              label="Collected"
              value={money0(scoped.collected)}
              tone="green"
              hint="Money actually in"
            />
            <Metric
              label="Owed to you"
              value={money0(scoped.outstanding)}
              tone={scoped.outstanding > 0 ? 'amber' : undefined}
              hint="Invoiced, not paid"
            />
            {/* Sits beside profit rather than inside it. Tax is not a cost of
                doing the work, it is a share of the money that was never
                yours. */}
            <Metric
              label="Hold back for tax"
              value={scoped.setAside == null ? 'Not set' : money0(scoped.setAside)}
              tone={scoped.setAside == null ? undefined : 'amber'}
              hint={
                taxPct == null
                  ? 'Set a rate in Business'
                  : `${taxPct}% of what you collected`
              }
            />
          </div>

          {overdelivering.length > 0 && (
            <Card style={{ marginBottom: 26, borderColor: C.amber, background: C.amberSoft }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.amber, fontWeight: 600, marginBottom: 10 }}>
                Over the retainer ({overdelivering.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {overdelivering.map((r) => (
                  <div key={r.job_id} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 14, color: C.text, fontWeight: 500, flex: 1, minWidth: 160 }}>{r.name}</span>
                    <span style={{ fontSize: 13, color: C.dim, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtHours(r.hours_logged)} against {fmtHours(r.retainer_hours ?? 0)} for {money0(r.retainer_amount ?? 0)}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.amber, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtHours(Math.abs(r.retainer_variance ?? 0))} over
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12.5, color: C.dim, marginTop: 12, lineHeight: 1.6, maxWidth: 620 }}>
                The invoice is the same either way, which is why this never shows up in revenue.
                Either the scope has grown or the fee is wrong, and both are worth raising before
                the next renewal rather than after it.
              </p>
            </Card>
          )}

          {/* Work paid for in something other than money.
              Reported beside the numbers and never inside them, because equity
              has no honest dollar value until it has one. Before this existed,
              a client paying in equity showed nothing invoiced and nothing
              owed, which on screen is indistinguishable from a client who
              never paid at all. */}
          {nonCash.length > 0 && (
            <Card style={{ marginBottom: 26 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.faint, fontWeight: 600, marginBottom: 10 }}>
                Not paid in cash ({nonCash.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {nonCash.map((r) => (
                  <div key={r.job_id} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{r.name}</span>
                    <Pill tone="blue">{CONSIDERATION_LABEL[r.consideration]}</Pill>
                    <span style={{ fontSize: 13, color: C.dim, flex: 1, minWidth: 180 }}>
                      {r.consideration_note || 'No terms recorded'}
                    </span>
                    <span style={{ fontSize: 13, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtHours(r.hours_logged)} logged
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12.5, color: C.faint, marginTop: 12, lineHeight: 1.6, maxWidth: 620 }}>
                Deliberately left out of revenue and profit above. Equity has no defensible dollar
                value until it has one, and a guess in your own accounts is a story rather than a
                number. This is here so the work is not invisible, not so it can be counted.
              </p>
            </Card>
          )}

          {scoped.unbilled > 0 && (
            <Card
              style={{
                marginBottom: 26,
                borderColor: C.amber,
                background: C.amberSoft,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ ...DISPLAY, fontSize: 18, color: C.text }}>
                  {money(scoped.unbilled)} of work you haven&apos;t billed
                </div>
                <div style={{ fontSize: 13.5, color: C.dim, marginTop: 4 }}>
                  Hours logged and receipts filed that never made it onto an invoice. For most
                  contractors this is the biggest single leak.
                </div>
              </div>
              <Button onClick={() => router.push('/jobs')}>Go bill it</Button>
            </Card>
          )}

          {losing.length > 0 && (
            <div style={{ marginBottom: 26 }}>
              <SectionLabel>Losing money right now</SectionLabel>
              <Card style={{ borderColor: C.red, padding: 0 }}>
                {losing.map((r) => (
                  <Row key={r.job_id} cols="1fr 120px 120px" onClick={() => router.push(`/jobs/${r.job_id}`)}>
                    <div>{r.name}</div>
                    <div style={{ color: C.dim }}>{money(r.cost_total)} spent</div>
                    <div style={{ color: C.red }}>{money(r.margin_to_date)}</div>
                  </Row>
                ))}
              </Card>
              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 8 }}>
                A negative margin is normal while a job is running. You spend before you
                bill. It only matters once the job is complete.
              </div>
            </div>
          )}

          {recovery && recovery.recovered > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionLabel>What {PRODUCT} caught</SectionLabel>
              <Card style={{ borderColor: C.green }}>
                <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 26, color: C.green, fontWeight: 500 }}>
                      {money0(recovery.recovered)}
                    </div>
                    <div style={{ fontSize: 13, color: C.dim, marginTop: 3 }}>
                      billed after sitting more than three weeks
                    </div>
                  </div>
                  {recovery.avgDays != null && (
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 500 }}>
                        {recovery.avgDays.toFixed(0)} days
                      </div>
                      <div style={{ fontSize: 13, color: C.dim, marginTop: 3 }}>
                        average from work done to invoice sent
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: C.faint, marginTop: 14, lineHeight: 1.65, maxWidth: 620 }}>
                  {recovery.recoveredItems} item{recovery.recoveredItems === 1 ? '' : 's'} —
                  hours and receipts that were recorded, sat long enough to be at real risk of
                  being forgotten, and then got invoiced.{' '}
                  <strong style={{ color: C.dim }}>
                    This is work the system caught, not revenue it created
                  </strong>{' '}
                  You did the work either way. Anything billed inside three weeks is a normal
                  cycle and isn&apos;t counted.
                </div>
              </Card>
            </div>
          )}

          <SectionLabel>Every {vocab.job.toLowerCase()}, worst first</SectionLabel>
          {ranked.length === 0 ? (
            <Card>
              <Empty>
                No {vocab.jobPlural.toLowerCase()} yet. The P&amp;L fills itself in as you work.
              </Empty>
            </Card>
          ) : (
            <Table>
              <Row cols="1fr 110px 110px 110px 110px" header>
                <div>{vocab.job}</div>
                <div>Invoiced</div>
                <div>Costs</div>
                <div>Unbilled</div>
                <div>Margin</div>
              </Row>
              {ranked.map((r) => {
                const unbilled = r.unbilled_labor + r.unbilled_cost;
                return (
                  <Row
                    key={r.job_id}
                    cols="1fr 110px 110px 110px 110px"
                    onClick={() => router.push(`/jobs/${r.job_id}`)}
                  >
                    <div>
                      {r.name}
                      <span style={{ marginLeft: 8 }}>
                        <Pill tone={r.status === 'complete' ? 'green' : 'neutral'}>
                          {JOB_STATUS_LABEL[r.status]}
                        </Pill>
                      </span>
                    </div>
                    <div>{money(r.invoiced_total)}</div>
                    <div style={{ color: C.dim }}>{money(r.cost_total)}</div>
                    <div style={{ color: unbilled > 0 ? C.amber : C.faint }}>
                      {unbilled > 0 ? money(unbilled) : '—'}
                    </div>
                    <div style={{ color: r.margin_to_date >= 0 ? C.green : C.red }}>
                      {money(r.margin_to_date)}
                    </div>
                  </Row>
                );
              })}
            </Table>
          )}

          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 14, maxWidth: 620, lineHeight: 1.6 }}>
            Revenue counts invoices issued in the period. Costs and margin are lifetime per job,
            so a job spanning two periods shows its full cost here. This is a management view,
            not a tax return. Your accountant will want the real books.
          </div>
        </>
      )}
    </Page>
  );
}
