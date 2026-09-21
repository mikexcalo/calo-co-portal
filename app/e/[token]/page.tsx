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
import { notFound } from 'next/navigation';
import { SaveAsPdf } from './SaveAsPdf';
import { AddOns } from './AddOns';

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

export default async function PublicEstimate({ params }: { params: { token: string } }) {
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
    db.from('orgs').select('name, settings').eq('id', job?.org_id ?? '').maybeSingle(),
  ]);

  // Record the first open. "Sent but never opened" is a different problem
  // from "opened and ignored", and only one of them needs a nudge.
  if (!estimate.viewed_at) {
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
  const decided = ['accepted', 'declined'].includes(estimate.status);
  const isTM = job?.billing_type === 'tm';

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
        <SaveAsPdf accent={accent} />
      </div>
      <div
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
              <div style={{ fontSize: 22, fontWeight: 600, color: '#111', letterSpacing: '-0.2px' }}>
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
              <div style={{ fontWeight: 600, color: '#111' }}>{org?.name}</div>
              {estimate.valid_until && <div style={{ marginTop: 4 }}>Valid until {fmtDate(estimate.valid_until)}</div>}
              <div>Estimate #{estimate.version}</div>
            </div>
          </div>
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
              ? `Accepted${estimate.decided_by_name ? ` by ${estimate.decided_by_name}` : ''} on ${fmtDate(estimate.decided_at)}. Thank you — we'll be in touch to schedule.`
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
                  return (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f0f0ed' }}>
                    <td style={{ padding: '11px 0', color: '#222' }}>
                      {l.description}
                      {cut && (
                        <div style={{ fontSize: 12.5, marginTop: 3 }}>
                          <span style={{ textDecoration: 'line-through', color: '#999' }}>
                            {money(list)}
                          </span>
                          <span style={{ color: '#15803d', marginLeft: 7 }}>
                            {money(unit)}{l.unit ? ` a ${l.unit}` : ''} for you
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '11px 0 11px 10px', textAlign: 'right', color: '#666', whiteSpace: 'nowrap' }}>
                      {Number(l.qty)}{l.unit ? ` ${l.unit}` : ''}
                    </td>
                    <td style={{ padding: '11px 0 11px 10px', textAlign: 'right', color: '#222', whiteSpace: 'nowrap' }}>
                      {cut && Number(l.qty) > 0 && (
                        <span style={{ textDecoration: 'line-through', color: '#999', marginRight: 7, fontSize: 13 }}>
                          {money(list * Number(l.qty))}
                        </span>
                      )}
                      {money(Number(l.total))}
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
              <div style={{ marginTop: 18, textAlign: 'right' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 14 }}>
                  <span style={{ fontSize: 14, color: '#666' }}>{isRate ? 'Every month' : 'Total'}</span>
                  <span style={{ fontSize: 24, fontWeight: 600, color: '#111' }}>
                    {money(isRate ? monthly : Number(estimate.total) || subtotal)}
                  </span>
                </div>
                {rated.map((l) => (
                  <div key={l.id} style={{ fontSize: 13.5, color: '#555', marginTop: 5 }}>
                    plus {money(Number(l.unit_price))} an {l.unit ?? 'hour'}, for the {l.unit ?? 'hour'}s you use
                  </div>
                ))}
              </div>
            );
          })()}

          {isTM && (
            <div style={{ marginTop: 16, padding: 13, background: '#f7f7f5', borderRadius: 8, fontSize: 13.5, color: '#555', lineHeight: 1.6 }}>
              {/* Said the way somebody would say it, not the way a contract would. */}
              You only pay for what actually gets done. This is what we expect; the
              invoice is built from the hours logged and the receipts filed, and you&apos;ll
              see every one of them as we go.
            </div>
          )}

          {/*
            Scope, on the page they accept.
            
            Both lists sit above the notes and below the price, because this is
            the moment the reader is deciding, and the exclusions are the half
            they will otherwise assume in their own favor. Shown at the same
            weight as the inclusions on purpose.
          */}
          {(scopeIn.length > 0 || scopeOut.length > 0) && (
            /*
              Two lists that had nothing holding them apart.

              Bare bullets in two columns under two grey labels, so at a glance
              the page had one long list with a gap down the middle and the
              second half — the half saying what you are NOT getting — read as
              more of the first. Each side sits on its own card now, and each
              line carries a mark that says which list it is in: a tick for
              what is included, a dash for what is not.
            */
            <div
              style={{
                marginTop: 22,
                display: 'grid',
                gridTemplateColumns: scopeIn.length && scopeOut.length ? 'repeat(auto-fit, minmax(250px, 1fr))' : '1fr',
                gap: 14,
              }}
            >
              {scopeIn.length > 0 && (
                <div style={{ border: '1px solid #e4e4e0', borderRadius: 10, padding: '14px 16px 16px', background: '#fcfcfb' }}>
                  <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#15803d', fontWeight: 700, marginBottom: 10 }}>
                    What you get
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 14, color: '#333', lineHeight: 1.6 }}>
                    {scopeIn.map((x, i) => (
                      <li key={i} style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
                        <span style={{ color: '#15803d', flexShrink: 0, fontWeight: 700 }}>&#10003;</span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {scopeOut.length > 0 && (
                <div style={{ border: '1px solid #e4e4e0', borderRadius: 10, padding: '14px 16px 16px', background: '#fcfcfb' }}>
                  <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#777', fontWeight: 700, marginBottom: 10 }}>
                    What it doesn&apos;t
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 14, color: '#333', lineHeight: 1.6 }}>
                    {scopeOut.map((x, i) => (
                      <li key={i} style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
                        <span style={{ color: '#aaa', flexShrink: 0, fontWeight: 700 }}>&ndash;</span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                  <div style={{ fontSize: 12.5, color: '#777', marginTop: 4, lineHeight: 1.55 }}>
                    Want any of it? We&apos;ll quote it separately.
                  </div>
                </div>
              )}
            </div>
          )}

          {estimate.notes && (
            <div style={{ marginTop: 20, fontSize: 14, color: '#444', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {estimate.notes}
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
