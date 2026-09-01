'use client';

/**
 * Dashboard — what needs doing, in the order it needs doing.
 *
 * Replaces the old one, which computed `Date.now()` during render and so
 * disagreed with itself between server and browser — that was the hydration
 * error on load. Every time-dependent value here is computed after mount.
 *
 * The organizing idea: a dashboard should answer "what should I do next",
 * not "here is everything we know". So it leads with money you haven't
 * billed, because that's the most common and most expensive omission.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listDocuments, listInvoices, listJobLedger, listJobs } from '@/lib/spine/db';
import { modulesFor } from '@/lib/spine/modules';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { useTutorial } from '@/lib/spine/tutorial';
import { JOB_STATUS_LABEL } from '@/lib/spine/types';
import type { DocumentRecord, JobInvoice, JobLedger, JobWithCustomer } from '@/lib/spine/types';
import {
  Button,
  C,
  Card,
  Check,
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
  radius,
  shortDate,
} from '@/components/spine/ui';

interface Attention {
  key: string;
  weight: number;
  title: string;
  detail: string;
  cta: string;
  href: string;
  tone: 'amber' | 'red' | 'blue' | 'neutral';
}

export default function Dashboard() {
  const router = useRouter();
  const { org, vocab, loading: orgLoading } = useOrg();
  const { openPanel } = useTutorial();

  const [jobs, setJobs] = useState<JobWithCustomer[]>([]);
  const [ledger, setLedger] = useState<JobLedger[]>([]);
  const [invoices, setInvoices] = useState<JobInvoice[]>([]);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  /** Retainers whose billing period has come round with work sitting on them. */
  const [dueToBill, setDueToBill] = useState<Array<{ job_id: string; name: string; unbilled_total: number; due_on: string | null }>>([]);
  /**
   * Everything else the manifest should be watching. Each is a small count
   * query rather than a full table read — the manifest should be fast even
   * when the business isn't small.
   */
  const [signals, setSignals] = useState({
    customersNoEmail: 0,
    unconfirmedPrices: 0,
    draftEstimates: 0,
    staleEstimates: 0,
    expiringRecords: 0,
    docsNeedingReview: 0,
    openRequests: 0,
    jobsNoCustomer: 0,
    customerCount: 0,
    goneQuiet: 0,
    remindersDue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Computed after mount — never during render. That was the old bug. */
  const [todayIso, setTodayIso] = useState<string | null>(null);

  useEffect(() => {
    setTodayIso(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const [j, l, inv, d] = await Promise.all([
          listJobs(),
          listJobLedger(),
          listInvoices(),
          listDocuments({ unfiledOnly: true }),
        ]);
        const bd = await supabase.from('billing_due').select('*');

        const quietCutoff = new Date();
        quietCutoff.setDate(quietCutoff.getDate() - 4);

        const staleCutoff = new Date();
        staleCutoff.setDate(staleCutoff.getDate() - 7);
        const soonCutoff = new Date();
        soonCutoff.setDate(soonCutoff.getDate() + 45);
        const head = { count: 'exact' as const, head: true };

        const [noEmail, unconfirmed, draftEst, staleEst, expiring, needReview, reqs, noCustomer, custCount, quiet, due] =
          await Promise.all([
            supabase.from('customers').select('id', head).is('email', null),
            supabase.from('price_items').select('id', head).eq('confirmed', false),
            supabase.from('estimates').select('id', head).eq('status', 'draft'),
            supabase.from('estimates').select('id', head).eq('status', 'sent')
              .lt('sent_at', staleCutoff.toISOString()),
            supabase.from('business_files').select('id', head)
              .not('expires_on', 'is', null)
              .lte('expires_on', soonCutoff.toISOString().slice(0, 10)),
            supabase.from('documents').select('id', head).eq('status', 'needs_review'),
            supabase.from('site_requests').select('id', head)
              .in('status', ['submitted', 'needs_info']),
            supabase.from('jobs').select('id', head).is('customer_id', null)
              .not('status', 'in', '(closed,lost)'),
            supabase.from('customers').select('id', head),
            /**
             * People who owe you an answer.
             *
             * Four days is the threshold. Sooner and you are pestering
             * somebody who is on a roof; much later and the job has gone cold
             * without anybody deciding to let it.
             */
            supabase
              .from('customers')
              .select('id', head)
              .not('awaiting_reply_since', 'is', null)
              .lte('awaiting_reply_since', quietCutoff.toISOString().slice(0, 10)),
            // Due today or already late. A reminder for next Tuesday is not
            // something to be shown on a Monday; it is noise until it is not.
            supabase
              .from('reminders')
              .select('id', head)
              .is('done_at', null)
              .lte('due_on', new Date().toISOString().slice(0, 10)),
          ]);
        if (canceled) return;
        setJobs(j);
        setLedger(l);
        setInvoices(inv);
        setDocs(d);
        setSignals({
          customersNoEmail: noEmail.count ?? 0,
          unconfirmedPrices: unconfirmed.count ?? 0,
          draftEstimates: draftEst.count ?? 0,
          staleEstimates: staleEst.count ?? 0,
          expiringRecords: expiring.count ?? 0,
          docsNeedingReview: needReview.count ?? 0,
          openRequests: reqs.count ?? 0,
          jobsNoCustomer: noCustomer.count ?? 0,
          customerCount: custCount.count ?? 0,
          goneQuiet: quiet.count ?? 0,
          remindersDue: due.count ?? 0,
        });
        if (!bd.error) {
          setDueToBill(
            (bd.data ?? [])
              .map((r: Record<string, unknown>) => ({
                job_id: r.job_id as string,
                name: r.name as string,
                unbilled_total: Number(r.unbilled_total) || 0,
                due_on: (r.due_on as string) ?? null,
              }))
              .filter((r) => r.unbilled_total > 0)
          );
        }
      } catch (e) {
        if (!canceled) setError((e as Error).message);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [org?.id]);

  const live = invoices.filter((i) => i.status !== 'void');
  const unbilled = ledger.reduce((s, r) => s + r.unbilled_labor + r.unbilled_cost, 0);
  const outstanding = live.reduce((s, i) => s + (i.total - i.amount_paid), 0);
  const collected = live.reduce((s, i) => s + i.amount_paid, 0);
  const activeJobs = jobs.filter((j) => ['won', 'active'].includes(j.status));
  const leads = jobs.filter((j) => j.status === 'lead');

  // Overdue needs today's date, so it stays null until mounted.
  const overdue = todayIso
    ? live.filter(
        (i) => i.due_on && i.due_on < todayIso && i.status !== 'paid' && i.status !== 'draft'
      )
    : [];

  const drafts = live.filter((i) => i.status === 'draft');

  const attention: Attention[] = [];

  if (unbilled > 0) {
    attention.push({
      key: 'unbilled',
      weight: unbilled,
      title: `${money(unbilled)} of work you haven't billed`,
      detail: 'Hours logged and receipts filed that never made it onto an invoice.',
      cta: `Open ${vocab.jobPlural.toLowerCase()}`,
      href: '/jobs',
      tone: 'amber',
    });
  }
  if (overdue.length) {
    const amt = overdue.reduce((s, i) => s + (i.total - i.amount_paid), 0);
    attention.push({
      key: 'overdue',
      weight: amt * 2, // owed money past its date outranks everything
      title: `${money(amt)} is past due`,
      detail: `${overdue.length} invoice${overdue.length === 1 ? '' : 's'} past the due date. The oldest wants a phone call, not another email.`,
      cta: 'Open billing',
      href: '/billing',
      tone: 'red',
    });
  }
  if (docs.length) {
    attention.push({
      key: 'docs',
      weight: docs.length * 50,
      title: `${docs.length} document${docs.length === 1 ? '' : 's'} not filed`,
      detail: `Sitting in the inbox and not yet attached to a ${vocab.job.toLowerCase()}, so it is missing from your P&L.`,
      cta: 'Open documents',
      href: '/documents',
      tone: 'blue',
    });
  }
  if (drafts.length) {
    attention.push({
      key: 'drafts',
      weight: drafts.reduce((s, i) => s + i.total, 0),
      title: `${drafts.length} invoice${drafts.length === 1 ? '' : 's'} still in draft`,
      detail: 'Written but never sent. Nobody can pay an invoice they have not received.',
      cta: 'Open billing',
      href: '/billing',
      tone: 'amber',
    });
  }
  // Only count a retainer as due once its date has actually arrived.
  const dueNow = todayIso
    ? dueToBill.filter((r) => !r.due_on || r.due_on <= todayIso)
    : [];
  if (dueNow.length) {
    const amt = dueNow.reduce((s, r) => s + r.unbilled_total, 0);
    attention.push({
      key: 'retainer',
      weight: amt * 1.5,
      title: `${money(amt)} due to be billed`,
      detail: `${dueNow.length} ${dueNow.length === 1 ? 'retainer has' : 'retainers have'} reached the end of a billing period with work on them.`,
      cta: 'Open jobs',
      href: '/jobs',
      tone: 'amber',
    });
  }

  const mods = modulesFor(org);

  // Blocking problems — these stop money moving, so they outrank everything
  // that is merely untidy.
  if (signals.customersNoEmail > 0) {
    attention.push({
      key: 'noemail',
      weight: 5e8,
      title: `${signals.customersNoEmail} ${vocab.customerPlural.toLowerCase()} with no email`,
      detail: "You can't send an invoice or an estimate to someone with no email address.",
      cta: `Open ${vocab.customerPlural.toLowerCase()}`,
      href: '/customers',
      tone: 'red',
    });
  }

  if (signals.docsNeedingReview > 0) {
    attention.push({
      key: 'review',
      weight: signals.docsNeedingReview * 400,
      title: `${signals.docsNeedingReview} receipt${signals.docsNeedingReview === 1 ? '' : 's'} waiting on you`,
      detail: 'Read but not approved, so not counted against any job yet.',
      cta: 'Review them',
      href: '/documents',
      tone: 'amber',
    });
  }

  if (mods.has('proposals') && signals.draftEstimates > 0) {
    attention.push({
      key: 'draftest',
      weight: signals.draftEstimates * 300,
      title: `${signals.draftEstimates} proposal${signals.draftEstimates === 1 ? '' : 's'} never sent`,
      detail: 'Nobody can accept a proposal they never received.',
      cta: 'Open proposals',
      href: '/proposals',
      tone: 'amber',
    });
  }

  if (mods.has('proposals') && signals.staleEstimates > 0) {
    attention.push({
      key: 'staleest',
      weight: signals.staleEstimates * 200,
      title: `${signals.staleEstimates} proposal${signals.staleEstimates === 1 ? ' has' : 's have'} gone quiet`,
      detail: 'Sent over a week ago with no answer. A phone call beats another email.',
      cta: 'See which',
      href: '/proposals',
      tone: 'blue',
    });
  }

  if (signals.expiringRecords > 0) {
    attention.push({
      key: 'expiring',
      weight: 8e8, // an expired certificate can stop a job outright
      title: `${signals.expiringRecords} record${signals.expiringRecords === 1 ? '' : 's'} expiring`,
      detail: 'Insurance or a license is close to lapsing. Finding out when a GC asks is the expensive way.',
      cta: 'Open records',
      href: '/records',
      tone: 'red',
    });
  }

  if (mods.has('client_requests') && signals.openRequests > 0) {
    attention.push({
      key: 'requests',
      weight: signals.openRequests * 250,
      title: `${signals.openRequests} client request${signals.openRequests === 1 ? '' : 's'} waiting`,
      detail: 'A client asked for something and hasn\u2019t heard back.',
      cta: 'Open requests',
      href: '/requests',
      tone: 'amber',
    });
  }

  if (signals.jobsNoCustomer > 0) {
    attention.push({
      key: 'nocustomer',
      weight: signals.jobsNoCustomer * 100,
      title: `${signals.jobsNoCustomer} ${signals.jobsNoCustomer === 1 ? vocab.job.toLowerCase() : vocab.jobPlural.toLowerCase()} with nobody attached`,
      detail: 'No customer means no invoice and no way to follow up.',
      cta: `Open ${vocab.jobPlural.toLowerCase()}`,
      href: '/jobs',
      tone: 'amber',
    });
  }

  if (mods.has('pricing') && signals.unconfirmedPrices > 0) {
    attention.push({
      key: 'prices',
      weight: 60,
      title: `${signals.unconfirmedPrices} price${signals.unconfirmedPrices === 1 ? '' : 's'} not confirmed`,
      detail: 'Unconfirmed prices stay out of estimates until someone stands behind them.',
      cta: 'Open price list',
      href: '/pricing',
      tone: 'neutral',
    });
  }

  // Setup gaps, surfaced here because the flow is skippable by design.
  if (org && !(org.payment_methods as unknown[])?.length) {
    attention.push({
      key: 'nopay',
      weight: 4e8,
      title: 'No payment methods set',
      detail: 'Invoices go out with no instructions on how to pay them.',
      cta: 'Set them up',
      href: '/business',
      tone: 'red',
    });
  }

  if (org && Number(org.default_labor_rate) === 0) {
    attention.push({
      key: 'rate',
      weight: 1e9, // nothing else matters if invoices come out at zero
      title: 'Your hourly rate is still $0',
      detail: 'Every invoice will total zero until this is set.',
      cta: 'Set your rates',
      href: '/business',
      tone: 'red',
    });
  }

  if (signals.remindersDue > 0) {
    attention.push({
      key: 'reminders',
      tone: 'amber',
      title: `${signals.remindersDue} ${signals.remindersDue === 1 ? 'reminder' : 'reminders'} due`,
      detail: 'Things you asked to be reminded about, today or earlier.',
      cta: 'See them',
      href: '/customers',
      // Above chasing and below money. You set these deliberately, which makes
      // them a stronger signal than anything the app inferred on your behalf.
      weight: 6_000,
    });
  }

  if (signals.goneQuiet > 0) {
    attention.push({
      key: 'quiet',
      tone: 'amber',
      title: `${signals.goneQuiet} ${signals.goneQuiet === 1 ? 'person hasn' : "people haven"}'t replied`,
      detail:
        'You reached out and heard nothing back. Four days or more. Worth another try before it goes cold.',
      cta: 'See who',
      href: '/customers',
      // Below unbilled money, above tidying. A silent customer is a job that
      // may quietly not happen, which costs more than a missing email address
      // and less than work you have already done and not charged for.
      weight: 4_000,
    });
  }

  attention.sort((a, b) => b.weight - a.weight);

  /**
   * The five things that have to be true before this app can do its job, each
   * checked against real data rather than a "seen it" flag. Someone who set
   * their rate during signup arrives with step one already ticked, which is
   * both accurate and encouraging.
   */
  const chargesFixed = org?.billing_style === 'fixed' || org?.billing_style === 'retainer';
  const firstRun = [
    {
      label: chargesFixed ? 'Confirm how you charge' : 'Set your hourly rate',
      why: chargesFixed
        ? 'So estimates and invoices start from the right numbers.'
        : 'Without it, every invoice comes out at zero.',
      done: chargesFixed || Number(org?.default_labor_rate ?? 0) > 0,
      href: '/business',
    },
    {
      label: 'Say how you want to be paid',
      why: 'Customers see these on every invoice, so they know where to send money.',
      done: Array.isArray(org?.payment_methods) && (org?.payment_methods as unknown[]).length > 0,
      href: '/business',
    },
    {
      label: `Add your first ${vocab.customer.toLowerCase()}`,
      why: 'Name, phone, email. Whatever you have is enough.',
      done: signals.customerCount > 0,
      href: '/customers',
    },
    {
      label: `Create your first ${vocab.job.toLowerCase()}`,
      why: 'Hours, receipts and invoices all hang off it.',
      done: jobs.length > 0,
      href: '/jobs/new',
    },
    {
      label: `Send your first ${vocab.estimate.toLowerCase()}`,
      why: 'Customers get a web page they can accept in one click.',
      done: signals.draftEstimates > 0 || invoices.length > 0,
      href: jobs.length > 0 ? `/jobs/${jobs[0].id}/estimate` : '/jobs/new',
    },
  ];

  const busy = loading || orgLoading;
  const emptyApp = !busy && jobs.length === 0 && invoices.length === 0 && docs.length === 0;

  return (
    <Page
      title="Today"
      subtitle={
        emptyApp
          ? `Nothing logged for ${org?.name ?? 'this business'} yet. Five minutes here and you're running.`
          : `Everything ${org?.name ?? 'this business'} needs you to deal with, most costly first.`
      }
      action={
        <>
          <Button variant="ghost" onClick={openPanel}>Learn</Button>
          <Button onClick={() => router.push('/jobs/new')}>New {vocab.job.toLowerCase()}</Button>
        </>
      }
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      {emptyApp ? (
        /**
         * A checklist against real data, not a paragraph.
         *
         * This screen is the first thing someone sees on an account with
         * nothing in it, and the audience is people running a business off a
         * phone and a shoebox. "Show me the paths" asks them to trust that
         * something useful is behind a button. A list of five concrete things
         * with three already ticked asks nothing — it shows where they are and
         * what is next, and it disappears on its own once they are going.
         */
        <Card style={{ maxWidth: 620 }}>
          <div style={{ ...DISPLAY, fontSize: 22, marginBottom: 6 }}>
            Let&apos;s get you set up
          </div>
          <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.65, margin: '0 0 18px' }}>
            Five things, in order. Each takes a minute. This list disappears once you&apos;re running.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {firstRun.map((step, i) => {
              const next = firstRun.findIndex((x) => !x.done) === i;
              return (
                <div
                  key={step.label}
                  onClick={step.done ? undefined : () => router.push(step.href)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 13px',
                    borderRadius: radius.md,
                    background: next ? C.blueSoft : 'transparent',
                    cursor: step.done ? 'default' : 'pointer',
                  }}
                >
                  <Check done={step.done} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: next ? 600 : 500,
                        color: step.done ? C.faint : C.text,
                        textDecoration: step.done ? 'line-through' : 'none',
                      }}
                    >
                      {step.label}
                    </div>
                    {!step.done && (
                      <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{step.why}</div>
                    )}
                  </div>
                  {next && <span style={{ fontSize: 12.5, color: C.blue, fontWeight: 500 }}>Start →</span>}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={openPanel}>Walk me through it instead</Button>
          </div>
        </Card>
      ) : busy ? (
        <Empty>Loading…</Empty>
      ) : (
        <>
          {attention.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <SectionLabel>Needs you ({attention.length})</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {attention.map((a) => {
                  const accent =
                    a.tone === 'red' ? C.red : a.tone === 'amber' ? C.amber : C.blue;
                  const soft =
                    a.tone === 'red' ? C.redSoft : a.tone === 'amber' ? C.amberSoft : C.blueSoft;
                  return (
                    <div
                      key={a.key}
                      style={{
                        display: 'flex',
                        gap: 14,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        background: soft,
                        border: `1px solid ${C.border}`,
                        borderLeft: `3px solid ${accent}`,
                        borderRadius: radius.lg,
                        padding: '15px 18px',
                      }}
                    >
                      <div style={{ minWidth: 240, flex: 1 }}>
                        <div style={{ ...DISPLAY, fontSize: 18, color: C.text }}>
                          {a.title}
                        </div>
                        <div style={{ fontSize: 12.5, color: C.dim, marginTop: 4 }}>
                          {a.detail}
                        </div>
                      </div>
                      <Button variant="ghost" onClick={() => router.push(a.href)}>
                        {a.cta}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {attention.length === 0 && (
            <Card style={{ marginBottom: 30, borderColor: C.green, background: C.greenSoft }}>
              <div style={{ fontSize: 14, color: C.green, fontWeight: 500 }}>
                Nothing needs you right now.
              </div>
              <div style={{ fontSize: 12.5, color: C.dim, marginTop: 4 }}>
                Everything billable is billed, every receipt is filed, nothing is expiring.
              </div>
            </Card>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
              gap: 12,
              marginBottom: 30,
            }}
          >
            <Metric label={`Active ${vocab.jobPlural.toLowerCase()}`} value={String(activeJobs.length)} />
            <Metric label={vocab.lead + 's'} value={String(leads.length)} hint="Not yet won" />
            <Metric
              label="Unbilled"
              value={money0(unbilled)}
              tone={unbilled > 0 ? 'amber' : undefined}
            />
            <Metric
              label="Owed to you"
              value={money0(outstanding)}
              tone={outstanding > 0 ? 'blue' : undefined}
            />
            <Metric label="Collected" value={money0(collected)} tone="green" />
          </div>

          {activeJobs.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionLabel>In progress</SectionLabel>
                <Button variant="ghost" onClick={() => router.push('/jobs')}>See all</Button>
              </div>
              <Table>
                <Row cols="1fr 150px 110px 110px" header>
                  <div>{vocab.job}</div>
                  <div>{vocab.customer}</div>
                  <div>Unbilled</div>
                  <div>Margin</div>
                </Row>
                {activeJobs.slice(0, 6).map((j) => {
                  const l = ledger.find((r) => r.job_id === j.id);
                  const u = l ? l.unbilled_labor + l.unbilled_cost : 0;
                  return (
                    <Row
                      key={j.id}
                      cols="1fr 150px 110px 110px"
                      onClick={() => router.push(`/jobs/${j.id}`)}
                    >
                      <div>
                        <span style={{ ...DISPLAY, fontSize: 15.5 }}>{j.name}</span>
                        <span style={{ marginLeft: 8 }}>
                          <Pill tone={j.status === 'active' ? 'blue' : 'neutral'}>
                            {JOB_STATUS_LABEL[j.status]}
                          </Pill>
                        </span>
                      </div>
                      <div style={{ color: C.dim }}>{j.customer?.name ?? '—'}</div>
                      <div style={{ color: u > 0 ? C.amber : C.faint }}>
                        {u > 0 ? money(u) : '—'}
                      </div>
                      <div style={{ color: (l?.margin_to_date ?? 0) >= 0 ? C.green : C.red }}>
                        {money(l?.margin_to_date ?? 0)}
                      </div>
                    </Row>
                  );
                })}
              </Table>
            </div>
          )}

          {overdue.length > 0 && (
            <div>
              <SectionLabel>Past due</SectionLabel>
              <Table>
                <Row cols="110px 1fr 120px 110px" header>
                  <div>Invoice</div><div>{vocab.job}</div><div>Due</div><div>Amount</div>
                </Row>
                {overdue.map((i) => (
                  <Row
                    key={i.id}
                    cols="110px 1fr 120px 110px"
                    onClick={() => router.push('/billing')}
                  >
                    <div>{i.number}</div>
                    <div style={{ color: C.dim }}>
                      {jobs.find((j) => j.id === i.job_id)?.name ?? '—'}
                    </div>
                    <div style={{ color: C.red }}>{shortDate(i.due_on)}</div>
                    <div>{money(i.total - i.amount_paid)}</div>
                  </Row>
                ))}
              </Table>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
