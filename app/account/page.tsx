'use client';

/**
 * Your account — what a client owes their agency.
 *
 * This is Mammoth's view of CALO&CO's work: every hour logged against them,
 * what it adds up to, what's been invoiced, and what's outstanding.
 *
 * Showing the individual time entries is the whole point rather than a
 * courtesy. "$4,200 this month" invites an argument; "Tue 12 Mar, 3.5h,
 * rebuilt the quote form" ends one. Trust is cheaper than a dispute.
 *
 * Read-only by construction — the database only exposes billable entries and
 * non-void invoices for engagements billed to this business. Agency costs and
 * margin are never visible.
 */

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import type { JobInvoice, TimeEntry } from '@/lib/spine/types';
import { INVOICE_STATUS_LABEL } from '@/lib/spine/types';
import {
  Button,
  C,
  Card,
  Empty,
  Metric,
  Page,
  Pill,
  Row,
  SectionLabel,
  Table,
  hours as fmtHours,
  money,
  money0,
  shortDate,
} from '@/components/spine/ui';

interface AccountRow {
  job_id: string;
  engagement: string;
  billing_period: string | null;
  last_billed_on: string | null;
  agency_name: string;
  hours_logged: number;
  accruing: number;
  invoiced_total: number;
  paid_total: number;
  owed: number;
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const PERIOD_COPY: Record<string, string> = {
  weekly: 'Billed weekly',
  biweekly: 'Billed every two weeks',
  monthly: 'Billed monthly',
  none: 'Billed as agreed',
};

export default function AccountPage() {
  const { org } = useOrg();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [invoices, setInvoices] = useState<JobInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const acct = await supabase.from('client_account').select('*');
        if (acct.error) throw new Error(acct.error.message);

        const list = (acct.data ?? []).map((r: Record<string, unknown>) => ({
          ...(r as unknown as AccountRow),
          hours_logged: num(r.hours_logged),
          accruing: num(r.accruing),
          invoiced_total: num(r.invoiced_total),
          paid_total: num(r.paid_total),
          owed: num(r.owed),
        })) as AccountRow[];
        setRows(list);

        if (list.length) {
          const jobIds = list.map((r) => r.job_id);
          const [t, i] = await Promise.all([
            supabase
              .from('time_entries')
              .select('*')
              .in('job_id', jobIds)
              .order('worked_on', { ascending: false }),
            supabase
              .from('job_invoices')
              .select('*')
              .in('job_id', jobIds)
              .order('issued_on', { ascending: false }),
          ]);
          if (!t.error) {
            setEntries(
              (t.data ?? []).map((e: Record<string, unknown>) => ({
                ...(e as unknown as TimeEntry),
                hours: num(e.hours),
                rate: num(e.rate),
              }))
            );
          }
          if (!i.error) {
            setInvoices(
              (i.data ?? []).map((v: Record<string, unknown>) => ({
                ...(v as unknown as JobInvoice),
                total: num(v.total),
                amount_paid: num(v.amount_paid),
              }))
            );
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [org?.id]);

  const agency = rows[0]?.agency_name ?? 'your agency';
  const totalOwed = rows.reduce((s, r) => s + r.owed, 0);
  const totalAccruing = rows.reduce((s, r) => s + r.accruing, 0);
  const totalHours = rows.reduce((s, r) => s + r.hours_logged, 0);

  const pay = async (inv: JobInvoice) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/invoices/pay-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not start payment');
      if (payload.url) window.open(payload.url, '_blank', 'noopener');
      else setNotice(payload.message ?? 'No payment link available yet.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title="Your account"
      subtitle={
        rows.length
          ? `Work ${agency} has logged for you, and what's outstanding.`
          : undefined
      }
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}
      {notice && (
        <Card style={{ borderColor: C.blue, marginBottom: 16 }}>
          <div style={{ color: C.blue, fontSize: 13 }}>{notice}</div>
        </Card>
      )}

      {loading ? (
        <Empty>Loading…</Empty>
      ) : rows.length === 0 ? (
        <Card>
          <Empty>
            Nothing billed to you yet. When work is logged against your account it shows up
            here as it happens — not as a surprise at the end of the month.
          </Empty>
        </Card>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 12,
              marginBottom: 26,
            }}
          >
            <Metric label="Outstanding" value={money0(totalOwed)} tone={totalOwed > 0 ? 'amber' : undefined} hint="Invoiced, not yet paid" />
            <Metric label="Accruing" value={money0(totalAccruing)} hint="Logged, not yet invoiced" />
            <Metric label="Hours logged" value={fmtHours(totalHours)} hint="All time" />
          </div>

          {rows.map((r) => (
            <div key={r.job_id} style={{ marginBottom: 10 }}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 500 }}>{r.engagement}</div>
                    <div style={{ fontSize: 11.5, color: C.faint, marginTop: 3 }}>
                      {PERIOD_COPY[r.billing_period ?? 'none'] ?? PERIOD_COPY.none}
                      {r.last_billed_on ? ` · last billed ${shortDate(r.last_billed_on)}` : ''}
                    </div>
                  </div>
                  {r.accruing > 0 && <Pill tone="neutral">{money(r.accruing)} accruing</Pill>}
                </div>
              </Card>
            </div>
          ))}

