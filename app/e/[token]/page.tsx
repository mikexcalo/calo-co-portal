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
import type React from 'react';
import { notFound } from 'next/navigation';
import { SaveAsPdf } from './SaveAsPdf';
import { Faq } from '@/components/spine/Faq';
import { asQuestions } from '@/lib/spine/questions-from-notes';
import { AddOns } from './AddOns';
import { AskAbout } from './AskAbout';

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
    .select('job:jobs(name, org:orgs(name))')
    .eq('public_token', params.token)
    .maybeSingle();
  const job = data?.job as { name?: string; org?: { name?: string } } | null;
  return {
    title: job?.name ? `Proposal, ${job.name}` : 'Proposal',
    description: job?.org?.name ? `A proposal from ${job.org.name}.` : undefined,
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

  const { data: estimate } = await db
    .from('estimates')
    .select('*, job:jobs(id, name, address, billing_type, org_id, customer:customers(name, contact_name))')
    .eq('public_token', params.token)
    .maybeSingle();

  if (!estimate) notFound();

  const job = estimate.job as {
    name: string; address: string | null; billing_type: string; org_id: string;
    customer: { name: string; contact_name: string | null } | null;
  } | null;

  const [{ data: lines }, { data: org }] = await Promise.all([
    db.from('estimate_lines').select('*').eq('estimate_id', estimate.id).order('position'),
    db.from('orgs').select('name, settings, kind').eq('id', job?.org_id ?? '').maybeSingle(),
  ]);

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
  const isPreview = searchParams?.preview === '1';

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
      title: `${first} just opened your proposal`,
      body: `${job?.name ?? 'The proposal'}. No decision yet.`,
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
  const logo = brand.logoLight ?? brand.logos?.[0] ?? null;
  const accent =
    brand.colors?.find((c) => /primary/i.test(c.role ?? ''))?.hex ??
    brand.colors?.[0]?.hex ??
    '#1a1a1a';

  const rows = (lines ?? []) as Line[];
  // Required work only. Optional lines are priced separately below so the
  // headline number is what the job costs if they add nothing.
  const required = rows.filter((l) => !l.optional);
  const options = rows.filter((l) => l.optional);
  const subtotal = required.reduce((s, l) => s + Number(l.total), 0);

  // Defensive: these are jsonb, and a hand-edited row could hold anything.
  // This page is public, so a bad value must render as nothing rather than
  // throw a 500 at a client who is trying to accept.
  const asList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
  const scopeIn = asList(estimate.scope_in);
  const scopeOut = asList(estimate.scope_out);
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

  return (
    <div style={{ background: '#f5f5f3', minHeight: '100vh', padding: '24px 16px 60px' }}>
      {/*
        The one control that is not part of the document, above the document.

        Sat outside the white page on purpose: everything inside the card is
        the proposal and prints; this is the thing you press to print it, and
        it takes itself out of the printed copy.
      */}
      <div
        data-print-hide
        style={{
          maxWidth: 720,
          margin: '0 auto 12px',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <SaveAsPdf accent={accent} name={`${vocabWord} ${String(estimate.version).padStart(3, '0')} ${job?.customer?.name ?? ''}`} />
      </div>
      <div
        data-document
        style={{
          maxWidth: 720,
          margin: '0 auto',
          background: '#fff',
          border: '1px solid #e4e4e0',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div style={{ borderTop: `4px solid ${accent}`, padding: '28px 30px 0' }}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={org?.name ?? ''} style={{ height: 40, objectFit: 'contain', marginBottom: 18 }} />
          )}

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
            <div style={{ color: '#888', fontSize: 14 }}>No line items.</div>
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
            const recurring = required.filter((l) => l.unit === 'month');
            const rated = required.filter((l) => Number(l.qty) === 0 && Number(l.unit_price) > 0);
            const fixed = required.filter((l) => !recurring.includes(l) && !rated.includes(l));
            const monthly = recurring.reduce((t, l) => t + Number(l.total), 0);
            const isRate = recurring.length > 0 && fixed.length === 0;
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
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: '#777', fontWeight: 600 }}>
                      Monthly
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 600, color: '#111', marginTop: 3 }}>
                      {money(isRate ? monthly : Number(estimate.total) || subtotal)}
                    </div>
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
          <div style={{ marginTop: 16, padding: '13px 15px', background: '#f7f7f5', borderRadius: 8, fontSize: 14.5, color: '#333', lineHeight: 1.6 }}>
            The $40 covers the platform and your hosting. The hourly only gets charged when you
            actually ask for work, so plenty of months that's nothing.
          </div>

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
          {!decided && (
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #e4e4e0' }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#111', letterSpacing: '-0.01em', marginBottom: 12 }}>
                What happens when you approve
              </div>
              <div style={{ display: 'grid', gap: 10, fontSize: 14.5, color: '#333', lineHeight: 1.6, maxWidth: '62ch' }}>
                <div style={{ display: 'flex', gap: 13 }}>
                  <span style={{ ...numeralStyle, color: '#bbb', flexShrink: 0 }}>01</span>
                  <span>Nothing changes today. You keep using it exactly as you are.</span>
                </div>
                <div style={{ display: 'flex', gap: 13 }}>
                  <span style={{ ...numeralStyle, color: '#bbb', flexShrink: 0 }}>02</span>
                  <span>
                    Your first invoice arrives on the first of the month, covering the month
                    just gone. Every line is built from hours logged and receipts filed, so you
                    can check it against something that actually happened.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 13 }}>
                  <span style={{ ...numeralStyle, color: '#bbb', flexShrink: 0 }}>03</span>
                  <span>
                    Want to stop? Tell me and I'll switch it off that day. No notice
                    period, nothing to cancel, no last invoice for a month you did not use.
                  </span>
                </div>
              </div>
              <AskAbout token={params.token} accent={accent} />
            </div>
          )}
        </div>

        <AddOns
          token={params.token}
          accent={accent}
          decided={decided}
          baseTotal={Number(estimate.base_total ?? subtotal)}
          options={options.map((l) => ({ id: l.id, description: l.description, total: Number(l.total) }))}
        />
      </div>

      <div style={{ maxWidth: 720, margin: '18px auto 0', textAlign: 'center', fontSize: 12.5, color: '#888' }}>
        Questions? Just reply to the email this came from.
      </div>
    </div>
  );
}
