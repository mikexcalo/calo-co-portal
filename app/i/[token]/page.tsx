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
import { SaveAsPdf } from '../../e/[token]/SaveAsPdf';
import { METHODS, payLink, type PaymentMethod } from '@/lib/spine/payments';
import { clientFace, telHref } from '@/lib/spine/client-face';
import { ownerOf } from '@/lib/spine/doc-owner';
import { C, radius } from '@/lib/spine/tokens';
import { DocShell, Ink, Sent } from '@/components/public/DocShell';

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

/* The invoice number is the name anybody files it under. */
export async function generateMetadata({ params }: { params: { token: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { title: 'Invoice' };
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db
    .from('job_invoices')
    .select('number')
    .eq('public_token', params.token)
    .maybeSingle();
  return { title: data?.number ? `Invoice ${data.number}` : 'Invoice' };
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

export default async function PublicInvoice({ params }: { params: { token: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) notFound();

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: invoice } = await db
    .from('job_invoices')
    .select('*, job:jobs(name, address, org_id, customer_id, customer:customers(name, contact_name))')
    .eq('public_token', params.token)
    .maybeSingle();

  if (!invoice) notFound();

  const job = invoice.job as {
    name: string; address: string | null; org_id: string;
    customer: { name: string; contact_name: string | null } | null;
  } | null;

  const [{ data: lines }, { data: org }, { data: terms }] = await Promise.all([
    db.from('job_invoice_lines').select('*').eq('invoice_id', invoice.id).order('position'),
    db.from('orgs').select('name, settings, payment_methods').eq('id', job?.org_id ?? '').maybeSingle(),
    /*
      What they would have paid.

      An invoice that prints $60.00 states a price. It does not say the price
      is half, which is the whole point of the arrangement and the thing that
      quietly stops being visible the moment it becomes routine. The standard
      rate is already recorded on the agreed terms, so the discount is read
      from what was agreed rather than typed onto the document.
    */
    db.from('customer_terms')
      .select('hourly_rate, standard_rate')
      .eq('org_id', job?.org_id ?? '')
      .eq('customer_id', (invoice.job as { customer_id?: string } | null)?.customer_id ?? '')
      .maybeSingle(),
  ]);

  /*
    The same signal on an invoice as on a proposal.

    Knowing somebody has opened a bill is the difference between chasing a
    person who never got it and leaving alone a person who is getting to it.
    First open only.
  */
  if (!invoice.viewed_at) {
    const client = job?.customer?.contact_name || job?.customer?.name || 'Somebody';
    await db.from('notifications').insert({
      org_id: job?.org_id ?? invoice.org_id,
      kind: 'system',
      title: `${client.split(/\s+/)[0]} opened invoice ${invoice.number}`,
      body: `${money(Number(invoice.total))}. Not paid yet.`,
    }).then(undefined, () => {});
  }

  if (!invoice.viewed_at) {
    await db.from('job_invoices').update({ viewed_at: new Date().toISOString() }).eq('id', invoice.id);
  }


  const face = clientFace(org);
  const owner = await ownerOf(db, job?.org_id ?? invoice.org_id);

  const accepted = ((org?.payment_methods ?? []) as PaymentMethod[]).filter((m) => m.enabled);
  /*
    Enabled is not the same as payable.

    One demo business has four methods switched on and an empty handle on
    every one of them, so a customer was shown "Venmo — send to this Venmo
    username" with no username under it. A method you cannot actually send
    money to is a dead end wearing a heading, so the ones with nothing behind
    them are not offered at all.

    `handleLabel === null` marks the two that genuinely need no detail: paying
    by card online, and handing over cash.
  */
  const payable = accepted.filter((m) => {
    const spec = METHODS.find((x) => x.id === m.id);
    if (!spec) return false;
    return spec.handleLabel === null ? true : Boolean(m.handle?.trim());
  });
  const online = payable.find((m) => m.id === 'stripe');

  const total = Number(invoice.total);
  const received = Number(invoice.amount_paid);
  const owed = total - received;
  const paid = invoice.status === 'paid' || owed <= 0;

  /* Whole days, from the due date, in the reader's own day - not the
     server's. An invoice one hour past midnight is not a day late. */
  const daysLate = (() => {
    if (paid || !invoice.due_on) return 0;
    const [y, m, d] = String(invoice.due_on).slice(0, 10).split('-').map(Number);
    if (!y) return 0;
    const due = new Date(y, m - 1, d).getTime();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((today.getTime() - due) / 86400000));
  })();

  const status: { label: string; bg: string; fg: string } =
    paid
      ? { label: 'Paid in full', bg: C.greenSoft, fg: C.green }
      : daysLate > 0
        ? { label: `${daysLate} day${daysLate === 1 ? '' : 's'} overdue`, bg: C.redSoft, fg: C.red }
        : received > 0
          ? { label: `${money(received)} received`, bg: C.amberSoft, fg: C.amber }
          : { label: invoice.due_on ? `Due ${fmtDate(invoice.due_on)}` : 'Due on receipt', bg: C.panelAlt, fg: C.dim };

  const forWhom = job?.customer?.contact_name || job?.customer?.name || null;

  const pdf = (
    <SaveAsPdf
      accent={face.accent}
      name={`${face.name} Invoice ${invoice.number}`}
      doc={{
        org: face.name,
        reference: `Invoice ${invoice.number}`,
        title: job?.name ?? '',
        preparedFor: forWhom,
        lines: (lines ?? []).map((l: Record<string, unknown>) => {
          const [firstSentence, ...rest] = String(l.description ?? '').split(/\.\s+/);
          return {
            title: firstSentence.replace(/\.$/, ''),
            detail: rest.join('. ') || undefined,
            qty: Number(l.qty) !== 1 ? `${Number(l.qty)}${l.unit ? ` ${l.unit}` : ''}` : '',
            amount: money(Number(l.total)),
          };
        }),
        totals: [{ label: paid ? 'Total' : 'Amount due', value: money(paid ? total : owed) }],
        note: invoice.due_on ? `Due ${fmtDate(invoice.due_on)}.` : null,
        included: [],
        sections: [],
      }}
    />
  );

  const payHref = online ? payLink('stripe', online.handle, owed, `Invoice ${invoice.number}`) : null;

  return (
    <DocShell face={face} phone={face.phone} action={pdf}>
      {/*
        What is owed, how late it is, and who it is for. Nothing else at the
        top: this is the one screen where a person is deciding whether to pay
        something today, and every other fact on the page is subordinate to
        the number.
      */}
      <section
        style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: radius.lg,
          padding: '20px 20px 22px', marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, color: C.faint }}>Invoice {invoice.number}</span>
          <span
            style={{
              background: status.bg, color: status.fg, fontSize: 12.5, fontWeight: 600,
              padding: '4px 11px', borderRadius: 20, whiteSpace: 'nowrap',
            }}
          >
            {status.label}
          </span>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
            fontWeight: 600, letterSpacing: '-0.03em',
            fontSize: 'clamp(38px, 11vw, 52px)', lineHeight: 1.05,
            color: C.text, margin: '10px 0 8px',
          }}
        >
          {money(paid ? total : owed)}
        </div>

        <div style={{ fontSize: 14.5, color: C.faint, lineHeight: 1.5 }}>
          {[
            paid
              ? invoice.paid_at ? `Paid ${fmtDate(invoice.paid_at)}` : 'Settled'
              : invoice.due_on
                ? `${daysLate > 0 ? 'Was due' : 'Due'} ${fmtDate(invoice.due_on)}`
                : null,
            forWhom ? `for ${forWhom}` : null,
          ].filter(Boolean).join(' · ')}
        </div>

        {/* Only where part of it has landed. Subtracting a payment in silence
            is how somebody who has already sent half sees a smaller number
            and no record that their money arrived. */}
        {received > 0 && !paid && (
          <div style={{ fontSize: 13.5, color: C.dim, marginTop: 10 }}>
            {money(total)} invoiced, {money(received)} received.
          </div>
        )}
      </section>

      <section
        style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: radius.lg,
          padding: '6px 20px 18px', marginBottom: 14,
        }}
      >
        {(lines ?? []).map((l: Record<string, unknown>, i: number) => {
          /*
            Show the discount, do not claim it. A line charged at the agreed
            hourly rate is priced below the standard rate, and the only honest
            way to say so is to print both. The test is the rate, not the
            line's wording, so it cannot be switched on by naming a line
            cleverly.
          */
          const unit = Number(l.unit_price);
          const std = Number(terms?.standard_rate ?? 0);
          const agreed = Number(terms?.hourly_rate ?? 0);
          const discounted = std > 0 && agreed > 0 && unit === agreed && std > agreed;
          return (
            <div
              key={l.id as string}
              style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
                padding: '14px 0', borderBottom: `1px solid ${C.border}`,
                ...(i === 0 ? { paddingTop: 16 } : {}),
              }}
            >
              <div style={{ fontSize: 15.5, color: C.text, lineHeight: 1.4, minWidth: 0 }}>
                {l.description as string}
                {Number(l.qty) !== 1 && (
                  <span style={{ color: C.faint }}> · {Number(l.qty)}{l.unit ? ` ${l.unit}` : ''}</span>
                )}
                {discounted && (
                  <div style={{ fontSize: 13, color: C.green, marginTop: 3 }}>
                    Your rate {money(agreed)}, standard is{' '}
                    <span style={{ textDecoration: 'line-through', color: C.faint }}>{money(std)}</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 15.5, color: C.text, whiteSpace: 'nowrap' }}>
                {money(Number(l.total))}
              </div>
            </div>
          );
        })}

        <div
          style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 16, paddingTop: 16,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
            {paid ? 'Total' : received > 0 ? 'Still due' : 'Total due'}
          </span>
          <span style={{ fontSize: 17, fontWeight: 700, color: C.text }}>
            {money(paid ? total : owed)}
          </span>
        </div>
      </section>

      {/*
        Where the money goes, when there is somewhere for it to go.

        Online payment gets the sticky button at the foot of the screen; the
        rest are instructions, so they are a list here and the sticky bar
        points at it. Neither appears when nothing is connected, because a
        button that cannot take a payment is worse than a sentence saying so.
      */}
      {!paid && payable.length > 0 && !online && (
        <section
          id="how-to-pay"
          style={{
            background: C.panel, border: `1px solid ${C.border}`, borderRadius: radius.lg,
            padding: '18px 20px 20px', marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>How to pay</div>
          <p style={{ fontSize: 13.5, color: C.faint, margin: '4px 0 14px', lineHeight: 1.5 }}>
            Whichever is easiest. Put {invoice.number} on it so {face.name} can match it up.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {payable.map((m) => {
              const spec = METHODS.find((x) => x.id === m.id);
              if (!spec) return null;
              const link = m.handle ? payLink(m.id, m.handle, owed, `Invoice ${invoice.number}`) : null;
              return (
                <div key={m.id} style={{ border: `1px solid ${C.border}`, borderRadius: radius.md, padding: '13px 15px' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{spec.label}</div>
                  <div style={{ fontSize: 13.5, color: C.faint, marginTop: 3, lineHeight: 1.5 }}>{spec.customerHint}</div>
                  {m.handle && (
                    <div style={{ fontSize: 15, color: C.text, fontWeight: 500, marginTop: 8, wordBreak: 'break-word' }}>
                      {m.handle}
                    </div>
                  )}
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', minHeight: 48, marginTop: 10,
                        padding: '0 18px', borderRadius: radius.pill,
                        background: face.accent, color: face.accentInk,
                        fontSize: 15, fontWeight: 600, textDecoration: 'none',
                      }}
                    >
                      Open {spec.label} with {money(owed)} filled in
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!paid && payable.length === 0 && (
        <section
          style={{
            background: C.panel, border: `1px solid ${C.border}`, borderRadius: radius.lg,
            padding: '18px 20px', marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>How to pay</div>
          {/*
            No button, because there is nothing behind one. This is the honest
            version of the old "reply to the email this came from": it names
            the business, and it gives their own phone and address where those
            are on the record rather than leaving a customer with an email
            thread as the only route.
          */}
          <p style={{ fontSize: 14.5, color: C.dim, margin: '6px 0 0', lineHeight: 1.55 }}>
            {face.name} has not set up online payment for this invoice.{' '}
            {face.phone || face.email
              ? 'Get in touch and they will tell you where to send it.'
              : 'Reply to the email this came from and they will tell you where to send it.'}
          </p>
          {(face.phone || face.email) && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              {face.phone && <Ink href={telHref(face.phone)}>{face.phone}</Ink>}
              {face.email && <Ink href={`mailto:${face.email}`}>{face.email}</Ink>}
            </div>
          )}
        </section>
      )}

      {/* A number to ring, where the business has given one. Named, because
          "call the contractor" is a chore and "Call Dana" is a person. */}
      {face.phone && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <Ink href={telHref(face.phone)}>
            {owner?.firstName ? `Call ${owner.firstName}` : `Call ${face.name}`}
          </Ink>
        </div>
      )}

      <Sent />

      {/*
        The one filled thing on the page, stuck to the bottom of a phone.

        Only when money can actually move: an online link where the business
        takes card, otherwise a jump to the instructions. When nothing is
        connected there is no bar at all.
      */}
      {!paid && (payHref || payable.length > 0) && (
        <div
          style={{
            position: 'sticky', bottom: 0, marginTop: 18,
            padding: '12px 0 calc(10px + env(safe-area-inset-bottom, 0px))',
            background: C.panelAlt, borderTop: `1px solid ${C.border}`,
          }}
        >
          <a
            href={payHref ?? '#how-to-pay'}
            {...(payHref ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 56, borderRadius: radius.pill,
              background: face.accent, color: face.accentInk,
              fontSize: 17, fontWeight: 700, textDecoration: 'none',
            }}
          >
            {payHref ? `Pay ${money(owed)}` : 'How to pay'}
          </a>
          {payHref && (
            <div style={{ fontSize: 12.5, color: C.faint, textAlign: 'center', marginTop: 8 }}>
              Card or bank transfer · processed securely by Stripe
            </div>
          )}
        </div>
      )}
    </DocShell>
  );
}