          <div style={{ marginTop: 26 }}>
            <SectionLabel>Invoices</SectionLabel>
            {invoices.length === 0 ? (
              <Card><Empty>Nothing invoiced yet.</Empty></Card>
            ) : (
              <Table>
                <Row cols="110px 130px 120px 110px 110px" header>
                  <div>Number</div><div>Status</div><div>Due</div><div>Total</div><div />
                </Row>
                {invoices.map((i) => {
                  const outstanding = i.total - i.amount_paid;
                  return (
                    <Row key={i.id} cols="110px 130px 120px 110px 110px">
                      <div>{i.number}</div>
                      <div>
                        <Pill tone={i.status === 'paid' ? 'green' : i.status === 'overdue' ? 'red' : 'blue'}>
                          {INVOICE_STATUS_LABEL[i.status]}
                        </Pill>
                      </div>
                      <div style={{ color: C.dim }}>{shortDate(i.due_on)}</div>
                      <div>{money(i.total)}</div>
                      <div>
                        {outstanding > 0 && i.status !== 'draft' && (
                          <Button onClick={() => pay(i)} disabled={busy}>Pay</Button>
                        )}
                      </div>
                    </Row>
                  );
                })}
              </Table>
            )}
          </div>

          <div style={{ marginTop: 26 }}>
            <SectionLabel>Every hour logged</SectionLabel>
            {entries.length === 0 ? (
              <Card><Empty>No hours logged yet.</Empty></Card>
            ) : (
              <Table>
                <Row cols="100px 1fr 80px 90px 100px" header>
                  <div>Date</div><div>Work</div><div>Hours</div><div>Rate</div><div>Value</div>
                </Row>
                {entries.map((e) => (
                  <Row key={e.id} cols="100px 1fr 80px 90px 100px">
                    <div style={{ color: C.dim }}>{shortDate(e.worked_on)}</div>
                    <div>
                      {e.description || 'Work'}
                      {e.invoiced_on
                        ? <span style={{ marginLeft: 8 }}><Pill tone="neutral">Invoiced</Pill></span>
                        : <span style={{ marginLeft: 8 }}><Pill tone="amber">Not yet billed</Pill></span>}
                    </div>
                    <div>{fmtHours(e.hours)}</div>
                    <div style={{ color: C.dim }}>{money(e.rate)}</div>
                    <div>{money(e.hours * e.rate)}</div>
                  </Row>
                ))}
              </Table>
            )}
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 10, maxWidth: 620, lineHeight: 1.6 }}>
              Every billable hour appears here the day it&apos;s logged, before any invoice is
              raised. If something looks wrong, say so while it&apos;s fresh.
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
