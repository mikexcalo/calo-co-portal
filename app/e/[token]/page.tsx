/**
 * The estimate a customer actually sees.
 *
 * Public — no login, because a homeowner will not create an account to look
 * at a quote. Reached by an unguessable token that permits exactly one thing:
 * view this estimate and decide on it.
 *
 * Server-rendered on purpose. It has to work on a bad phone connection in a
 * driveway, load fast, and be printable. No client-side data fetching.
 */

import { createClient } from '@supabase/supabase-js';
import { studioNameFor } from '@/lib/spine/studio-name';
import type React from 'react';
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';
/*
  From `vocab`, not from `org`.

  `org.tsx` is a client module - it holds the workspace context - and this page
  is server-rendered on purpose. Importing these from there gave this file a
  client reference rather than the function, and every proposal link in the
  product rendered a blank page for two days.
*/
import { vocabFor, aWord, capWord } from '@/lib/spine/vocab';
import type { Org } from '@/lib/spine/types';
import { SaveAsPdf } from './SaveAsPdf';
import { Faq } from '@/components/spine/Faq';
import { asQuestions } from '@/lib/spine/questions-from-notes';
import { AddOns } from './AddOns';
import { AskAbout } from './AskAbout';
import { clientFace, initialsOf } from '@/lib/spine/client-face';
import { ownerOf } from '@/lib/spine/doc-owner';
import { C, radius } from '@/lib/spine/tokens';
import { depositAmount, type Deposit } from '@/lib/spine/deposit';
import { DocShell, Sent } from '@/components/public/DocShell';

export const dynamic = 'force-dynamic';
/*
  And the data behind it, which force-dynamic does not cover.

  force-dynamic stops the ROUTE being prerendered. It does not stop Next
  caching the fetches inside it, and supabase-js goes through fetch — so this
  page rendered on every request and rendered the same stale rows every time.

  A proposal showed a price that had been changed hours earlier, three separate
  times, while the database held the new one. On a document somebody is asked
  to accept, that is about as bad as a caching default gets. The two other
  public routes in here already carried this line.
*/
export const fetchCache = 'force-no-store';

