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
import { JOB_STATUS_LABEL } from '@/lib/spine/types';
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
  SERIF,
  SectionLabel,
  Table,
  money,
  money0,
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

    return {
      revenue,
      collected,
      outstanding,
      costs,
      jobCosts,
      overhead,
      unbilled,
      profit: revenue - costs,
      margin: revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0,
      count: inPeriod.length,
    };
  }, [invoices, ledger, period, todayMs, overheadMonthly]);

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
            fontSize: 13,
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
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
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
          </div>

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
                <div style={{ fontFamily: SERIF, fontSize: 18, color: C.text }}>
                  {money(scoped.unbilled)} of work you haven&apos;t billed
                </div>
                <div style={{ fontSize: 12.5, color: C.dim, marginTop: 4 }}>
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
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 8 }}>
                A negative margin is normal while a job is still running — you spend before you
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
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>
                      billed after sitting more than three weeks
                    </div>
                  </div>
                  {recovery.avgDays != null && (
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 500 }}>
                        {recovery.avgDays.toFixed(0)} days
                      </div>
                      <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>
                        average from work done to invoice sent
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: C.faint, marginTop: 14, lineHeight: 1.65, maxWidth: 620 }}>
                  {recovery.recoveredItems} item{recovery.recoveredItems === 1 ? '' : 's'} —
                  hours and receipts that were recorded, sat long enough to be at real risk of
                  being forgotten, and then got invoiced.{' '}
                  <strong style={{ color: C.dim }}>
                    This is work the system caught, not revenue it created
                  </strong>{' '}
                  — you did the work either way. Anything billed inside three weeks is a normal
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

          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 14, maxWidth: 620, lineHeight: 1.6 }}>
            Revenue counts invoices issued in the period. Costs and margin are lifetime per job,
            so a job spanning two periods shows its full cost here. This is a management view,
            not a tax return — your accountant will want the real books.
          </div>
        </>
      )}
    </Page>
  );
}
