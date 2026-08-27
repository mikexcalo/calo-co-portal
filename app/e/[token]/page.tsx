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
import { DecisionButtons } from './DecisionButtons';

export const dynamic = 'force-dynamic';

interface Line {
  id: string;
  kind: string;
  description: string;
  qty: number;
  unit: string | null;
  unit_price: number;
  total: number;
  position: number;
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

  const brand = ((org?.settings as Record<string, unknown>)?.brand ?? {}) as {
    colors?: Array<{ hex: string; role?: string }>;
    logoLight?: string;
  };
  const accent =
    brand.colors?.find((c) => /primary/i.test(c.role ?? ''))?.hex ??
    brand.colors?.[0]?.hex ??
    '#1a1a1a';

  const rows = (lines ?? []) as Line[];
  const subtotal = rows.reduce((s, l) => s + Number(l.total), 0);
  const decided = ['accepted', 'declined'].includes(estimate.status);
  const isTM = job?.billing_type === 'tm';

  return (
    <div style={{ background: '#f5f5f3', minHeight: '100vh', padding: '24px 16px 60px' }}>
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
          {brand.logoLight && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoLight} alt={org?.name ?? ''} style={{ height: 40, objectFit: 'contain', marginBottom: 18 }} />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#111', letterSpacing: '-0.2px' }}>
                {job?.name}
              </div>
              {job?.address && (
                <div style={{ fontSize: 13.5, color: '#555', marginTop: 4 }}>{job.address}</div>
              )}
              {job?.customer && (
                <div style={{ fontSize: 13.5, color: '#555', marginTop: 2 }}>
                  Prepared for {job.customer.contact_name || job.customer.name}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', fontSize: 12.5, color: '#666' }}>
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
              fontSize: 13.5,
            }}
          >
            {estimate.status === 'accepted'
              ? `Accepted${estimate.decided_by_name ? ` by ${estimate.decided_by_name}` : ''} on ${fmtDate(estimate.decided_at)}. Thank you — we'll be in touch to schedule.`
              : `Declined on ${fmtDate(estimate.decided_at)}.`}
          </div>
        )}

        <div style={{ padding: '26px 30px' }}>
          {rows.length === 0 ? (
            <div style={{ color: '#888', fontSize: 13 }}>No line items.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e4e4e0' }}>
                  <th style={{ textAlign: 'left', padding: '0 0 9px', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#777', fontWeight: 600 }}>Work</th>
                  <th style={{ textAlign: 'right', padding: '0 0 9px 10px', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#777', fontWeight: 600, whiteSpace: 'nowrap' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '0 0 9px 10px', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#777', fontWeight: 600 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f0f0ed' }}>
                    <td style={{ padding: '11px 0', color: '#222' }}>{l.description}</td>
                    <td style={{ padding: '11px 0 11px 10px', textAlign: 'right', color: '#666', whiteSpace: 'nowrap' }}>
                      {Number(l.qty)}{l.unit ? ` ${l.unit}` : ''}
                    </td>
                    <td style={{ padding: '11px 0 11px 10px', textAlign: 'right', color: '#222', whiteSpace: 'nowrap' }}>
                      {money(Number(l.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18, alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontSize: 13, color: '#666' }}>Total</span>
            <span style={{ fontSize: 24, fontWeight: 600, color: '#111' }}>
              {money(Number(estimate.total) || subtotal)}
            </span>
          </div>

          {isTM && (
            <div style={{ marginTop: 16, padding: 13, background: '#f7f7f5', borderRadius: 8, fontSize: 12.5, color: '#555', lineHeight: 1.6 }}>
              This is a <strong>time and materials</strong> estimate. It reflects the work
              expected; the final invoice is based on hours actually worked and materials
              actually used, and you&apos;ll be able to see both as the job goes.
            </div>
          )}

          {estimate.notes && (
            <div style={{ marginTop: 16, fontSize: 13, color: '#444', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {estimate.notes}
            </div>
          )}
        </div>

        {!decided && (
          <div style={{ borderTop: '1px solid #e4e4e0', padding: '22px 30px 26px', background: '#fafaf8' }}>
            <DecisionButtons token={params.token} accent={accent} />
          </div>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: '18px auto 0', textAlign: 'center', fontSize: 11.5, color: '#888' }}>
        Questions about this estimate? Reply to the email it came from.
      </div>
    </div>
  );
}
