'use client';

/**
 * Billing — every invoice across every job.
 *
 * Invoices are drafted from actuals on the job page; this is where they get
 * sent, marked paid, or voided. Voiding releases the underlying hours and
 * receipts back to unbilled so they can be re-invoiced rather than lost.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getInvoiceLines,
  listInvoices,
  listJobs,
  updateInvoice,
  voidInvoice,
} from '@/lib/spine/db';
import { INVOICE_STATUS_LABEL } from '@/lib/spine/types';
import type { JobInvoice, JobInvoiceLine, JobWithCustomer } from '@/lib/spine/types';
import {
  Button,
  C,
  Card,
  Empty,
  Metric,
  Page,
  Pill,
  Row,
  Table,
  money,
  money0,
  shortDate,
} from '@/components/spine/ui';

export default function BillingPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<JobInvoice[]>([]);
  const [jobs, setJobs] = useState<Record<string, JobWithCustomer>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, JobInvoiceLine[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [inv, j] = await Promise.all([listInvoices(), listJobs()]);
    setInvoices(inv);
    setJobs(Object.fromEntries(j.map((job) => [job.id, job])));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const toggle = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!lines[id]) {
      try {
        const l = await getInvoiceLines(id);
        setLines((prev) => ({ ...prev, [id]: l }));
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const live = invoices.filter((i) => i.status !== 'void');
  const outstanding = live.reduce((s, i) => s + (i.total - i.amount_paid), 0);
  const collected = live.reduce((s, i) => s + i.amount_paid, 0);
  const drafts = live.filter((i) => i.status === 'draft').length;

  return (
    <Page title="Billing" subtitle="Invoices built from logged hours and filed receipts.">
      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
          marginBottom: 26,
        }}
      >
        <Metric label="Outstanding" value={money0(outstanding)} tone={outstanding > 0 ? 'blue' : undefined} />
        <Metric label="Collected" value={money0(collected)} tone="green" />
        <Metric label="Drafts" value={String(drafts)} tone={drafts > 0 ? 'amber' : undefined} hint="Not sent yet" />
      </div>

      {loading ? (
        <Empty>Loading…</Empty>
      ) : invoices.length === 0 ? (
        <Card>
          <Empty>
            No invoices yet. Open a job with unbilled work and draft one from its actuals.
          </Empty>
        </Card>
      ) : (
        <Table>
          <Row cols="100px 1fr 130px 110px 110px" header>
            <div>Number</div><div>Job</div><div>Status</div><div>Total</div><div>Due</div>
          </Row>

          {invoices.map((inv) => {
            const job = jobs[inv.job_id];
            const isOpen = expanded === inv.id;
            return (
              <div key={inv.id}>
                <Row cols="100px 1fr 130px 110px 110px" onClick={() => toggle(inv.id)}>
                  <div>{inv.number}</div>
                  <div style={{ color: C.dim }}>{job?.name ?? '—'}</div>
                  <div>
                    <Pill
                      tone={
                        inv.status === 'paid' ? 'green'
                        : inv.status === 'overdue' ? 'red'
                        : inv.status === 'void' ? 'neutral'
                        : inv.status === 'draft' ? 'neutral'
                        : 'blue'
                      }
                    >
                      {INVOICE_STATUS_LABEL[inv.status]}
                    </Pill>
                  </div>
                  <div>{money(inv.total)}</div>
                  <div style={{ color: C.dim }}>{shortDate(inv.due_on)}</div>
                </Row>

                {isOpen && (
                  <div style={{ padding: '14px 18px', background: C.panelAlt, borderBottom: `1px solid ${C.border}` }}>
                    {inv.period_start && (
                      <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 10 }}>
                        Work from {shortDate(inv.period_start)} to {shortDate(inv.period_end)}
                      </div>
                    )}

                    {(lines[inv.id] ?? []).map((l) => (
                      <div
                        key={l.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 80px 90px 100px',
                          gap: 10,
                          fontSize: 12.5,
                          padding: '5px 0',
                          color: C.dim,
                        }}
                      >
                        <div style={{ color: C.text }}>
                          {l.description}
                          {/* The traceability: every line names where it came from */}
                          {l.source_time_entry_id && <span style={{ color: C.faint }}> · from hours</span>}
                          {l.source_cost_id && <span style={{ color: C.faint }}> · from receipt</span>}
                        </div>
                        <div>{l.qty}{l.unit ? ` ${l.unit}` : ''}</div>
                        <div>{money(l.unit_price)}</div>
                        <div style={{ color: C.text }}>{money(l.total)}</div>
                      </div>
                    ))}

                    {!lines[inv.id]?.length && <Empty>No lines on this invoice.</Empty>}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: `1px solid ${C.border}`,
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="ghost" onClick={() => router.push(`/jobs/${inv.job_id}`)}>
                          Open job
                        </Button>
                        {inv.status === 'draft' && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              act(async () => {
                                await updateInvoice(inv.id, {
                                  status: 'sent',
                                  sent_at: new Date().toISOString(),
                                });
                              })
                            }
                          >
                            Mark sent
                          </Button>
                        )}
                        {['sent', 'partial', 'overdue'].includes(inv.status) && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              act(async () => {
                                await updateInvoice(inv.id, {
                                  status: 'paid',
                                  amount_paid: inv.total,
                                  paid_at: new Date().toISOString(),
                                });
                              })
                            }
                          >
                            Mark paid
                          </Button>
                        )}
                        {inv.status !== 'void' && inv.status !== 'paid' && (
                          <Button
                            variant="danger"
                            disabled={busy}
                            onClick={() => act(async () => { await voidInvoice(inv.id); })}
                          >
                            Void
                          </Button>
                        )}
                      </div>

                      <div style={{ fontSize: 13 }}>
                        <span style={{ color: C.faint }}>Total </span>
                        <span style={{ fontWeight: 500 }}>{money(inv.total)}</span>
                      </div>
                    </div>

                    {inv.status !== 'void' && inv.status !== 'paid' && (
                      <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>
                        Voiding returns these hours and receipts to unbilled so they can be re-invoiced.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Table>
      )}
    </Page>
  );
}
