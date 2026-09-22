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
import { human } from '@/lib/spine/errors';

export default function BillingPage() {
  const router = useRouter();
  const { org, vocab } = useOrg();
  // Client-facing documents carry the business's brand, not the app's.
  const accent = brandAccent(org, C.blue);
  const logo = brandOf(org).logoLight;
  const [invoices, setInvoices] = useState<JobInvoice[]>([]);
  const [jobs, setJobs] = useState<Record<string, JobWithCustomer>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, JobInvoiceLine[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /** Which invoice has its secondary actions showing. One at a time. */
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [takingPayment, setTakingPayment] = useState<{ inv: JobInvoice; via: string; amount: string } | null>(null);
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
        setError(human((e as Error).message));
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
        setError(human((e as Error).message));
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
      setError(human((e as Error).message));
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
      /*
        The preview opens here.

        It called window.open, so checking an invoice before sending it left a
        CALO&CO tab behind every time — and checking three of them left three.
        The link is same-origin, so the document can be shown in place, which
        is also the honest thing: a preview is a look, not a departure.

        The link is still offered inside the panel for anybody who does want a
        tab, and that is a choice rather than the only behaviour.
      */
      if (payload.link) setPreviewing(payload.link);
      await load();
    } catch (e) {
      setError(human((e as Error).message));
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
      setError(human((e as Error).message));
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
      setError(human((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  /*
    Approve it for the 1st of next month.

    The date is worked out here rather than typed, because "the 1st" is the
    only answer anybody ever gives and a date picker for it is a question
    nobody needs asking.
  */
  const approveForFirst = async (inv: JobInvoice) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const first = new Date();
      first.setDate(1);
      if (new Date().getDate() !== 1) first.setMonth(first.getMonth() + 1);

      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id, sendOn: first.toISOString().slice(0, 10) }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not approve it');
      setNotice(payload.message ?? `${inv.number} is approved.`);
      await load();
    } catch (e) {
      setError(human((e as Error).message));
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
      /*
        Sending should not throw a tab either.

        Preview stopped doing it and this one was left, so pressing Send it
        still put the hosted page in a new tab straight after the notice said
        it had gone. It opens in the same panel Preview uses.
      */
      if (payload.hostedUrl) setPreviewing(payload.hostedUrl);
      await load();
    } catch (e) {
      setError(human((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

    /*
    A draft is not money anybody owes you.

    "live" meant "not void", so every draft invoice counted as outstanding.
    Two drafts that had never left the building put $200 under Owed to you, on
    Home and on Invoices, and the same figure fed Profit and Loss. Nobody had
    been asked for it. Nobody could have paid it.

    Issued means sent. An invoice sitting in draft is a document, not a debt.
  */
  const live = invoices.filter((i) => i.status !== 'void' && i.status !== 'draft');
  const outstanding = live.reduce((s, i) => s + (i.total - i.amount_paid), 0);
  const collected = live.reduce((s, i) => s + i.amount_paid, 0);
  /* From every invoice, because live now deliberately excludes drafts. */
  const drafts = invoices.filter((i) => i.status === 'draft').length;

  return (
    <Page title="Invoices" subtitle="What you have invoiced, and what is still owed.">
      {/*
        The invoice, exactly as the client gets it, without leaving.

        An iframe of the same public link rather than a second rendering of
        the document, so there is nothing here that can drift out of step with
        what is actually sent.
      */}
      {/*
        How much, and by what.

        Offered with the outstanding amount already in it, because that is what
        usually arrives. Typing less records a part payment and leaves the rest
        owed; typing the lot closes it. Either way the status follows the money
        rather than somebody's choice of menu item.
      */}
      {takingPayment && (
        <div
          onClick={() => setTakingPayment(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.panel, borderRadius: 12, padding: 22, width: 'min(380px, 100%)' }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              How much arrived?
            </div>
            <div style={{ fontSize: 13, color: C.faint, marginBottom: 14 }}>
              {takingPayment.inv.number} &middot; {money(takingPayment.inv.total - takingPayment.inv.amount_paid)} outstanding
            </div>
            <input
              value={takingPayment.amount}
              onChange={(e) => setTakingPayment({ ...takingPayment, amount: e.target.value })}
              inputMode="decimal"
              autoFocus
              style={{ ...inputStyle, fontSize: 18 }}
            />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
              <Button
                disabled={busy || !(Number(takingPayment.amount) > 0)}
                onClick={() => {
                  const paid = Number(takingPayment.amount) || 0;
                  const t = takingPayment;
                  setTakingPayment(null);
                  act(async () => {
                    await updateInvoice(t.inv.id, {
                      amount_paid: Math.min(t.inv.amount_paid + paid, t.inv.total),
                      // Knowing HOW it arrived is what tells you later whether
                      // card fees were worth paying.
                      paid_via: t.via,
                    });
                  });
                }}
              >
                Record it
              </Button>
              <button
                onClick={() => setTakingPayment(null)}
                style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {previewing && (
        <div
          onClick={() => setPreviewing(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.panel, borderRadius: 12, overflow: 'hidden',
              width: 'min(880px, 100%)', height: 'min(90vh, 1000px)',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(0,0,0,.3)',
            }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 500, color: C.text, flex: 1 }}>
                What they will see
              </span>
              <a
                href={previewing}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12.5, color: C.dim, textDecoration: 'none' }}
              >
                Open in a tab
              </a>
              <Button variant="ghost" onClick={() => setPreviewing(null)}>Close</Button>
            </div>
            <iframe
              src={previewing}
              title="Invoice preview"
              style={{ flex: 1, border: 'none', width: '100%', background: '#f5f5f3' }}
            />
          </div>
        </div>
      )}

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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
          marginBottom: 26,
        }}
      >
        {/* Owed to you, so red, the same rule as Home. */}
        <Metric label="Outstanding" value={money0(outstanding)} tone={outstanding > 0 ? 'red' : undefined} hideAtZero />
        <Metric label="Collected" value={money0(collected)} tone="green" hideAtZero />
        <Metric label="Drafts" value={String(drafts)} tone={drafts > 0 ? 'amber' : undefined} hint="Not sent yet" hideAtZero />
      </div>

      {loading ? (
        <Empty>Loading…</Empty>
      ) : invoices.length === 0 ? (
        <Card>
          <Empty hero>
            No invoices yet. Open {vocab.jobPlural.toLowerCase()} with unbilled work and draft one from what is on it.
          </Empty>
        </Card>
      ) : (
        <Table>
          {/*
            Whose it is, before what it was for.

            Two invoices both read "Platform and support", both $60, both
            draft, numbered one and two, and nothing on either row said which
            client it belonged to. The number carries the client now (GSP-001,
            MMTH-001) and the name is beside it, because a number you have to
            decode is a number you look up.
          */}
          <Row cols="110px 1.1fr 1fr 120px 100px 100px" header>
            <div>Number</div><div>{vocab.customer}</div><div>{vocab.job}</div>
            <div>Status</div><div>Total</div><div>Due</div>
          </Row>

          {invoices.map((inv) => {
            const job = jobs[inv.job_id];
            const isOpen = expanded === inv.id;
            return (
              <div key={inv.id}>
                <Row cols="110px 1.1fr 1fr 120px 100px 100px" labels={['Number', vocab.customer, vocab.job, 'Status', 'Total', 'Due']} onClick={() => toggle(inv.id)}>
                  <div style={{ fontVariantNumeric: 'tabular-nums' }}>{inv.number}</div>
                  <div>{job?.customer?.name ?? '–'}</div>
                  <div style={{ color: C.dim }}>{job?.name ?? '–'}</div>
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
                  {/*
                    Overdue is a fact about today, not a status somebody sets.

                    The column printed the date in grey whether it had passed
                    or not, so an invoice three weeks late looked exactly like
                    one due next Friday.
                  */}
                  {(() => {
                    const owedNow = inv.total - inv.amount_paid;
                    const late =
                      inv.due_on && owedNow > 0 && inv.status !== 'paid' &&
                      inv.due_on < new Date().toISOString().slice(0, 10);
                    return (
                      <div style={{ color: late ? C.red : C.dim }}>
                        {shortDate(inv.due_on)}
                        {late && <span style={{ fontSize: 12 }}> · overdue</span>}
                      </div>
                    );
                  })()}
                </Row>

                {isOpen && (
                  <div style={{ padding: '14px 18px', background: C.panelAlt, borderBottom: `1px solid ${C.border}` }}>
                    {/* Brand marker, the Brand Kit feeding a real document. */}
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
                      <span style={{ fontSize: 13, color: C.dim }}>
                        {org?.name} · {inv.number}
                      </span>
                    </div>
                    {inv.period_start && (
                      <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 10 }}>
                        Work from {shortDate(inv.period_start)} to {shortDate(inv.period_end)}
                      </div>
                    )}

                    {/*
                      Three numbers with no headings.

                      "1 hour  $60.00  $60.00" is readable once you already
                      know the shape. Nobody checking an invoice for the first
                      time knows which of the last two is the rate.
                    */}
                    {!!lines[inv.id]?.length && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 80px 90px 100px',
                          gap: 10,
                          fontSize: 11,
                          letterSpacing: '.06em',
                          textTransform: 'uppercase',
                          color: C.faint,
                          paddingBottom: 6,
                          borderBottom: `1px solid ${C.border}`,
                          marginBottom: 4,
                        }}
                      >
                        <div>Work</div>
                        <div>Qty</div>
                        <div>Rate</div>
                        <div>Amount</div>
                      </div>
                    )}

                    {(lines[inv.id] ?? []).map((l) => (
                      <div
                        key={l.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 80px 90px 100px',
                          gap: 10,
                          fontSize: 13.5,
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

                    {/*
                      Where a line comes from.

                      A draft is built from hours and receipts filed against the
                      job, and this screen never said so. Somebody looking at a
                      short invoice had no way of knowing whether to fix it here
                      or somewhere else, and there is no somewhere else on this
                      page , the answer is the job. So say it, and open it.
                    */}
                    {inv.status === 'draft' && (
                      <div style={{ fontSize: 12.5, color: C.faint, marginTop: 10, lineHeight: 1.6 }}>
                        Lines come from hours and receipts filed against the job.{' '}
                        <button
                          onClick={() => router.push(`/jobs/${inv.job_id}`)}
                          style={{
                            background: 'transparent', border: 'none', padding: 0,
                            color: C.text, fontSize: 12.5, cursor: 'pointer',
                            fontFamily: 'inherit', textDecoration: 'underline',
                            textUnderlineOffset: 3,
                          }}
                        >
                          Add work on the job
                        </button>
                        {' '}and it lands here.
                      </div>
                    )}

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
                      {/*
                        One thing to do, and everything else behind "More".

                        There were seven buttons across the bottom of a draft , 
                        Open job, Preview, Email invoice, Copy link, Send via
                        Stripe, Mark sent by hand, Void, all the same size, in
                        one grey row, with a red one on the end. Seven equal
                        choices is not a choice, and the destructive one was
                        sitting at the same weight as the one you actually
                        want. Sending it is the act; the rest are ways round.
                      */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {/*
                          Approve for the 1st, or send it now.

                          "Send it" meant send it this second, so an invoice
                          checked on the 30th had to be checked again on the
                          1st by somebody who remembered. Approving sets the
                          date and the scheduler posts it: signed off, not
                          gone anywhere.

                          Sending now is still here, because sometimes it is
                          the 3rd and you just want it out.
                        */}
                        {inv.status === 'draft' && !inv.send_on && (
                          <>
                            <Button disabled={busy} onClick={() => approveForFirst(inv)}>
                              Approve for the 1st
                            </Button>
                          </>
                        )}
                        {inv.status === 'draft' && inv.send_on && (
                          <span style={{ fontSize: 13, color: C.green }}>
                            Approved, goes out {shortDate(inv.send_on)}
                          </span>
                        )}
                        {['sent', 'partial', 'overdue'].includes(inv.status) && (
                          <select
                            defaultValue=""
                            disabled={busy}
                            /*
                              How much arrived, not just that something did.

                              This wrote amount_paid = total whatever actually
                              landed, so a customer paying $60 of $100 left a
                              choice between calling it paid and pretending
                              nothing came. The missing $40 was invisible: not
                              overdue, nothing chasing it, and quietly inflating
                              what Mike thought he was owed.

                              It asks. The full amount is offered, because that
                              is what usually arrives and nobody should have to
                              type it, and the status works itself out from the
                              number.
                            */
                            onChange={(e) => {
                              const via = e.target.value;
                              if (!via) return;
                              const owedNow = inv.total - inv.amount_paid;
                              setTakingPayment({ inv, via, amount: owedNow.toFixed(2) });
                              e.target.value = '';
                            }}
                            style={{ ...inputStyle, width: 'auto', padding: '8px 10px' }}
                          >
                            <option value="">Mark paid by…</option>
                            {METHODS.map((m) => (
                              <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                          </select>
                        )}
                        <Button variant="ghost" disabled={busy} onClick={() => preview(inv)}>
                          Preview
                        </Button>
                        {inv.status === 'draft' && !inv.send_on && (
                          <button
                            onClick={() => emailInvoice(inv)}
                            disabled={busy}
                            style={{
                              background: 'transparent', border: 'none', padding: '6px 4px',
                              color: C.dim, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Send now
                          </button>
                        )}
                        <button
                          onClick={() => setMoreFor(moreFor === inv.id ? null : inv.id)}
                          style={{
                            background: 'transparent', border: 'none', padding: '6px 4px',
                            color: C.faint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {moreFor === inv.id ? 'Less' : 'More…'}
                        </button>
                      </div>

                      <div style={{ fontSize: 14 }}>
                        <span style={{ color: C.faint }}>Total </span>
                        <span style={{ fontWeight: 500 }}>{money(inv.total)}</span>
                      </div>
                    </div>

                    {moreFor === inv.id && (
                      <div
                        style={{
                          marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`,
                          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
                        }}
                      >
                        {/*
                          Four grey pills and a red one, all the same size.

                          Copy link, Send via Stripe and Mark sent by hand are
                          not four unrelated options , they are three answers to
                          one question, which is how this goes out. Open job was
                          a fifth thing entirely and has moved up to the line
                          that explains what the job is for. Grouping them says
                          in the layout what you would otherwise have to work
                          out by reading all five.
                        */}
                        {inv.status === 'draft' && (
                          <div style={{ flexBasis: '100%' }}>
                            <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: C.faint, marginBottom: 8 }}>
                              Other ways to send it
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <Button variant="ghost" disabled={busy} onClick={() => sendAsLink(inv)}>
                                Copy link
                              </Button>
                              <Button variant="ghost" disabled={busy} onClick={() => sendViaStripe(inv)}>
                                Via Stripe
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
                                Already sent it myself
                              </Button>
                            </div>
                          </div>
                        )}
                        {inv.status !== 'void' && inv.status !== 'paid' && (
                          <div style={{ flexBasis: '100%', marginTop: inv.status === 'draft' ? 16 : 0 }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Button
                                variant="danger"
                                disabled={busy}
                                onClick={() => act(async () => { await voidInvoice(inv.id); })}
                              >
                                Void
                              </Button>
                              <span style={{ fontSize: 12, color: C.faint, lineHeight: 1.6 }}>
                                Puts the hours and receipts back to unbilled so they can go on a later invoice.
                              </span>
                            </div>
                          </div>
                        )}
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
                          fontSize: 12.5,
                          color: C.amber,
                          lineHeight: 1.6,
                        }}
                      >
                        On {money(inv.total)}, card fees run about{' '}
                        <strong>{money(inv.total * 0.029 + 0.3)}</strong>. Bank transfer costs
                        about <strong>{money(Math.min(inv.total * 0.008, 5))}</strong>, a
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
