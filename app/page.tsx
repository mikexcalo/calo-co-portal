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

import { Unresolved } from '@/components/spine/Unresolved';
import { TellUs } from '@/components/spine/TellUs';
import { FeedbackInbox } from '@/components/spine/FeedbackInbox';
import { AskedOfYou } from '@/components/spine/AskedOfYou';
import { YourSetup } from '@/components/spine/YourSetup';
import { SoldNotLive } from '@/components/spine/SoldNotLive';
import { FollowUps } from '@/components/spine/FollowUps';
import { WeekAhead } from '@/components/spine/WeekAhead';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CLIENT_STAGES } from '@/lib/spine/stage';
import { listDocuments, listInvoices, listJobLedger, listJobs, orgNow} from '@/lib/spine/db';
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
import { human } from '@/lib/spine/errors';

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
  /**
   * Whether this person is allowed to set the business up.
   *
   * Null until we know, so the checklist is never flashed at somebody it does
   * not belong to. Marcie landed in Lakemere's workspace and was shown Keith's
   * account chores — "say how you charge", "how you want to be paid" — which
   * is why her first note said the tasks looked like they were for somebody
   * else. They were.
   */
  const [canSetUp, setCanSetUp] = useState<boolean | null>(null);
  /** First name, for the top of the page. Nobody arrives at "Home". */
  const [firstName, setFirstName] = useState<string>('');
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
        /*
          Three waves became one.

          Home fetched four things, waited, fetched billing_due, waited, then
          fired eleven separate head counts. Sixteen browser round trips in
          three serial rounds, on a page that shows a handful of numbers, and
          most of a hard refresh taking eight seconds.

          The eleven counts are one function call now, and everything that does
          not depend on anything else goes at once.
        */
        const [bd, sig] = await Promise.all([
          supabase.from('billing_due').select('*').eq('org_id', await orgNow()),
          supabase.rpc('home_signals').maybeSingle(),
        ]);

        if (canceled) return;
        setJobs(j);
        setLedger(l);
        setInvoices(inv);
        setDocs(d);
        const c = (sig.data ?? {}) as Record<string, number>;
        setSignals({
          customersNoEmail: c.customers_no_email ?? 0,
          unconfirmedPrices: c.unconfirmed_prices ?? 0,
          draftEstimates: c.draft_estimates ?? 0,
          staleEstimates: c.stale_estimates ?? 0,
          expiringRecords: c.expiring_records ?? 0,
          docsNeedingReview: c.docs_needing_review ?? 0,
          openRequests: c.open_requests ?? 0,
          jobsNoCustomer: c.jobs_no_customer ?? 0,
          customerCount: c.customer_count ?? 0,
          goneQuiet: c.quiet_customers ?? 0,
          remindersDue: c.reminders_due ?? 0,
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
        if (!canceled) setError(human((e as Error).message));
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
      title: `${signals.customersNoEmail} ${signals.customersNoEmail === 1 ? vocab.customer.toLowerCase() : vocab.customerPlural.toLowerCase()} with no email`,
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
   * What has to be true before this can work, checked against real data.
   *
   * This was five fixed steps and the first was "set your hourly rate", which
   * is wrong for anybody who does not sell hours. John is paid commission, at
   * five percent on accounts he originates and two to three on house accounts
   * handed to him, and being asked for an hourly rate on his first screen tells
   * him plainly that the software was built for somebody else.
   *
   * The other half of the mistake was what counted as setup. Create your first
   * engagement and send your first proposal are not setup, they are work, and
   * a checklist that will not go away until you have sold something is a
   * checklist that nags you about your business rather than about your account.
   *
   * So: only the things that make the account correct, and the money step is
   * whichever one is true for how this business actually charges.
   */

  /**
   * What you came here to do, not what your account is missing.
   *
   * This was four account chores, which is why Marcie — who cannot change
   * Lakemere's settings and did not want to — read it as somebody else's
   * homework and wrote in to say so. Everyone gets the doing list, because
   * "add a client" is the same invitation whoever is holding the phone.
   * Settings move below, and only for the people who own them.
   *
   * Each row is a module. Rows for modules this business does not have are
   * not shown, so nothing here leads to a door that is locked.
   */
  /**
   * Short, or nothing.
   *
   * These read like a brochure: "photograph it and the amount, the supplier
   * and the date are read off it" explains a pipeline to somebody who wanted
   * to know where the button was. The label is the instruction. A hint only
   * earns its place if it answers "what do I need before I start".
   */
  const startHere = ([
    {
      module: 'inbox',
      label: 'Drop in whatever you have',
      why: 'Logos, receipts, spreadsheets, photos. Sort them later.',
      done: false,
      href: '/inbox',
    },
    {
      module: 'customers',
      label: `Add your ${vocab.customerPlural.toLowerCase()}`,
      why: 'Names are enough.',
      done: signals.customerCount > 0,
      href: '/customers',
    },
    {
      module: 'jobs',
      label: `Add a ${vocab.job.toLowerCase()}`,
      why: 'What you are working on, and who for.',
      done: jobs.length > 0,
      href: '/jobs/new',
    },
    {
      module: 'receipts',
      label: 'Add a receipt',
      why: 'A photo or a PDF.',
      done: docs.length > 0,
      href: '/documents',
    },
    {
      module: 'pricing',
      label: 'Add your prices',
      why: 'What you sell, and what it costs.',
      done: false,
      href: '/pricing',
    },
    {
      module: 'billing',
      label: 'Send an invoice',
      why: 'Once a job has hours or receipts on it.',
      done: invoices.length > 0,
      href: '/billing',
    },
    /*
      No "see your profit" here.
      
      This list only shows on a workspace with no jobs, no invoices and no
      receipts, so the P&L behind it is guaranteed to be empty. Offering it as
      one of six first moves sends somebody to a screen of zeroes and teaches
      them the product has nothing in it.
    */
  ] as const).filter((row) => mods.has(row.module as never));

  /** Account settings. Real, but nobody's first move, and only the owner's. */
  const accountSetup = [
    {
      label: 'Check your business details',
      why: 'The name, the email and the phone number that appear on everything you send.',
      done: Boolean(org?.name),
      href: '/business',
    },
    {
      label: 'Say how you want to be paid',
      why: 'These appear on every invoice, so people know where to send the money.',
      done: Array.isArray(org?.payment_methods) && (org?.payment_methods as unknown[]).length > 0,
      href: '/business',
    },
  ];

  const firstRun = startHere;

  const busy = loading || orgLoading;
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!org?.id) { setCanSetUp(null); return; }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;
      const profile = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', auth.user.id)
        .maybeSingle();
      if (!canceled) {
        const whole = (profile.data?.full_name ?? '').trim();
        setFirstName(whole ? whole.split(/\s+/)[0] : '');
      }

      const membership = await supabase
        .from('memberships')
        .select('role')
        .eq('user_id', auth.user.id)
        .eq('org_id', org.id)
        .maybeSingle();
      if (canceled) return;
      setCanSetUp(['owner', 'admin'].includes(membership.data?.role ?? ''));
    })();
    return () => { canceled = true; };
  }, [org?.id]);

  const emptyApp = !busy && jobs.length === 0 && invoices.length === 0 && docs.length === 0;

  return (
    <Page
      /**
       * Their name, not the name of the screen.
       *
       * "Home" tells somebody who just signed in nothing they did not already
       * know. Falls back to Home before the profile loads and for anyone who
       * never set a name, so the title never flickers through a blank.
       */
      title={firstName ? `Hey, ${firstName}` : 'Home'}
      subtitle={
        emptyApp
          ? `Nothing logged for ${org?.name ?? 'this business'} yet. A few minutes here and you're running.`
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
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}

      {emptyApp ? (
        /**
         * Not a checklist.
         *
         * A column of empty checkboxes tells somebody they are behind before
         * they have done anything, and every item reads as a chore somebody
         * else assigned. This asks one question and answers it with the six
         * things the product is actually for, as things you press rather than
         * things you tick.
         */
        <div style={{ display: 'grid', gap: 20, maxWidth: 840 }}>
          <div>
            <div style={{ ...DISPLAY, fontSize: 24, marginBottom: 6 }}>
              What do you want to do first?
            </div>
            <p style={{ fontSize: 14.5, color: C.dim, margin: 0, maxWidth: '54ch' }}>
              Nothing is set up in advance and nothing has to be done in order.
              Pick whichever one you already have to hand.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {startHere.map((s) => (
              <button
                key={s.label}
                onClick={() => router.push(s.href)}
                style={{
                  textAlign: 'left',
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: radius.lg,
                  padding: '16px 16px 18px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  minHeight: 104,
                }}
              >
                <span style={{ fontSize: 15.5, fontWeight: 600, color: C.text }}>{s.label}</span>
                {s.why && (
                  <span style={{ fontSize: 13, color: C.faint, lineHeight: 1.5 }}>{s.why}</span>
                )}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12.5, color: C.blue }}>Open &rarr;</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={openPanel}>Walk me through it</Button>
            {canSetUp && accountSetup.some((a) => !a.done) && (
              <button
                onClick={() => router.push('/business')}
                style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Account details, for when you invoice &rarr;
              </button>
            )}
          </div>
        </div>
      ) : busy ? (
        <Empty>Loading…</Empty>
      ) : (
        <>
          {attention.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <SectionLabel>Needs you ({attention.length})</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/*
                  The tone is a word, not a bent stripe.

                  These were a tinted panel with a 3px colored border down the
                  left, dragged around a 12px corner radius, so the one part
                  of the card carrying the meaning rendered as a colored sliver
                  curling off into the corner. It read as damage rather than
                  design, and it is the sort of thing that gets copied: the
                  same treatment had already spread to customer notes.

                  A pill says the same thing in a word, in the tone color, at
                  the size the rest of the system already uses for status. The
                  card underneath goes back to being a plain card.
                */}
                {attention.map((a) => (
                  <div
                    key={a.key}
                    style={{
                      display: 'flex',
                      gap: 14,
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      background: C.panel,
                      border: `1px solid ${C.border}`,
                      borderRadius: radius.lg,
                      padding: '15px 18px',
                    }}
                  >
                    <div style={{ minWidth: 240, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                        {/*
                          "Wrong" was too strong. An hourly rate you have not
                          set yet is not wrong, it is unfinished, and a word
                          that accusing at the top of the screen you open every
                          morning wears badly. Fix says the same thing and asks
                          rather than scolds.
                        */}
                        <Pill tone={a.tone === 'red' ? 'red' : a.tone === 'amber' ? 'amber' : 'neutral'}>
                          {a.tone === 'red' ? 'Fix' : a.tone === 'amber' ? 'Waiting' : 'Note'}
                        </Pill>
                        <div style={{ ...DISPLAY, fontSize: 18, color: C.text }}>
                          {a.title}
                        </div>
                      </div>
                      <div style={{ fontSize: 13.5, color: C.dim, marginTop: 5 }}>
                        {a.detail}
                      </div>
                    </div>
                    <Button variant="ghost" onClick={() => router.push(a.href)}>
                      {a.cta}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/*
            The all-clear now says what it actually checked.
            
            It read "nothing needs you right now" while a client was waiting and
            a plan had nobody on it. Every check it ran had passed, and every
            check it ran was about money. Claiming more than you measured is the
            worst thing a status message can do, because it is believed.
          */}
          {/*
            One line, not a card.

            This was a full-width green panel with a heading and two lines of
            prose, and its entire message was that nothing is wrong. It sat
            above the numbers that say the same thing more precisely, so it
            cost a scroll and a read to learn nothing. Kept at all only because
            silence is ambiguous: an empty dashboard could mean all clear or
            could mean nothing loaded.
          */}
          {attention.length === 0 && (
            <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 18 }}>
              Nothing billable unbilled, no receipts outstanding, nothing expiring.
            </div>
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
            {/*
              Three zeros in a row.

              Unbilled $0, Owed to you $0, Collected $0, on a business that
              has not invoiced yet, which is every business on its first day.
              Metric has carried hideAtZero since it was written and the note
              on it calls five cards reading $0 the single most repeated
              mistake in this product. Home was making it.
            */}
            <Metric
              label="Unbilled"
              value={money0(unbilled)}
              hideAtZero
              tone={unbilled > 0 ? 'amber' : undefined}
            />
            {/*
              Money owed to you is red.

              This was 'blue', which in this palette is #141414, so the one
              number on Home that represents cash sitting in somebody else's
              account rendered in the same black as the engagement count. Red
              is the tone this platform reserves for something that is wrong,
              and money invoiced and not paid is exactly that.
            */}
            <Metric
              label="Owed to you"
              value={money0(outstanding)}
              hideAtZero
              tone={outstanding > 0 ? 'red' : undefined}
            />
            <Metric label="Collected" value={money0(collected)} hideAtZero tone="green" />
          </div>

          {/*
            Siblings, not children.
            
            These three were dropped inside the "In progress" heading row, which
            is a flex line meant to hold a label and a button, and inside the
            condition that there are active jobs. So they laid out sideways,
            collided with the column beside them, and would have vanished
            entirely the moment every job was finished.
          */}
          {/*
            One way to write a note, not three.

            This dashed box sat under the numbers saying "Drop a note, talk or
            paste", while the top bar carried a Drop a note button, and further
            down the page a second box asked "Tell us what you need". Three
            places to type on one screen, two of them going to the same place.

            The control in the chrome is on every screen and is where anybody
            learns it lives, so it wins. The shortcut it teaches is on that
            button too.
          */}

          {/* Somebody is waiting on you. First, because it is the only
              thing here that somebody else is blocked by. */}
          <AskedOfYou />

          <Unresolved />

          <SoldNotLive />
          {/* What other people have asked for, above your own tasks: somebody
              waiting on you outranks a job you set yourself. */}
          <FeedbackInbox currentOrgId={org?.id ?? null} />

          {/*
            Platform setup, for the business that runs the platform.
            
            These are real and they are Mike's, Stripe keys, Supabase Pro,
            the search console. What was wrong was showing them inside
            Lakemere, whose owner cannot do any of them and did not ask. The
            agency workspace, and only its owners.
          */}
          {org?.kind === 'agency' && canSetUp && <YourSetup />}

          {/* And the way to send one, on the screen everybody opens first. */}
          {/*
            Not on Home as well.

            Tell Us is a button at the foot of the sidebar on every screen, and
            this put a second copy of the same thing in the middle of the page
            somebody lands on. One way to say something, in the place it always
            lives.
          */}

          <FollowUps />

          <WeekAhead />

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
                        <span style={{ ...DISPLAY, fontSize: 16.5 }}>{j.name}</span>
                        <span style={{ marginLeft: 8 }}>
                          <Pill tone={j.status === 'active' ? 'blue' : 'neutral'}>
                            {JOB_STATUS_LABEL[j.status]}
                          </Pill>
                        </span>
                      </div>
                      <div style={{ color: C.dim }}>{j.customer?.name ?? '–'}</div>
                      <div style={{ color: u > 0 ? C.amber : C.faint }}>
                        {u > 0 ? money(u) : '–'}
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
                      {jobs.find((j) => j.id === i.job_id)?.name ?? '–'}
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