/*
  A tab, and a saved file, with a name on it.

  Both documents inherited the app's title, so a client's browser tab said
  CALO&CO and a PDF saved out of the page was called CALO&CO.pdf. The document
  knows what it is; the title should say so.
*/
export async function generateMetadata({ params }: { params: { token: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { title: 'Proposal' };
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db
    .from('estimates')
    .select('job:jobs(name, org:orgs(name, kind, settings))')
    .eq('public_token', params.token)
    .maybeSingle();
  const job = data?.job as {
    name?: string;
    org?: { name?: string; kind?: Org['kind']; settings?: Record<string, unknown> | null };
  } | null;
  /* A rep sends a quote and a studio sends a proposal. The tab and the saved
     PDF carry the sender's word for it, not ours. */
  const word = vocabFor(job?.org?.kind, job?.org?.settings ?? null).estimate;
  return {
    title: job?.name ? `${word}, ${job.name}` : word,
    description: job?.org?.name ? `${capWord(aWord(word))} from ${job.org.name}.` : undefined,
  };
}

interface Line {
  list_unit_price?: number | null;
  id: string;
  kind: string;
  description: string;
  qty: number;
  unit: string | null;
  unit_price: number;
  total: number;
  position: number;
  optional: boolean;
}

/* Tabular figures, so a column of numbers lines up. */
const numeralStyle: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontSize: 12.5,
  letterSpacing: '.04em',
};

const money = (n: number) =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtDate(d: string | null): string {
  if (!d) return '';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  if (!y) return '';
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

/** An estimate id, not a public token: the two shapes cannot be confused. */
const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PublicEstimate({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) notFound();

  const db = createClient(url, key, { auth: { persistSession: false } });

  /*
    "This is us looking, not them."

    It has always kept the preview panel from stamping viewed_at and
    announcing that a customer opened a proposal nobody has sent. It is read
    here, above the lookup, because it now also decides which lookup runs and
    whether the accept and decline controls are live.
  */
  const isPreview = searchParams?.preview === '1';

  const SELECT =
    '*, job:jobs(id, name, address, billing_type, org_id, customer:customers(name, contact_name))';

  let { data: estimate } = await db
    .from('estimates')
    .select(SELECT)
    .eq('public_token', params.token)
    .maybeSingle();

  /*
    The owner looking at one of their own that has no public token.

    A token is minted when a proposal is sent, so a draft and every superseded
    version have none, and the preview panel on /proposals had nothing to open
    - it fell back to the job screen. "Preview any of mine" is a reasonable
    thing to want, and it must not be bought by minting a public URL for a
    document nobody has decided to send: a token is readable by anybody
    holding it, forever.

    So the owner gets a different route into the same document. The segment is
    the estimate's id rather than its token, it works only with `?preview=1`,
    and only for somebody signed in who holds a membership in the org that
    owns it. Nothing about the customer's path changes, and an id with no
    session is the same not-found a wrong token has always been.
  */
  let ownerPreview = false;
  if (!estimate && isPreview && IS_UUID.test(params.token)) {
    const me = (await createSupabaseServer().auth.getUser()).data.user;
    if (me) {
      const { data: mine } = await db
        .from('estimates')
        .select(SELECT)
        .eq('id', params.token)
        .maybeSingle();
      if (mine) {
        const orgId = (mine.job as { org_id?: string } | null)?.org_id ?? mine.org_id;
        const { data: member } = await db
          .from('memberships')
          .select('user_id')
          .eq('user_id', me.id)
          .eq('org_id', orgId)
          .maybeSingle();
        if (member) {
          estimate = mine;
          ownerPreview = true;
        }
      }
    }
  }

  if (!estimate) notFound();

  const job = estimate.job as {
    name: string; address: string | null; billing_type: string; org_id: string;
    customer: { name: string; contact_name: string | null } | null;
  } | null;

  const [{ data: lines }, { data: org }, studio] = await Promise.all([
    db.from('estimate_lines').select('*').eq('estimate_id', estimate.id).order('position'),
    db.from('orgs').select('name, settings, kind').eq('id', job?.org_id ?? '').maybeSingle(),
    /* Whose name goes at the foot: the studio that set this workspace up. */
    studioNameFor(db, job?.org_id ?? estimate.org_id),
  ]);

  /* The sender's word for the document, used everywhere the page names it. */
  const estimateWord = vocabFor(
    (org as { kind?: Org['kind'] } | null)?.kind,
    (org as { settings?: Record<string, unknown> | null } | null)?.settings ?? null
  ).estimate;

  // Record the first open. "Sent but never opened" is a different problem
  // from "opened and ignored", and only one of them needs a nudge.
  /*
    Your own preview is not them opening it.

    "Opened it" is a genuinely useful signal: it separates a customer who has
    read a proposal and gone quiet from one who never got the email. But this
    stamped viewed_at on ANY load of the page, and the first person to load it
    is always Mike, from the preview panel, before it is even sent. Both
    proposals showed "Opened it" within seconds of going out.

    The preview asks for the page with ?preview=1 and gets no stamp. A customer
    clicking a link in an email has no such thing on the URL, so the only way
    to be recorded as having opened it is to have actually opened it.
  */

  /*
    The first time they open it, say so.

    "Opened it" was a pill on a list somebody had to go and look at. The useful
    version is a line on Home the moment it happens, because a proposal being
    read is the only signal between sending one and hearing back — and it is
    the difference between chasing somebody who never got the email and leaving
    alone somebody who is still thinking.

    Once only: the first open is news, the fourth is not.
  */
  if (!isPreview && !estimate.viewed_at) {
    const client = job?.customer?.contact_name || job?.customer?.name || 'Somebody';
    const first = client.split(/\s+/)[0];
    await db.from('notifications').insert({
      org_id: job?.org_id ?? estimate.org_id,
      kind: 'system',
      title: `${first} just opened your ${estimateWord.toLowerCase()}`,
      body: `${job?.name ?? `The ${estimateWord.toLowerCase()}`}. No decision yet.`,
    }).then(undefined, () => {
      // A missed notice is not a reason to fail the page somebody is reading.
    });
  }

  if (!isPreview && !estimate.viewed_at) {
    await db.from('estimates').update({ viewed_at: new Date().toISOString() }).eq('id', estimate.id);
  }

  /*
    The logo the brand kit actually stores.

    This looked for brand.logoLight and nothing else. The kit writes a `logos`
    array — CALO&CO's three marks, Mammoth's seven — so every proposal went out
    unbranded while a logo sat one key away. Both are read now, the explicit
    light mark first where somebody has chosen one.
  */
  const brand = ((org?.settings as Record<string, unknown>)?.brand ?? {}) as {
    colors?: Array<{ hex: string; role?: string }>;
    logoLight?: string;
    logos?: string[];
  };
  /*
    One resolver for both documents.

    This page read `brand.logos` and the invoice read only `brand.logoLight`,
    and both fell back to near-black while a real colour sat in
    `settings.workspace_color` - so Harbor Light's teal was on every screen of
    the app and on neither of the two documents its customers receive.
  */
  const face = clientFace(org);
  const owner = await ownerOf(db, job?.org_id ?? estimate.org_id);
  const logo = face.logo;
  const accent = face.accent;

  const rows = (lines ?? []) as Line[];
  // Required work only. Optional lines are priced separately below so the
  // headline number is what the job costs if they add nothing.
  const required = rows.filter((l) => !l.optional);
  const options = rows.filter((l) => l.optional);
  const subtotal = required.reduce((s, l) => s + Number(l.total), 0);

  /*
    What shape is this arrangement? Worked out once, here.

    It was worked out three times — in the on-screen totals, in the PDF
    totals, and not at all for the note, which was simply hardcoded. That is
    how the total came to be labelled Monthly on a roofer's one-off job while
    the note underneath named a $40 fee that was nowhere on the document.

      recurringLines   priced per month
      ratedLines       a rate with no quantity, charged when used
      fixedLines       everything else: the actual one-off work

    isRetainer means every priced line recurs, which is the only case where
    the word Monthly is true of the total.
  */
  const recurringLines = required.filter((l) => l.unit === 'month');
  const ratedLines = required.filter((l) => Number(l.qty) === 0 && Number(l.unit_price) > 0);
  const fixedLines = required.filter(
    (l) => !recurringLines.includes(l) && !ratedLines.includes(l)
  );
  const isRetainer = recurringLines.length > 0 && fixedLines.length === 0;

  // Defensive: these are jsonb, and a hand-edited row could hold anything.
  // This page is public, so a bad value must render as nothing rather than
  // throw a 500 at a client who is trying to accept.
  const asList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
  const scopeIn = asList(estimate.scope_in);
  const scopeOut = asList(estimate.scope_out);

  /*
    The terms as they stood when this was sent, not as they stand now.

    A frozen copy on the estimate rather than a lookup into proposal_terms:
    the set it came from may have been edited or archived since, and this is
    what somebody agreed to. Defensive about the shape for the same reason
    scope_in is - it is jsonb on a public page, and a bad value must render as
    nothing rather than throw a 500 at a client trying to accept.
  */
  const frozenTerms: Array<{ q: string; a: string }> = Array.isArray(estimate.terms)
    ? (estimate.terms as Array<Record<string, unknown>>)
        .map((t) => ({
          q: typeof t?.heading === 'string' ? t.heading.trim() : '',
          a: typeof t?.body === 'string' ? t.body.trim() : '',
        }))
        .filter((t) => t.q.length > 0 && t.a.length > 0)
    : [];
  /*
    What this business calls the document, used everywhere on it.

    An agency sends a proposal, a contractor sends an estimate, and John quotes
    — the word is already decided per business, and the header was ignoring it
    on the right hand side.
  */
  const senderName =
    (((org?.settings as Record<string, unknown>)?.signature as { name?: string } | undefined)?.name ?? '').trim()
    || null;

  const vocabWord = (org as { kind?: string } | null)?.kind === 'agency' ? 'Proposal' : 'Estimate';

  const decided = ['accepted', 'declined'].includes(estimate.status);

  /*
    What is due on yes, from this proposal rather than from the workspace.

    The estimate carries its own kind and value, copied from the business
    default when it was built. Zero means none, and none means this page is
    exactly what it was before deposits existed - no line, no changed button,
    nothing.
  */
  const deposit: Deposit = {
    kind: estimate.deposit_kind === 'percent' || estimate.deposit_kind === 'fixed'
      ? estimate.deposit_kind
      : 'none',
    value: Number(estimate.deposit_value) || 0,
  };
  const depositDue = depositAmount(deposit, Number(estimate.total) || subtotal);

  return (
    /*
      The business at the top, as itself.

      This page began with a grey field and a floating Download button, and
      the sender's name appeared in small caps a third of the way down, inside
      the paper. A proposal is from somebody: their mark, their colour and
      their phone belong above the document, not in it.
    */
    <DocShell
      face={face}
      phone={face.phone}
      width={760}
      action={
        <div data-print-hide>
        <SaveAsPdf
          accent={accent}
          name={`${org?.name ?? ''} ${vocabWord} ${String(estimate.version).padStart(3, '0')} ${job?.customer?.name ?? ''}`}
          doc={{
            org: org?.name ?? '',
            preparedBy: senderName,
            reference: `${vocabWord} ${String(estimate.version).padStart(3, '0')}`,
            title: job?.name ?? '',
            preparedFor: job?.customer?.contact_name || job?.customer?.name || null,
            lines: required.map((l) => {
              const list = Number((l as { list_unit_price?: number }).list_unit_price ?? 0);
              const unit = Number(l.unit_price);
              const rateOnly = Number(l.qty) === 0 && unit > 0;
              const cut = list > 0 && list > unit;
              const [head, ...rest] = l.description.split(/\.\s+/);
              return {
                title: head.replace(/\.$/, ''),
                detail: rest.join('. ') || undefined,
                qty: rateOnly ? 'Hourly' : l.unit === 'month' ? 'Monthly' : `${Number(l.qty)}${l.unit ? ` ${l.unit}` : ''}`,
                amount: money(rateOnly ? unit : Number(l.total)),
                wasAmount: cut ? money(rateOnly ? list : list * Number(l.qty)) : undefined,
              };
            }),
            totals: (() => {
              const monthly = recurringLines.reduce((t, l) => t + Number(l.total), 0);
              const out = [{
                label: isRetainer ? 'Monthly' : 'Total',
                value: money(isRetainer ? monthly : (Number(estimate.total) || subtotal)),
              }];
              for (const r of ratedLines) out.push({ label: `Per ${r.unit ?? 'hour'} of work`, value: money(Number(r.unit_price)) });
              return out;
            })(),
            /* Same reasoning as the on-screen copy: no sentence is true for
               every business, so there is no hardcoded one. */
            note: (isRetainer && ratedLines.length > 0)
              ? 'The monthly amount is charged every month. The hourly rate is only charged for work you ask for.'
              : undefined,
            included: scopeIn,
            sections: [
              ...asQuestions(estimate.notes),
              ...(scopeOut.length ? [{ q: "What isn't included", a: scopeOut.join('\n\n') }] : []),
            ].map((x) => ({ heading: x.q, body: x.a })),
          }}
        />
        </div>
      }
    >
      <div
        data-document
        style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: radius.lg,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '26px 30px 0' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              {/*
                Who it is from, then what it is for.

                The company sat in the top right in small grey while the
                project name took the headline, so the first thing a client
                read was a job title with no sender attached. A proposal is
                from somebody.
              */}
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#111' }}>
                {org?.name}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#111', letterSpacing: '-0.2px', marginTop: 6 }}>
                {job?.name}
              </div>
              {job?.address && (
                <div style={{ fontSize: 14.5, color: '#555', marginTop: 4 }}>{job.address}</div>
              )}
              {job?.customer && (
                <div style={{ fontSize: 14.5, color: '#555', marginTop: 2 }}>
                  Prepared for {job.customer.contact_name || job.customer.name}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', fontSize: 13.5, color: '#666' }}>
              {/* The reference, where the sender used to be. */}
              <div style={{ ...numeralStyle, fontSize: 13, fontWeight: 600, color: '#111' }}>
                {vocabWord} {String(estimate.version).padStart(3, '0')}
              </div>
              {/*
                A person, not just a company.

                An elite proposal says who you will actually be dealing with.
                "CALO&CO" is who invoices; a name is who answers the phone when
                something goes wrong, and putting it here is the cheapest
                possible signal that somebody is accountable for this.
              */}
              {senderName && <div style={{ marginTop: 2 }}>Prepared by {senderName}</div>}

            </div>
          </div>

          {/*
            A line before the numbers.

            It opened straight into a price table, which asks somebody to read
            figures before they have been told what they are looking at or why
            it arrived. Two sentences of context, in the sender's own words,
            and then the money.
          */}
          {estimate.intro && (
            <div style={{ fontSize: 15, color: '#333', lineHeight: 1.65, marginTop: 20, maxWidth: '62ch' }}>
              {estimate.intro}
            </div>
          )}
        </div>

        {decided && (
          <div
            style={{
              margin: '22px 30px 0',
              padding: '12px 16px',
              borderRadius: 8,
              background: estimate.status === 'accepted' ? '#edf6f0' : '#f2f2ef',
              color: estimate.status === 'accepted' ? '#15803d' : '#555',
              fontSize: 14.5,
            }}
          >
            {estimate.status === 'accepted'
              ? `Accepted${estimate.decided_by_name ? ` by ${estimate.decided_by_name}` : ''} on ${fmtDate(estimate.decided_at)}. Thank you, we'll be in touch to schedule.`
              : `Declined on ${fmtDate(estimate.decided_at)}.`}
          </div>
        )}

        <div style={{ padding: '26px 30px' }}>
          {required.length === 0 ? (
            /*
              A total with no breakdown is a real thing, not a missing one.

              Every sent proposal in the demo is priced as a whole, and "No
              line items." reads like a fault in the document somebody is
              being asked to sign. This says what is actually true: the number
              below covers the work described above.
            */
            <div style={{ fontSize: 14.5, color: C.faint, lineHeight: 1.6 }}>
              Priced as a whole rather than itemised. The total below covers everything described above.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e4e4e0' }}>
                  <th style={{ textAlign: 'left', padding: '0 0 9px', fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#777', fontWeight: 600 }}>Work</th>
                  <th style={{ textAlign: 'right', padding: '0 0 9px 10px', fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#777', fontWeight: 600, whiteSpace: 'nowrap' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '0 0 9px 10px', fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#777', fontWeight: 600 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {required.map((l) => {
                  /*
                    A discount nobody can see is a discount nobody values.

                    Where a line carries a list price above what is being
                    charged, both are printed: what it costs everybody else,
                    struck, and what it costs them. The line decides — nothing
                    here is keyed on wording, so it cannot be switched on by
                    naming a row cleverly, and it turns itself off the day the
                    two prices match.
                  */
                  const list = Number((l as { list_unit_price?: number }).list_unit_price ?? 0);
                  const unit = Number(l.unit_price);
                  const cut = list > 0 && list > unit;
                  const rateOnly = Number(l.qty) === 0 && unit > 0;
                  const recurringLine = l.unit === 'month' && Number(l.qty) > 0;
                  return (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f0f0ed' }}>
                    {/*
                      The title, then what it means underneath.

                      "Platform access. Your workspace, your records, your
                      people, kept running." was one run-on line in a table
                      cell, so the thing being bought and the explanation of it
                      had the same weight. The first sentence is the item; the
                      rest is the detail.
                    */}
                    <td style={{ padding: '11px 0', color: '#222' }}>
                      <span style={{ fontWeight: 500 }}>
                        {l.description.split(/\.\s+/)[0].replace(/\.$/, '')}
                      </span>
                      {l.description.split(/\.\s+/).slice(1).join('. ') && (
                        <div style={{ fontSize: 13, color: '#666', marginTop: 3, lineHeight: 1.5 }}>
                          {l.description.split(/\.\s+/).slice(1).join('. ')}
                        </div>
                      )}
                      {/*
                        Said once, not twice.

                        The crossed-out price appeared here AND in the Amount
                        column, so every discounted line argued its own case
                        twice on one row. Once is persuasive; twice reads as a
                        page trying to talk somebody into something.

                        The money comparison lives in the money column. This
                        line just states the rate, which is the thing somebody
                        needs in words rather than as a sum.
                      */}

                    </td>
                    {/*
                      "1 month" and "0 hour" were both lies.

                      The first read as a single month rather than every month,
                      which is the difference between a one-off and a
                      subscription. The second was worse: a rate somebody will
                      certainly use, printed as a quantity of zero and an
                      amount of $0.00, on an account that already has hours
                      logged against it. It made the hourly look free.

                      A recurring line says how often. A rate line says what
                      the rate is and shows no total, because there is nothing
                      to total until somebody works an hour.
                    */}
                    <td style={{ padding: '11px 0 11px 10px', textAlign: 'right', color: '#666', whiteSpace: 'nowrap' }}>
                      {rateOnly ? 'Hourly' : recurringLine ? 'Monthly' : `${Number(l.qty)}${l.unit ? ` ${l.unit}` : ''}`}
                    </td>
                    <td style={{ padding: '11px 0 11px 10px', textAlign: 'right', color: '#222', whiteSpace: 'nowrap' }}>
                      {cut && (
                        <span style={{ textDecoration: 'line-through', color: '#999', marginRight: 7, fontSize: 13 }}>
                          {money(rateOnly ? list : list * Number(l.qty))}
                        </span>
                      )}
                      {money(rateOnly ? unit : Number(l.total))}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/*
            A total has to say what it is a total of.

            This proposal is a rate, not a quote: $20 of hosting that recurs
            and $60 an hour that depends entirely on what gets asked for. The
            page added the lines up and printed "Total $20.00", which reads as
            the price of the whole arrangement and is the one number on here
            nobody should take away. Mike read it off the proposal list and
            said the totals were wrong; they were.

            Where a line recurs, the figure is labelled by what it recurs on,
            and the rate lines are named underneath instead of being silently
            summed as zero.
          */}
          {(() => {
            const monthly = recurringLines.reduce((t, l) => t + Number(l.total), 0);
            const isRate = isRetainer;
            const rated = ratedLines;
            return (
              /*
                Two numbers, at the same weight, because there are two.

                It printed "Every month $40.00" at 24px with the hourly rate
                underneath in small grey. But $40 is only what this costs in a
                month where nobody asks for anything, and the hourly is the
                half that moves. Sizing one as the answer and the other as a
                footnote tells the reader the arrangement is cheaper than it
                is, which is the last thing a price should do.

                They sit side by side. Neither is the total, because there
                isn't one until somebody uses an hour.
              */
              <div style={{ marginTop: 22 }}>
                <div
                  style={{
                    display: 'flex', justifyContent: 'flex-end', gap: 34,
                    flexWrap: 'wrap', borderTop: '2px solid #1a1a1a', paddingTop: 14,
                  }}
                >
                  {/*
                    The label follows the lines. It used to say Monthly always.

                    This document is sent by every business on the platform,
                    and the word was hardcoded from the one arrangement it was
                    first written for — a $40 monthly platform fee. So a
                    roofer's $24,680 re-roof printed as $24,680 MONTHLY, in
                    24px, on the page the customer signs from.

                    Monthly only when every priced line is monthly. Otherwise
                    it is a total, because that is what it is.
                  */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: '#777', fontWeight: 600 }}>
                      {isRate ? 'Monthly' : 'Total'}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 600, color: '#111', marginTop: 3 }}>
                      {money(isRate ? monthly : Number(estimate.total) || subtotal)}
                    </div>
                    {/*
                      What is due on yes, under the total it comes out of.

                      Only when this proposal asks for one. A page with no
                      deposit is the page it was before the feature existed,
                      which is most of them.
                    */}
                    {!decided && depositDue > 0 && (
                      <div style={{ fontSize: 13.5, color: C.faint, marginTop: 5 }}>
                        {money(depositDue)} deposit when you accept
                      </div>
                    )}
                  </div>
                  {rated.map((l) => (
                    <div key={l.id} style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: '#777', fontWeight: 600 }}>
                        Per hour of work
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 600, color: '#111', marginTop: 3 }}>
                        {money(Number(l.unit_price))}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            );
          })()}

          {/*
            The clearest sentence in the document, where it can be read.

            It was three screens down inside an accordion, while the space
            under the numbers carried "You only pay for what actually gets
            done. This is what we expect; the invoice is built from..." which
            is throat-clearing. This is the line that answers the question
            somebody actually has when they see two prices.
          */}
          {/*
            This was one studio's own retainer wording, printed on every
            proposal every business on the platform sends. "The $40 covers the
            platform and your hosting" appeared above a roofer's re-roof and a
            startup's pilot, naming a price that was not on the document.

            There is no sentence that is true for all of them, so there is no
            hardcoded sentence. When an arrangement genuinely has a standing
            fee and a rate, the two prices above already say so, and anything
            further belongs in the estimate's own notes where whoever sent it
            wrote it.
          */}
          {isRetainer && ratedLines.length > 0 && (
            <div style={{ marginTop: 16, padding: '13px 15px', background: '#f7f7f5', borderRadius: 8, fontSize: 14.5, color: '#333', lineHeight: 1.6 }}>
              The monthly amount is charged every month. The hourly rate is only charged
              for work you ask for, so a quiet month costs the monthly amount alone.
            </div>
          )}

          {/*
            What you get folds like everything else, and starts open.

            It was a fixed list above a set of collapsible sections, so the one
            block somebody always reads was the only one that could not be put
            away once read. Same control as the rest, open on arrival.
          */}
          {/*
            The terms, and the exclusions, as questions.

            A wall of pre-wrapped text gets scrolled past and then asked about.
            The last one is built from scope_out rather than written twice, so
            what is excluded can never drift from what the record says.
          */}
          <Faq
            accent={accent}
            items={[
              ...(scopeIn.length
                ? [{
                    q: 'What you get',
                    a: scopeIn.map((x, i) => `${String(i + 1).padStart(2, '0')}  ${x}`).join('\n'),
                  }]
                : []),
              ...asQuestions(estimate.notes),
              ...(scopeOut.length
                ? [{
                    q: "What isn't included?",
                    a: scopeOut.join('\n\n') + "\n\nWant any of it? We'll quote it separately.",
                  }]
                : []),
              /* Last, and only when this proposal actually carries some.
                 Nothing renders otherwise - no fallback, because a fallback
                 is how three sentences about one arrangement came to be
                 printed under everybody's. */
              ...frozenTerms,
            ]}
          />

          {/*
            What happens after yes.

            The commonest thing missing from a proposal, and the thing every
            good one answers: somebody presses Accept and then has no idea
            whether that started a clock, created an obligation, or sent an
            email into a void. Three lines, fixed, because the process is the
            same every time and is not something anybody should have to
            remember to type.
          */}
          {/*
            The retainer script is gone.

            Three fixed sentences sat here on every proposal this product has
            ever sent: "Nothing changes today", a first invoice "on the first
            of the month", and no notice period. They describe one arrangement
            - a monthly platform retainer - and they were printed under a
            roofer's $24,680 re-roof and a studio's eight-week pilot alike. A
            customer signing that agreed to terms nobody had written for them.

            What replaces it is what the record actually holds: the terms the
            sender typed, the scope they listed, and the date it is good
            until. Where they have typed nothing, nothing is claimed.
          */}
          {!decided && (
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
              <AskAbout token={params.token} accent={accent} preview={isPreview} />
            </div>
          )}
        </div>

        <AddOns
          token={params.token}
          accent={accent}
          accentInk={face.accentInk}
          business={face.name || null}
          owner={owner ? { ...owner, initials: initialsOf(owner.fullName) } : null}
          depositDue={depositDue}
          decided={decided}
          preview={isPreview}
          baseTotal={Number(estimate.base_total ?? subtotal)}
          options={options.map((l) => ({ id: l.id, description: l.description, total: Number(l.total) }))}
        />
      </div>

      <Sent studio={studio} />
    </DocShell>
  );
}
