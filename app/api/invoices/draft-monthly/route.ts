/**
 * Build one client's invoice for the month, server side.
 *
 * draftInvoiceFromActuals lives in the browser bundle and runs as the signed-in
 * person. The cron has nobody signed in, so this is the same work behind the
 * service role, callable only by the scheduler.
 *
 * It creates a DRAFT. Nothing here sends anything.
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { apiError } from '@/lib/spine/errors';

export const runtime = 'nodejs';

const num = (v: unknown) => Number(v) || 0;
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.CRON_SECRET;
  if (!url || !key) return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const { orgId, jobId } = (await req.json()) as { orgId?: string; jobId?: string };
  if (!orgId || !jobId) return NextResponse.json({ error: 'Missing' }, { status: 400 });

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: job } = await db
    .from('jobs')
    .select('id, customer_id, material_markup_pct')
    .eq('id', jobId)
    .maybeSingle();

  const { data: terms } = await db
    .from('customer_terms')
    .select('monthly_fee, monthly_fee_for, platform_fee, billing_starts_on')
    .eq('org_id', orgId)
    .eq('customer_id', job?.customer_id ?? '')
    .maybeSingle();

  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 14);

  const { data: invoice, error: invErr } = await db
    .from('job_invoices')
    .insert({
      org_id: orgId,
      job_id: jobId,
      status: 'draft',
      issued_on: today.toISOString().slice(0, 10),
      due_on: due.toISOString().slice(0, 10),
      subtotal: 0,
      total: 0,
      amount_paid: 0,
    })
    .select('id, number')
    .single();
  if (invErr || !invoice) {
    return NextResponse.json(apiError('invoices/draft-monthly', invErr, 'Could not draft that invoice.'), { status: 500 });
  }

  /*
    invoiced_on holds the invoice, not the date.

    This wrote today's date into it. The column is a uuid with a foreign key to
    job_invoices, so Postgres rejected every one of these updates as invalid
    uuid syntax — and the error was thrown away, because only `data` was
    destructured. `time` came back null, no labor lines were built, and the
    invoice went out carrying the monthly fees and none of the hours. The hours
    stayed unbilled forever, since the next run skips a job that already has an
    invoice for the month.

    Nothing caught it because the two invoices on file were seeded by a
    migration, which did it correctly. This route had never actually run.
  */
  const [timeRes, costRes] = await Promise.all([
    db.from('time_entries').update({ invoiced_on: invoice.id })
      .eq('job_id', jobId).eq('billable', true).is('invoiced_on', null).select('*'),
    db.from('costs').update({ invoiced_on: invoice.id })
      .eq('job_id', jobId).is('invoiced_on', null).eq('billable', true).select('*'),
  ]);
  /* And it is not thrown away. A billing run that half-works has to say so. */
  for (const r of [timeRes, costRes]) {
    if (r.error) {
      await db.from('job_invoices').delete().eq('id', invoice.id);
      return NextResponse.json(apiError('invoices/draft-monthly', r.error), { status: 500 });
    }
  }
  const time = timeRes.data;
  const costs = costRes.data;

  type Line = Record<string, unknown>;
  const lines: Line[] = [];

  /*
    A part month is billed as a part month.

    Somebody who went live on the 21st owes ten days, not thirty, and the first
    invoice a client ever receives is the worst possible place to be
    approximately right. Before the start date there is nothing recurring to
    bill at all; in the month the start date lands in, the fee is charged for
    the days they actually had.

    Full months after that are just full months, which is almost always the
    case, so the arithmetic below runs once and then never matters again.
  */
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysInMonth = periodEnd.getDate();

  const startsOn = terms?.billing_starts_on ? new Date(`${terms.billing_starts_on}T00:00:00`) : null;
  const notYet = startsOn ? startsOn > periodEnd : false;
  const partial = startsOn && startsOn > periodStart && startsOn <= periodEnd;
  const billableDays = partial
    ? daysInMonth - startsOn.getDate() + 1
    : daysInMonth;
  const share = partial ? billableDays / daysInMonth : 1;
  const forDays = partial ? ` (${billableDays} of ${daysInMonth} days)` : '';

  /*
    Everything bills for the month just gone.

    The forward-billing version was the textbook answer and the wrong one for
    two people Mike talks to every week. One period on the invoice, one date on
    the calendar, nothing to explain: the 1st of October covers September, the
    fee and the hours alike.

    A subscription billed a month in arrears costs a month of float and buys
    an invoice nobody has to read twice.
  */
  const monthName = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const covers = monthName(new Date(today.getFullYear(), today.getMonth() - 1, 1));

  const platform = notYet ? 0 : round2(num(terms?.platform_fee) * share);
  const monthly = notYet ? 0 : round2(num(terms?.monthly_fee) * share);
  if (platform > 0) {
    lines.push({ kind: 'other', description: `Platform access, ${covers}${forDays}`, qty: 1,
      unit: 'month', unit_price: platform, total: platform, position: lines.length });
  }
  if (monthly > 0) {
    lines.push({ kind: 'other', description: `${terms?.monthly_fee_for || 'Monthly fee'}, ${covers}${forDays}`,
      qty: 1, unit: 'month', unit_price: monthly, total: monthly, position: lines.length });
  }

  for (const e of time ?? []) {
    const hours = num(e.hours);
    const rate = num(e.rate);
    lines.push({ kind: 'labor', description: `${e.description || 'Work'}, ${covers}`, qty: hours, unit: 'hr',
      unit_price: rate, total: round2(hours * rate), position: lines.length,
      source_time_entry_id: e.id });
  }

  for (const c of costs ?? []) {
    const markup = num(c.markup_pct ?? job?.material_markup_pct ?? 0);
    const billed = round2(num(c.amount) * (1 + markup / 100));
    lines.push({ kind: c.kind === 'subcontractor' ? 'subcontractor' : 'material',
      description: c.description || c.vendor || 'Materials', qty: 1, unit: null,
      unit_price: billed, total: billed, position: lines.length, source_cost_id: c.id });
  }

  if (!lines.length) {
    await db.from('job_invoices').delete().eq('id', invoice.id);
    return NextResponse.json({ ok: true, skipped: 'nothing to bill' });
  }

  /*
    These two were fire and forget, on the run that bills every client.

    If the lines fail to insert, the invoice exists with a total and nothing
    itemised. If the total fails to update, it goes out at zero. Both would
    have been discovered by a client reading an invoice, and the run would
    have reported ok either way — which is how the last billing bug survived
    a month.
  */
  const ins = await db.from('job_invoice_lines').insert(
    lines.map((l) => ({ ...l, invoice_id: invoice.id }))
  );
  if (ins.error) {
    console.error('[draft-monthly] lines failed, removing the empty invoice:', ins.error.message);
    await db.from('job_invoices').delete().eq('id', invoice.id);
    return NextResponse.json(
      { ok: false, error: 'Could not write the invoice lines. Nothing was left half-made.' },
      { status: 500 }
    );
  }

  const total = round2(lines.reduce((s, l) => s + num(l.total), 0));
  const upd = await db.from('job_invoices').update({ subtotal: total, total }).eq('id', invoice.id);
  if (upd.error) {
    console.error('[draft-monthly] total failed:', upd.error.message);
    return NextResponse.json(
      { ok: false, error: 'The lines are in but the total did not save. Open the invoice before it sends.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, number: invoice.number, total });
}
