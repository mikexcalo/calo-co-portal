'use client';

/**
 * Job detail — the cockpit.
 *
 * Everything about one job in one place: what it's worth, what's been spent,
 * what's unbilled, and the one button that turns unbilled work into an invoice.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createCost,
  createTimeEntry,
  deleteCost,
  deleteTimeEntry,
  draftInvoiceFromActuals,
  getCurrentOrg,
  getJob,
  getJobLedger,
  listCosts,
  listDocuments,
  listInvoices,
  listTimeEntries,
  updateJob,
} from '@/lib/spine/db';
import {
  COST_KIND_LABEL,
  INVOICE_STATUS_LABEL,
  JOB_STATUS_LABEL,
} from '@/lib/spine/types';
import type {
  Cost,
  DocumentRecord,
  JobInvoice,
  JobLedger,
  JobStatus,
  JobWithCustomer,
  TimeEntry,
} from '@/lib/spine/types';
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
  hours as fmtHours,
  inputStyle,
  money,
  money0,
  shortDate,
  today,
} from '@/components/spine/ui';

const STATUSES: JobStatus[] = [
  'lead',
  'estimating',
  'won',
  'active',
  'complete',
  'closed',
  'lost',
];

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const jobId = params.id;

  const [orgId, setOrgId] = useState<string | null>(null);
  const [defaultRate, setDefaultRate] = useState(0);
  const [job, setJob] = useState<JobWithCustomer | null>(null);
  const [ledger, setLedger] = useState<JobLedger | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [invoices, setInvoices] = useState<JobInvoice[]>([]);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showTime, setShowTime] = useState(false);
  const [showCost, setShowCost] = useState(false);

  const load = useCallback(async () => {
    const [org, j, l, t, c, inv, d] = await Promise.all([
      getCurrentOrg(),
      getJob(jobId),
      getJobLedger(jobId),
      listTimeEntries(jobId),
      listCosts(jobId),
      listInvoices(jobId),
      listDocuments({ jobId }),
    ]);
    setOrgId(org?.id ?? null);
    setDefaultRate(Number(org?.default_labor_rate ?? 0));
    setJob(j);
    setLedger(l);
    setEntries(t);
    setCosts(c);
    setInvoices(inv);
    setDocs(d);
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const run = async (fn: () => Promise<void>, success?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await load();
      if (success) setNotice(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Page title="Loading…"><Empty>Loading job…</Empty></Page>;
  if (!job) {
    return (
      <Page title="Job not found">
        <Card><Empty>That job doesn&apos;t exist, or you don&apos;t have access to it.</Empty></Card>
      </Page>
    );
  }

  const unbilled = ledger ? ledger.unbilled_labor + ledger.unbilled_cost : 0;
  const outstanding = ledger ? ledger.invoiced_total - ledger.collected : 0;
  const isTM = job.billing_type === 'tm';

  const handleDraftInvoice = () =>
    run(async () => {
      if (!orgId) throw new Error('No organization on your profile.');
      const inv = await draftInvoiceFromActuals(orgId, jobId);
      if (!inv) throw new Error('Nothing unbilled on this job yet.');
    }, 'Draft invoice created from unbilled work.');

  return (
    <Page
      title={job.name}
      subtitle={[job.customer?.name, job.address].filter(Boolean).join(' · ') || undefined}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={() => router.push('/jobs')}>All jobs</Button>
          <Button onClick={handleDraftInvoice} disabled={busy || unbilled <= 0}>
            {unbilled > 0 ? `Invoice ${money0(unbilled)}` : 'Nothing to invoice'}
          </Button>
        </div>
      }
    >
      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}
      {notice && (
        <Card style={{ borderColor: `${C.green}55`, marginBottom: 16 }}>
          <div style={{ color: C.green, fontSize: 13 }}>{notice}</div>
        </Card>
      )}

      {/* Status + billing type */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
        <select
          value={job.status}
          disabled={busy}
          onChange={(e) =>
            run(async () => {
              await updateJob(jobId, { status: e.target.value as JobStatus });
            })
          }
          style={{ ...inputStyle, width: 'auto', padding: '7px 10px' }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{JOB_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <Pill tone={isTM ? 'blue' : 'neutral'}>
          {isTM ? 'Time & materials' : 'Fixed price'}
        </Pill>
        {isTM && (
          <span style={{ fontSize: 11.5, color: C.faint }}>
            Billed from actual hours and receipts
          </span>
        )}
      </div>

      {/* The money */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 26,
        }}
      >
        <Metric
          label={isTM ? 'Estimate' : 'Contract'}
          value={money0(ledger?.estimate_total ?? 0)}
          hint={isTM ? 'Forecast, not a cap' : undefined}
        />
        <Metric label="Hours logged" value={fmtHours(ledger?.hours_logged ?? 0)} />
        <Metric label="Costs" value={money0(ledger?.cost_total ?? 0)} hint="What the job cost you" />
        <Metric
          label="Unbilled"
          value={money0(unbilled)}
          tone={unbilled > 0 ? 'amber' : undefined}
        />
        <Metric
          label="Outstanding"
          value={money0(outstanding)}
          tone={outstanding > 0 ? 'blue' : undefined}
        />
        <Metric
          label="Margin to date"
          value={money0(ledger?.margin_to_date ?? 0)}
          tone={(ledger?.margin_to_date ?? 0) >= 0 ? 'green' : 'red'}
          hint="Invoiced minus costs"
        />
      </div>

      {/* Labor */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionLabel>Hours</SectionLabel>
          <Button variant="ghost" onClick={() => setShowTime((v) => !v)}>
            {showTime ? 'Cancel' : 'Log hours'}
          </Button>
        </div>

        {showTime && (
          <Card style={{ marginBottom: 10 }}>
            <TimeForm
              defaultRate={job.labor_rate ?? defaultRate}
              busy={busy}
              onSubmit={(v) =>
                run(async () => {
                  if (!orgId) throw new Error('No organization on your profile.');
                  await createTimeEntry(orgId, jobId, v);
                  setShowTime(false);
                }, 'Hours logged.')
              }
            />
          </Card>
        )}

        <Table>
          <Row cols="100px 1fr 90px 90px 110px 40px" header>
            <div>Date</div><div>Work</div><div>Hours</div><div>Rate</div><div>Value</div><div />
          </Row>
          {entries.length === 0 ? (
            <Empty>No hours logged yet.</Empty>
          ) : (
            entries.map((e) => (
              <Row key={e.id} cols="100px 1fr 90px 90px 110px 40px">
                <div style={{ color: C.dim }}>{shortDate(e.worked_on)}</div>
                <div>
                  {e.description || 'Labor'}
                  {e.worker_name && <span style={{ color: C.faint }}> · {e.worker_name}</span>}
                  {e.invoiced_on && <span style={{ marginLeft: 8 }}><Pill tone="green">Billed</Pill></span>}
                </div>
                <div>{fmtHours(e.hours)}</div>
                <div style={{ color: C.dim }}>{money(e.rate)}</div>
                <div>{money(e.hours * e.rate)}</div>
                <div>
                  {!e.invoiced_on && (
                    <button
                      onClick={() => run(async () => { await deleteTimeEntry(e.id); })}
                      style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 15 }}
                      title="Delete"
                    >×</button>
                  )}
                </div>
              </Row>
            ))
          )}
        </Table>
      </div>

      {/* Costs */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionLabel>Costs</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => router.push('/documents')}>
              Add from receipt
            </Button>
            <Button variant="ghost" onClick={() => setShowCost((v) => !v)}>
              {showCost ? 'Cancel' : 'Add cost'}
            </Button>
          </div>
        </div>

        {showCost && (
          <Card style={{ marginBottom: 10 }}>
            <CostForm
              busy={busy}
              onSubmit={(v) =>
                run(async () => {
                  if (!orgId) throw new Error('No organization on your profile.');
                  await createCost(orgId, jobId, v);
                  setShowCost(false);
                }, 'Cost added.')
              }
            />
          </Card>
        )}

        <Table>
          <Row cols="100px 1fr 130px 110px 40px" header>
            <div>Date</div><div>What</div><div>Type</div><div>Amount</div><div />
          </Row>
          {costs.length === 0 ? (
            <Empty>No costs yet. Receipts dropped in Documents land here.</Empty>
          ) : (
            costs.map((c) => (
              <Row key={c.id} cols="100px 1fr 130px 110px 40px">
                <div style={{ color: C.dim }}>{shortDate(c.purchased_on)}</div>
                <div>
                  {c.description || c.vendor || 'Cost'}
                  {c.document_id && <span style={{ color: C.faint }}> · from receipt</span>}
                  {c.invoiced_on && <span style={{ marginLeft: 8 }}><Pill tone="green">Billed</Pill></span>}
                </div>
                <div style={{ color: C.dim }}>{COST_KIND_LABEL[c.kind]}</div>
                <div>{money(c.amount)}</div>
                <div>
                  {!c.invoiced_on && (
                    <button
                      onClick={() => run(async () => { await deleteCost(c.id); })}
                      style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 15 }}
                      title="Delete"
                    >×</button>
                  )}
                </div>
              </Row>
            ))
          )}
        </Table>
      </div>

      {/* Estimates */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionLabel>Estimate</SectionLabel>
          <Button variant="ghost" onClick={() => router.push(`/jobs/${jobId}/estimate`)}>
            New estimate
          </Button>
        </div>
        <Card>
          {(ledger?.estimate_total ?? 0) > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: C.dim }}>Accepted estimate</span>
              <span style={{ fontSize: 18 }}>{money(ledger?.estimate_total ?? 0)}</span>
            </div>
          ) : (
            <Empty>No accepted estimate yet.</Empty>
          )}
        </Card>
      </div>

      {/* Invoices */}
      <div style={{ marginBottom: 26 }}>
        <SectionLabel>Invoices</SectionLabel>
        <Table>
          <Row cols="110px 1fr 130px 110px" header>
            <div>Number</div><div>Period</div><div>Status</div><div>Total</div>
          </Row>
          {invoices.length === 0 ? (
            <Empty>No invoices yet.</Empty>
          ) : (
            invoices.map((i) => (
              <Row key={i.id} cols="110px 1fr 130px 110px" onClick={() => router.push('/billing')}>
                <div>{i.number}</div>
                <div style={{ color: C.dim }}>
                  {i.period_start ? `${shortDate(i.period_start)} – ${shortDate(i.period_end)}` : '—'}
                </div>
                <div>
                  <Pill tone={i.status === 'paid' ? 'green' : i.status === 'overdue' ? 'red' : i.status === 'draft' ? 'neutral' : 'blue'}>
                    {INVOICE_STATUS_LABEL[i.status]}
                  </Pill>
                </div>
                <div>{money(i.total)}</div>
              </Row>
            ))
          )}
        </Table>
      </div>

      {/* Documents */}
      <div>
        <SectionLabel>Documents ({docs.length})</SectionLabel>
        {docs.length === 0 ? (
          <Card><Empty>Nothing filed to this job yet.</Empty></Card>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {docs.map((d) => (
              <div
                key={d.id}
                style={{
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  padding: '8px 12px',
                  fontSize: 12,
                  color: C.dim,
                }}
              >
                {d.file_name}
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

function TimeForm({
  defaultRate,
  busy,
  onSubmit,
}: {
  defaultRate: number;
  busy: boolean;
  onSubmit: (v: {
    worked_on: string;
    hours: number;
    rate: number;
    worker_name?: string;
    description?: string;
  }) => void;
}) {
  const [workedOn, setWorkedOn] = useState(today());
  const [hrs, setHrs] = useState('');
  const [rate, setRate] = useState(String(defaultRate || ''));
  const [worker, setWorker] = useState('');
  const [desc, setDesc] = useState('');

  const valid = parseFloat(hrs) > 0 && parseFloat(rate) >= 0;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <Field label="Date">
          <input type="date" value={workedOn} onChange={(e) => setWorkedOn(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Hours">
          <input type="number" step="0.25" min="0" value={hrs} onChange={(e) => setHrs(e.target.value)} style={inputStyle} placeholder="8" />
        </Field>
        <Field label="Rate ($/hr)">
          <input type="number" step="1" min="0" value={rate} onChange={(e) => setRate(e.target.value)} style={inputStyle} placeholder="85" />
        </Field>
        <Field label="Who">
          <input value={worker} onChange={(e) => setWorker(e.target.value)} style={inputStyle} placeholder="Mark" />
        </Field>
      </div>
      <Field label="What was done">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} style={inputStyle} placeholder="Framed the bathroom wall" />
      </Field>
      <Button
        disabled={busy || !valid}
        onClick={() =>
          onSubmit({
            worked_on: workedOn,
            hours: parseFloat(hrs),
            rate: parseFloat(rate),
            worker_name: worker || undefined,
            description: desc || undefined,
          })
        }
      >
        Log hours
      </Button>
    </div>
  );
}

function CostForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (v: {
    amount: number;
    purchased_on: string;
    vendor?: string;
    description?: string;
  }) => void;
}) {
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [desc, setDesc] = useState('');

  const valid = parseFloat(amount) > 0;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Amount">
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} placeholder="248.19" />
        </Field>
        <Field label="Vendor">
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} style={inputStyle} placeholder="Home Depot" />
        </Field>
      </div>
      <Field label="What for">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} style={inputStyle} placeholder="Lumber — framing" />
      </Field>
      <Button
        disabled={busy || !valid}
        onClick={() =>
          onSubmit({
            amount: parseFloat(amount),
            purchased_on: date,
            vendor: vendor || undefined,
            description: desc || undefined,
          })
        }
      >
        Add cost
      </Button>
    </div>
  );
}
