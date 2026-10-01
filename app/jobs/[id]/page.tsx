'use client';

/**
 * Job detail — the cockpit.
 *
 * Everything about one job in one place: what it's worth, what's been spent,
 * what's unbilled, and the one button that turns unbilled work into an invoice.
 */

import { Schedule } from '@/components/spine/Schedule';
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
  invoiceFromEstimate,
  listEstimates,
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
  Estimate,
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
  RowsLoading,
  SectionHead,
  SectionLabel,
  Select,
  Skeleton,
  Table,
  TilesLoading,
  hours as fmtHours,
  inputStyle,
  money,
  money0,
  shortDate,
  today,
  useIsPhone,
} from '@/components/spine/ui';
import { JobFacts } from '@/components/spine/JobFacts';
import { JobActions, JOB_BAR } from '@/components/spine/JobActions';
import { JobNotes } from '@/components/spine/JobNotes';
import { Confirm } from '@/components/spine/Confirm';
import { UndoBar, type UndoState } from '@/components/spine/Undo';
import { useOrg } from '@/lib/spine/org';
import { useReadOnly } from '@/lib/spine/viewas';
import { Reminders } from '@/components/spine/Reminders';
import { READ_FAILED, human } from '@/lib/spine/errors';
import { tidyAddress } from '@/lib/spine/tidy';

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
  const { vocab } = useOrg();
  const readOnly = useReadOnly();
  const router = useRouter();
  const jobId = params.id;
  const phone = useIsPhone();
  /* Bumped when the action bar writes something, so the notes list re-reads. */
  const [notesTick, setNotesTick] = useState(0);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [defaultRate, setDefaultRate] = useState(0);
  const [job, setJob] = useState<JobWithCustomer | null>(null);
  const [ledger, setLedger] = useState<JobLedger | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [invoices, setInvoices] = useState<JobInvoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showTime, setShowTime] = useState(false);
  const [showCost, setShowCost] = useState(false);
  const [confirming, setConfirming] = useState<
    { kind: 'time' | 'cost'; id: string; label: string } | null
  >(null);
  const [undo, setUndo] = useState<UndoState | null>(null);

  const load = useCallback(async () => {
    const [org, j, l, t, c, inv, d, est] = await Promise.all([
      getCurrentOrg(),
      getJob(jobId),
      getJobLedger(jobId),
      listTimeEntries(jobId),
      listCosts(jobId),
      listInvoices(jobId),
      listDocuments({ jobId }),
      listEstimates(jobId),
    ]);
    setOrgId(org?.id ?? null);
    setDefaultRate(Number(org?.default_labor_rate ?? 0));
    setJob(j);
    setLedger(l);
    setEntries(t);
    setCosts(c);
    setInvoices(inv);
    setDocs(d);
    setEstimates(est);
  }, [jobId]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!canceled) setError(human((e as Error).message, READ_FAILED));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
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
      setError(human((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Page title={<Skeleton w={340} h={27} style={{ maxWidth: '100%' }} />} back={{ label: vocab.jobPlural, href: '/jobs' }}>
        <Skeleton w={210} h={12} style={{ marginBottom: 22, maxWidth: '100%' }} />
        <TilesLoading count={6} />
        <div style={{ marginTop: 26 }}><RowsLoading rows={3} /></div>
      </Page>
    );
  }
  if (!job) {
    return (
      <Page title={`${vocab.job} not found`}>
        <Card><Empty>That {vocab.job.toLowerCase()} doesn&apos;t exist, or you don&apos;t have access to it.</Empty></Card>
      </Page>
    );
  }

  const unbilled = ledger ? ledger.unbilled_labor + ledger.unbilled_cost : 0;
  const outstanding = ledger ? ledger.invoiced_total - ledger.collected : 0;
  const isTM = job.billing_type === 'tm';

  /**
   * Turn the accepted quote into an invoice.
   *
   * Itemised from what they agreed to, not retyped, so the invoice and the
   * quote cannot drift apart. The underlying function already refuses to bill
   * more than the contract in total, which is the one mistake in progress
   * billing you cannot apologize your way out of.
   */
  const billFromEstimate = async () => {
    setBusy(true);
    setError(null);
    try {
      const orgId = job?.org_id;
      if (!orgId) throw new Error(`No business on this ${vocab.job.toLowerCase()}.`);
      const inv = await invoiceFromEstimate(orgId, jobId);
      router.push(`/billing?invoice=${inv.id}`);
    } catch (e) {
      setError(human((e as Error).message));
      setBusy(false);
    }
  };

  const sendEstimate = async (est: Estimate) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/estimates/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimateId: est.id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not send');
      setNotice(payload.message ?? 'Sent.');
      if (payload.link) {
        await navigator.clipboard.writeText(payload.link).catch(() => {});
      }
      await load();
    } catch (e) {
      setError(human((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const handleDraftInvoice = () =>
    run(async () => {
      if (!orgId) throw new Error('No organization on your profile.');
      const inv = await draftInvoiceFromActuals(orgId, jobId);
      if (!inv) throw new Error(`Nothing unbilled on this ${vocab.job.toLowerCase()} yet.`);
    }, 'Draft invoice created from unbilled work.');

  return (
    <Page
      back={{ label: vocab.jobPlural, href: '/jobs' }}
      title={job.name}
      /* On a phone the facts card below says all of this, bigger and
         tappable. Two copies of an address is one of them being ignored. */
      subtitle={
        phone
          ? undefined
          : [job.customer?.name, tidyAddress(job.address)].filter(Boolean).join(' · ') || undefined
      }
      action={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* The back link at the top of this page already goes to /jobs.
              Two controls, one destination, opposite corners of the same
              header — the same duplicate the client screen had. */}

          {/*
            A greyed-out button reading "Nothing to invoice" looks like a
            control that is broken rather than a statement of fact. When there
            is something to bill it is a button; when there is not, it is a
            sentence.
          */}
          {unbilled > 0 ? (
            <Button onClick={handleDraftInvoice} disabled={busy}>
              Invoice {money0(unbilled)}
            </Button>
          ) : (
            <span style={{ fontSize: 13, color: C.faint, alignSelf: 'center' }}>
              Nothing to invoice yet
            </span>
          )}
        </div>
      }
    >
      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}
      {notice && (
        <Card style={{ borderColor: `${C.green}55`, marginBottom: 16 }}>
          <div style={{ color: C.green, fontSize: 14 }}>{notice}</div>
        </Card>
      )}

      <UndoBar undo={undo} onDone={() => setUndo(null)} />

      {/*
        What you need before you touch anything else, on a phone.

        The desktop header puts the customer and address in a grey subtitle
        line, which is right at a desk and wrong on a roof: it is unreadable
        at arm's length, and the address is the one thing somebody wants to
        act on rather than read. On a phone the same four facts come first,
        at size, with the address and the number as taps.
      */}
      {phone && (
        <Card style={{ marginBottom: 14 }}>
          <JobFacts
            job={job}
            next={unbilled > 0 ? `${money0(unbilled)} not yet invoiced` : null}
          />
        </Card>
      )}


      {confirming && (
        <Confirm
          /*
            The title names what is about to go.

            "Delete these hours?" is a question about a row you can no longer
            see, because the dialog is covering it. The label is already built
            from the row, so it belongs in the sentence you are answering.

            And it does not say "this cannot be undone", because it can: both
            branches below keep the row and offer Undo. A warning that is not
            true is how people learn to stop reading them.
          */
          title={`Delete ${confirming.label}?`}
          body={`It comes off the ${vocab.job.toLowerCase()} and off anything not yet invoiced. You can undo it straight after.`}
          confirmLabel="Delete"
          busy={busy}
          onConfirm={() =>
            run(async () => {
              // Keep the row before removing it, so Undo can restore the same
              // values rather than an approximation of them.
              if (confirming.kind === 'time') {
                const row = entries.find((x) => x.id === confirming.id);
                await deleteTimeEntry(confirming.id);
                if (row && orgId) {
                  setUndo({
                    message: 'Hours deleted.',
                    restore: async () => {
                      await createTimeEntry(orgId, jobId, {
                        worked_on: row.worked_on,
                        hours: row.hours,
                        rate: row.rate,
                        worker_name: row.worker_name ?? undefined,
                        description: row.description ?? undefined,
                      });
                      await load();
                    },
                  });
                }
              } else {
                const row = costs.find((x) => x.id === confirming.id);
                await deleteCost(confirming.id);
                if (row && orgId) {
                  setUndo({
                    message: 'Cost deleted.',
                    restore: async () => {
                      await createCost(orgId, jobId, {
                        amount: row.amount,
                        purchased_on: row.purchased_on,
                        kind: row.kind,
                        vendor: row.vendor ?? undefined,
                        description: row.description ?? undefined,
                        document_id: row.document_id ?? undefined,
                        markup_pct: row.markup_pct ?? undefined,
                      });
                      await load();
                    },
                  });
                }
              }
              setConfirming(null);
            })
          }
          onCancel={() => setConfirming(null)}
        />
      )}

      {/*
        Status, billing type and the two date pickers.

        Hidden on a phone, not rearranged: the row is a 160px dropdown, two
        pills, a sentence and two date inputs pushed to the right with
        `marginLeft: auto`, which at 390px stacks into six rows of chrome
        above the actual job. Status moves to the bar at the bottom where the
        thumb is; scheduling a job is desk work and stays there.
      */}
      <div style={{ display: phone ? 'none' : 'flex', gap: 10, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
        <Select
          value={job.status}
          disabled={busy}
          onChange={(v) =>
            run(async () => {
              await updateJob(jobId, { status: v as JobStatus });
            })
          }
          style={{ width: 'auto', minWidth: 160 }}
          options={STATUSES.map((s) => ({ value: s, label: JOB_STATUS_LABEL[s] }))}
        />
        <Pill tone={isTM ? 'blue' : 'neutral'}>
          {isTM ? 'Time & materials' : 'Fixed price'}
        </Pill>
        {isTM && (
          <span style={{ fontSize: 12.5, color: C.faint }}>
            Billed from actual hours and receipts
          </span>
        )}

        {/* Dates feed the calendar subscription, a job with no dates simply
            doesn't appear there. */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
          <span style={{ fontSize: 12.5, color: C.faint }}>Scheduled</span>
          {/* Two date boxes that write straight through on change. Nothing
              about them says "field" loudly enough to have been caught by the
              primitives, and a stray click sets a client's dates. */}
          <input
            type="date"
            disabled={readOnly}
            value={job.scheduled_start ?? ''}
            onChange={(e) =>
              run(async () => { await updateJob(jobId, { scheduled_start: e.target.value || null }); })
            }
            style={{ ...inputStyle, width: 'auto', padding: '6px 8px', fontSize: 13 }}
          />
          <span style={{ fontSize: 12.5, color: C.faint }}>to</span>
          <input
            type="date"
            disabled={readOnly}
            value={job.scheduled_end ?? ''}
            onChange={(e) =>
              run(async () => { await updateJob(jobId, { scheduled_end: e.target.value || null }); })
            }
            style={{ ...inputStyle, width: 'auto', padding: '6px 8px', fontSize: 13 }}
          />
        </div>
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
        {/*
          One label for one number, and the hint says what kind of number it is.

          This read "Estimate" on a time-and-materials job and "Contract" on a
          fixed-price one, which named the same figure - the accepted
          proposal's total - two different ways, and said "Estimate" on a
          screen whose sidebar says Proposals. The difference the two labels
          were reaching for is not what the number is, it is whether it binds,
          and that is a sentence rather than a noun.
        */}
        <Metric
          label={vocab.estimate}
          value={money0(ledger?.estimate_total ?? 0)}
          hint={isTM ? 'Forecast, not a cap' : 'Fixed price, and the cap'}
        />
        <Metric label="Hours logged" value={fmtHours(ledger?.hours_logged ?? 0)} />
        <Metric label="Costs" value={money0(ledger?.cost_total ?? 0)} hint={`What the ${vocab.job.toLowerCase()} cost you`} />
        <Metric
          label="Unbilled"
          value={money0(unbilled)}
          tone={unbilled > 0 ? 'amber' : undefined}
        />
        <Metric
          label="Outstanding"
          value={money0(outstanding)}
          tone={outstanding > 0 ? 'red' : undefined}
        />
        <Metric
          label="Margin to date"
          value={money0(ledger?.margin_to_date ?? 0)}
          tone={(ledger?.margin_to_date ?? 0) >= 0 ? 'green' : 'red'}
          hint="Invoiced minus costs"
        />
      </div>

      {/*
        The schedule is its own block.
        
        It was rendered inside the Hours header, a space-between row built to
        hold a label and a button, so a whole component with its own steps and
        dates was squeezed in beside the word "Hours" and pushed the button off
        its own line.
      */}
      {orgId && (
        <div style={{ marginBottom: 26 }}>
          <Schedule orgId={orgId} jobId={jobId} />
        </div>
      )}

      {/* Labor */}
      <div style={{ marginBottom: 26 }}>
        <SectionHead
          action={
            <Button variant="ghost" onClick={() => setShowTime((v) => !v)}>
              {showTime ? 'Cancel' : 'Log hours'}
            </Button>
          }
        >
          Hours
        </SectionHead>

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

        {/*
          Column headings over nothing.

          Date, Work, Hours, Rate, Value, drawn above the sentence "No hours
          logged yet." A header describes rows. With no rows it is five words
          of furniture and a ruled line, which is how an empty job ends up
          looking like a broken table.
        */}
        <Table>
          {entries.length > 0 && (
            <Row cols="100px 1fr 90px 90px 110px 88px" header>
              <div>Date</div><div>Work</div><div>Hours</div><div>Rate</div><div>Value</div><div />
            </Row>
          )}
          {entries.length === 0 ? (
            <Empty>No hours logged yet.</Empty>
          ) : (
            entries.map((e) => (
              <Row key={e.id} cols="100px 1fr 90px 90px 110px 88px">
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
                    /*
                      A word, not a glyph.

                      This was a bare × with the word only in a title
                      attribute, which is a tooltip nobody on a phone can
                      reach. A destructive control has to say what it does
                      where you can read it.
                    */
                    <Button
                      variant="danger"
                      onClick={() =>
                        setConfirming({
                          kind: 'time',
                          id: e.id,
                          label: `${fmtHours(e.hours)} on ${job.name}`,
                        })
                      }
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Row>
            ))
          )}
        </Table>
      </div>

      {/* Costs */}
      <div style={{ marginBottom: 26 }}>
        <SectionHead
          action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Goes to another screen rather than doing something here, so it
                reads as a link. Two ghost buttons side by side say the two
                acts are alike; one of them leaves the page. */}
            <button
              onClick={() => router.push('/documents')}
              style={{
                background: 'transparent', border: 'none', padding: '6px 4px',
                color: C.dim, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Add from receipt
            </button>
            <Button variant="ghost" onClick={() => setShowCost((v) => !v)}>
              {showCost ? 'Cancel' : 'Add cost'}
            </Button>
          </div>
          }
        >
          Costs
        </SectionHead>

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
          {costs.length > 0 && (
            <Row cols="100px 1fr 130px 110px 88px" header>
              <div>Date</div><div>What</div><div>Type</div><div>Amount</div><div />
            </Row>
          )}
          {costs.length === 0 ? (
            <Empty>No costs yet. Receipts dropped in Documents land here.</Empty>
          ) : (
            costs.map((c) => (
              <Row key={c.id} cols="100px 1fr 130px 110px 88px">
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
                    <Button
                      variant="danger"
                      onClick={() =>
                        setConfirming({
                          kind: 'cost',
                          id: c.id,
                          label: `${c.description || c.vendor || 'cost'}, ${money(c.amount)}`,
                        })
                      }
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Row>
            ))
          )}
        </Table>
      </div>

      {job?.org_id && <Reminders orgId={job.org_id} jobId={jobId} />}

      {/* Estimates */}
      <div style={{ marginBottom: 26 }}>
        <SectionHead
          action={
            <Button variant="ghost" onClick={() => router.push(`/jobs/${jobId}/estimate`)}>
              New estimate
            </Button>
          }
        >
          {vocab.estimate}
        </SectionHead>
        {estimates.length === 0 ? (
          <Card><Empty>No {vocab.estimate.toLowerCase()} yet.</Empty></Card>
        ) : (
          <Table>
            <Row cols="70px 1fr 140px 200px" header>
              <div>Version</div><div>Total</div><div>Status</div><div />
            </Row>
            {estimates.map((e) => (
              <Row key={e.id} cols="70px 1fr 140px 200px">
                <div style={{ color: C.dim }}>#{e.version}</div>
                <div>{money(e.total)}</div>
                <div>
                  <Pill
                    tone={
                      e.status === 'accepted' ? 'green'
                      : e.status === 'declined' ? 'red'
                      : e.status === 'sent' ? 'blue'
                      : 'neutral'
                    }
                  >
                    {e.status}
                  </Pill>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['draft', 'sent'].includes(e.status) && (
                    <Button onClick={() => sendEstimate(e)} disabled={busy}>
                      {e.status === 'sent' ? 'Resend' : `Send to ${vocab.customer.toLowerCase()}`}
                    </Button>
                  )}
                  {/*
                    The step that was missing. An accepted quote was a dead
                    end: the customer said yes and there was no way to turn
                    that into a bill without rebuilding it by hand, which is
                    exactly where the numbers stop matching what was agreed.
                  */}
                  {e.status === 'accepted' && (
                    <Button onClick={() => billFromEstimate()} disabled={busy}>
                      Create invoice
                    </Button>
                  )}
                </div>
              </Row>
            ))}
          </Table>
        )}
      </div>

      {/* Invoices */}
      <div style={{ marginBottom: 26 }}>
        <SectionLabel>Invoices</SectionLabel>
        <Table>
          {invoices.length > 0 && (
            <Row cols="110px 1fr 130px 110px" header>
              <div>Number</div><div>Period</div><div>Status</div><div>Total</div>
            </Row>
          )}
          {invoices.length === 0 ? (
            <Empty>No invoices yet.</Empty>
          ) : (
            invoices.map((i) => (
              <Row key={i.id} cols="110px 1fr 130px 110px" onClick={() => router.push('/billing')}>
                <div>{i.number}</div>
                <div style={{ color: C.dim }}>
                  {i.period_start ? `${shortDate(i.period_start)} – ${shortDate(i.period_end)}` : '–'}
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
          <Card><Empty>Nothing filed to this {vocab.job.toLowerCase()} yet.</Empty></Card>
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
                  fontSize: 13,
                  color: C.dim,
                }}
              >
                {d.file_name}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Room under the last card for the bar that floats over it. */}
      <JobNotes jobId={jobId} customerId={job.customer_id ?? null} refresh={notesTick} />

      {phone && <div style={{ height: JOB_BAR + 8 }} />}

      {phone && (
        <JobActions
          job={job}
          orgId={job.org_id}
          onStatus={(next) => run(async () => { await updateJob(jobId, { status: next }); })}
          onChanged={() => { void load(); setNotesTick((n) => n + 1); }}
        />
      )}
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
          <input value={worker} onChange={(e) => setWorker(e.target.value)} style={inputStyle} placeholder="A name" />
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
        <input value={desc} onChange={(e) => setDesc(e.target.value)} style={inputStyle} placeholder="Lumber, framing" />
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
