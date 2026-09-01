/**
 * The invoice a customer sees.
 *
 * Public, no login, reached by a capability token — a homeowner will not
 * create an account to pay a bill.
 *
 * The reason this page exists at all: the only way to send an invoice used to
 * be through Stripe, which meant card fees whether or not the customer wanted
 * to pay by card. Here every method the business accepts is listed, cheapest
 * to them first, and the customer picks.
 */

import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { METHODS, payLink, type PaymentMethod } from '@/lib/spine/payments';

export const dynamic = 'force-dynamic';

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

export default async function PublicInvoice({ params }: { params: { token: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) notFound();

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: invoice } = await db
    .from('job_invoices')
    .select('*, job:jobs(name, address, org_id, customer:customers(name, contact_name))')
    .eq('public_token', params.token)
    .maybeSingle();

  if (!invoice) notFound();

  const job = invoice.job as {
    name: string; address: string | null; org_id: string;
    customer: { name: string; contact_name: string | null } | null;
  } | null;

  const [{ data: lines }, { data: org }] = await Promise.all([
    db.from('job_invoice_lines').select('*').eq('invoice_id', invoice.id).order('position'),
    db.from('orgs').select('name, settings, payment_methods').eq('id', job?.org_id ?? '').maybeSingle(),
  ]);

  if (!invoice.viewed_at) {
    await db.from('job_invoices').update({ viewed_at: new Date().toISOString() }).eq('id', invoice.id);
  }

  const brand = ((org?.settings as Record<string, unknown>)?.brand ?? {}) as {
    colors?: Array<{ hex: string; role?: string }>; logoLight?: string;
  };
  const accent =
    brand.colors?.find((c) => /primary/i.test(c.role ?? ''))?.hex ?? brand.colors?.[0]?.hex ?? '#1a1a1a';

  const accepted = ((org?.payment_methods ?? []) as PaymentMethod[]).filter((m) => m.enabled);
  const owed = Number(invoice.total) - Number(invoice.amount_paid);
  const paid = invoice.status === 'paid' || owed <= 0;

  return (
    <div style={{ background: '#f5f5f3', minHeight: '100vh', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', border: '1px solid #e4e4e0', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ borderTop: `4px solid ${accent}`, padding: '28px 30px 0' }}>
          {brand.logoLight && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={brand.logoLight} alt={org?.name ?? ''} style={{ height: 40, objectFit: 'contain', marginBottom: 18 }} />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#111' }}>Invoice {invoice.number}</div>
              <div style={{ fontSize: 14.5, color: '#555', marginTop: 4 }}>{job?.name}</div>
              {job?.customer && (
                <div style={{ fontSize: 14.5, color: '#555', marginTop: 2 }}>
                  For {job.customer.contact_name || job.customer.name}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', fontSize: 13.5, color: '#666' }}>
              <div style={{ fontWeight: 600, color: '#111' }}>{org?.name}</div>
              {invoice.issued_on && <div style={{ marginTop: 4 }}>Issued {fmtDate(invoice.issued_on)}</div>}
              {invoice.due_on && <div>Due {fmtDate(invoice.due_on)}</div>}
            </div>
          </div>
        </div>

        {paid && (
          <div style={{ margin: '22px 30px 0', padding: '12px 16px', borderRadius: 8, background: '#edf6f0', color: '#15803d', fontSize: 14.5 }}>
            Paid in full{invoice.paid_at ? ` on ${fmtDate(invoice.paid_at)}` : ''}. Thank you.
          </div>
        )}

        <div style={{ padding: '26px 30px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e4e4e0' }}>
                <th style={{ textAlign: 'left', padding: '0 0 9px', fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#777', fontWeight: 600 }}>Work</th>
                <th style={{ textAlign: 'right', padding: '0 0 9px 10px', fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#777', fontWeight: 600 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(lines ?? []).map((l: Record<string, unknown>) => (
                <tr key={l.id as string} style={{ borderBottom: '1px solid #f0f0ed' }}>
                  <td style={{ padding: '11px 0', color: '#222' }}>
                    {l.description as string}
                    {Number(l.qty) !== 1 && (
                      <span style={{ color: '#888' }}> · {Number(l.qty)}{l.unit ? ` ${l.unit}` : ''}</span>
                    )}
                  </td>
                  <td style={{ padding: '11px 0 11px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {money(Number(l.total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18, alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontSize: 14, color: '#666' }}>{paid ? 'Total' : 'Amount due'}</span>
            <span style={{ fontSize: 26, fontWeight: 600, color: '#111' }}>
              {money(paid ? Number(invoice.total) : owed)}
            </span>
          </div>
        </div>

        {!paid && accepted.length > 0 && (
          <div style={{ borderTop: '1px solid #e4e4e0', padding: '24px 30px 28px', background: '#fafaf8' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4 }}>
              How to pay
            </div>
            <p style={{ fontSize: 13.5, color: '#666', margin: '0 0 16px' }}>
              Any of these works. Please include invoice {invoice.number} so it can be matched up.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {accepted.map((m) => {
                const spec = METHODS.find((x) => x.id === m.id);
                if (!spec) return null;
                return (
                  <div key={m.id} style={{ border: '1px solid #e4e4e0', borderRadius: 8, padding: '13px 15px', background: '#fff' }}>
                    <div style={{ fontSize: 14.5, fontWeight: 500, color: '#111' }}>{spec.label}</div>
                    <div style={{ fontSize: 13.5, color: '#666', marginTop: 3 }}>{spec.customerHint}</div>
                    {m.handle && (() => {
                      const link = payLink(m.id, m.handle, owed, `Invoice ${invoice.number}`);
                      return (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 15, color: '#111', fontWeight: 500, wordBreak: 'break-word' }}>
                            {m.handle}
                          </div>
                          {link && (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-block',
                                marginTop: 9,
                                padding: '8px 14px',
                                borderRadius: 7,
                                background: '#111',
                                color: '#fff',
                                fontSize: 14,
                                fontWeight: 500,
                                textDecoration: 'none',
                              }}
                            >
                              Open {spec.label} with {money(owed)} filled in
                            </a>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!paid && accepted.length === 0 && (
          <div style={{ borderTop: '1px solid #e4e4e0', padding: '20px 30px', background: '#fafaf8', fontSize: 14, color: '#666' }}>
            Reply to the email this came from to arrange payment.
          </div>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: '18px auto 0', textAlign: 'center', fontSize: 12.5, color: '#888' }}>
        Questions? Reply to the email this came from.
      </div>
    </div>
  );
}
