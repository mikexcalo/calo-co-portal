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
  brandAccent,
  brandOf,
  getInvoiceLines,
  listInvoices,
  listJobs,
  updateInvoice,
  voidInvoice,
} from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
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
  inputStyle,
} from '@/components/spine/ui';
import { METHODS } from '@/lib/spine/payments';

export default function BillingPage() {
  const router = useRouter();
  const { org } = useOrg();
  // Client-facing documents carry the business's brand, not the app's.
  const accent = brandAccent(org, C.blue);
  const logo = brandOf(org).logoLight;
  const [invoices, setInvoices] = useState<JobInvoice[]>([]);
  const [jobs, setJobs] = useState<Record<string, JobWithCustomer>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, JobInvoiceLine[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  /**
   * Hand the invoice to Stripe. Falls back gracefully with a clear message
   * when Stripe isn't configured yet — marking paid by hand still works.
   */
  /**
   * Open exactly what the customer will see.
   *
   * There was no way to look at an invoice before sending it, which meant the
   * first person to see how it turned out was the person being asked for
   * money. Minting the link is harmless: it is unguessable, and it is the same
   * link the send would use.
   */
  const preview = async (inv: JobInvoice) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/invoices/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id, previewOnly: true }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not build a preview');
      if (payload.link) window.open(payload.link, '_blank', 'noopener');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Email the invoice as a link, and notify them in-app if they're on here. */
  const emailInvoice = async (inv: JobInvoice) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/invoices/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not send');
      setNotice(payload.message);
      if (!payload.message?.startsWith('Sent') && payload.link) {
        await navigator.clipboard.writeText(payload.link).catch(() => {});
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Copy a link to the invoice page, where the customer picks how to pay. */
  const sendAsLink = async (inv: JobInvoice) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/invoices/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not send');
      setNotice(payload.message);
      if (payload.link) await navigator.clipboard.writeText(payload.link).catch(() => {});
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendViaStripe = async (inv: JobInvoice) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not send');

      setNotice(
        `${inv.number} sent. The customer can pay online, and it will mark itself paid.`
      );
      if (payload.hostedUrl) window.open(payload.hostedUrl, '_blank', 'noopener');
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
      {notice && (
        <Card style={{ borderColor: `${C.green}55`, marginBottom: 16 }}>
          <div style={{ color: C.green, fontSize: 13 }}>{notice}</div>
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
                <Row cols="100px 1fr 130px 110px 110px" labels={['Number', 'Job', 'Status', 'Total', 'Due']} onClick={() => toggle(inv.id)}>
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
                    {/* Brand marker — the Brand Kit feeding a real document. */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        paddingBottom: 12,
                        marginBottom: 12,
                        borderBottom: `2px solid ${accent}`,
                      }}
                    >
                      {logo && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={logo} alt="" style={{ height: 22, objectFit: 'contain' }} />
                      )}
                      <span style={{ fontSize: 12, color: C.dim }}>
                        {org?.name} · {inv.number}
                      </span>
                    </div>
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
                        <Button variant="ghost" disabled={busy} onClick={() => preview(inv)}>
                          Preview
                        </Button>
                        {inv.status === 'draft' && (
                          <>
                            {/* Default: email a link listing every method they
                                accept. Stripe stays available for anyone who
                                wants instant card payment, but it is no
                                longer the only way to send a bill. */}
                            <Button disabled={busy} onClick={() => emailInvoice(inv)}>
                              Email invoice
                            </Button>
                            <Button variant="ghost" disabled={busy} onClick={() => sendAsLink(inv)}>
                              Copy link
                            </Button>
                            <Button variant="ghost" disabled={busy} onClick={() => sendViaStripe(inv)}>
                              Send via Stripe
                            </Button>
                            <Button
                              variant="ghost"
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
                              Mark sent by hand
                            </Button>
                          </>
                        )}
                        {['sent', 'partial', 'overdue'].includes(inv.status) && (
                          <select
                            defaultValue=""
                            disabled={busy}
                            onChange={(e) => {
                              const via = e.target.value;
                              if (!via) return;
                              act(async () => {
                                await updateInvoice(inv.id, {
                                  status: 'paid',
                                  amount_paid: inv.total,
                                  paid_at: new Date().toISOString(),
                                  // Knowing HOW it arrived is what tells you
                                  // later whether card fees were worth paying.
                                  paid_via: via,
                                });
                              });
                            }}
                            style={{ ...inputStyle, width: 'auto', padding: '8px 10px' }}
                          >
                            <option value="">Mark paid by…</option>
                            {METHODS.map((m) => (
                              <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                          </select>
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

                    {/* Card fees are a percentage, so on a big invoice the
                        difference is real money. Worth saying at the moment
                        the invoice goes out, not in a settings page. */}
                    {inv.total >= 2000 && inv.status !== 'paid' && inv.status !== 'void' && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: 10,
                          borderRadius: 6,
                          background: C.amberSoft,
                          fontSize: 11.5,
                          color: C.amber,
                          lineHeight: 1.6,
                        }}
                      >
                        On {money(inv.total)}, card fees run about{' '}
                        <strong>{money(inv.total * 0.029 + 0.3)}</strong>. Bank transfer costs
                        about <strong>{money(Math.min(inv.total * 0.008, 5))}</strong> — a
                        difference of {money(inv.total * 0.029 + 0.3 - Math.min(inv.total * 0.008, 5))}.
                        Worth asking for on invoices this size.
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
