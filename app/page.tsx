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
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Computed after mount — never during render. That was the old bug. */
  const [todayIso, setTodayIso] = useState<string | null>(null);

  useEffect(() => {
    setTodayIso(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [j, l, inv, d] = await Promise.all([
          listJobs(),
          listJobLedger(),
          listInvoices(),
          listDocuments({ unfiledOnly: true }),
        ]);
        const bd = await supabase.from('billing_due').select('*');

        const staleCutoff = new Date();
        staleCutoff.setDate(staleCutoff.getDate() - 7);
        const soonCutoff = new Date();
        soonCutoff.setDate(soonCutoff.getDate() + 45);
        const head = { count: 'exact' as const, head: true };

        const [noEmail, unconfirmed, draftEst, staleEst, expiring, needReview, reqs, noCustomer] =
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
          ]);
        if (cancelled) return;
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
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
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
      detail: `Sitting in the inbox, not yet attached to a ${vocab.job.toLowerCase()} — so not in your P&L.`,
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

  attention.sort((a, b) => b.weight - a.weight);

  const busy = loading || orgLoading;
  const emptyApp = !busy && jobs.length === 0 && invoices.length === 0 && docs.length === 0;

  return (
    <Page
      title="Manifest"
      subtitle={
        emptyApp
          ? `Nothing logged for ${org?.name ?? 'this business'} yet — which is the right place to start.`
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
        <Card style={{ maxWidth: 620 }}>
          <div style={{ fontFamily: SERIF, fontSize: 22, marginBottom: 10 }}>
            Start with a guided path
          </div>
          <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.6, marginTop: 0 }}>
            The fastest way in is to run one real process end to end — set your rates, create a{' '}
            {vocab.job.toLowerCase()}, log a day, photograph a receipt, and let the invoice build
            itself. It takes about twelve minutes on real data.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <Button onClick={openPanel}>Show me the paths</Button>
            <Button variant="ghost" onClick={() => router.push('/business')}>
              Set rates first
            </Button>
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
                        <div style={{ fontFamily: SERIF, fontSize: 18, color: C.text }}>
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
                Everything billable is billed, every receipt is filed, and nothing is expiring.
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
                        <span style={{ fontFamily: SERIF, fontSize: 15.5 }}>{j.name}</span>
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
