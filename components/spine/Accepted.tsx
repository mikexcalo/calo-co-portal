'use client';

/**
 * Somebody said yes.
 *
 * The best news this product carries, and it used to arrive as one line in
 * the notification tray next to a read receipt. Worse when a deposit was
 * involved: accepting drafts an invoice and deliberately does not send it, so
 * without a card on Home the money sat in a list waiting for somebody to
 * happen to look.
 *
 * Two ways off the screen and only two. Send the draft, or dismiss it. Both
 * are deliberate, which is the point - a card that expired by itself would
 * take an unsent invoice with it.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { Button, C, money, radius, SectionLabel } from './ui';
import { save as saveOrFail } from '@/lib/spine/save';

interface Accepted {
  id: string;
  jobId: string;
  jobName: string;
  customer: string;
  who: string | null;
  total: number;
  word: string;
  invoice: { id: string; number: string; total: number } | null;
}

/**
 * Acceptances still waiting on somebody.
 *
 * Anything with an unsent deposit draft, however old - that is money nobody
 * has asked for and it does not stop mattering. Anything else only for a
 * month: an acceptance from the spring that was never dismissed is not news,
 * and a Home screen that accumulates is a Home screen people stop reading.
 */
const RECENT_DAYS = 30;

export function AcceptedToReview({ orgId, word }: { orgId: string | null; word: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Accepted[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) { setRows([]); return; }

    const since = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString();
    const res = await supabase
      .from('estimates')
      .select('id, job_id, total, decided_at, decided_by_name, deposit_invoice_id, job:jobs(name, customer:customers(name))')
      .eq('org_id', orgId)
      .eq('status', 'accepted')
      .is('acceptance_dismissed_at', null)
      .order('decided_at', { ascending: false })
      .limit(20);

    const raw = (res.data ?? []) as Array<Record<string, unknown>>;
    const invoiceIds = raw.map((r) => r.deposit_invoice_id).filter(Boolean) as string[];

    /* One query for the drafts rather than one per card. Only drafts come
       back, so an invoice that has been sent simply has no row and its card
       drops out below. */
    const drafts = new Map<string, { id: string; number: string; total: number }>();
    if (invoiceIds.length) {
      const inv = await supabase
        .from('job_invoices')
        .select('id, number, total, status')
        .in('id', invoiceIds)
        .eq('status', 'draft');
      for (const i of (inv.data ?? []) as Array<Record<string, unknown>>) {
        drafts.set(String(i.id), { id: String(i.id), number: String(i.number), total: Number(i.total) });
      }
    }

    const one = <T,>(v: unknown): T | null => (Array.isArray(v) ? (v[0] as T) ?? null : (v as T) ?? null);

    setRows(
      raw
        .map((r) => {
          const job = one<{ name: string; customer: unknown }>(r.job);
          const customer = one<{ name: string }>(job?.customer);
          const invoice = r.deposit_invoice_id ? drafts.get(String(r.deposit_invoice_id)) ?? null : null;
          return {
            id: String(r.id),
            jobId: String(r.job_id),
            jobName: job?.name ?? '',
            customer: customer?.name ?? 'Somebody',
            who: (r.decided_by_name as string | null) ?? null,
            total: Number(r.total) || 0,
            word,
            invoice,
            decidedAt: String(r.decided_at ?? ''),
          };
        })
        /* Still owed a decision, or recent enough to still be news. */
        .filter((r) => r.invoice !== null || (r.decidedAt && r.decidedAt >= since))
        .map(({ decidedAt, ...rest }) => rest)
    );
  }, [orgId, word]);

  useEffect(() => { load(); }, [load]);

  const dismiss = async (id: string) => {
    setBusy(id);
    /* Off the screen straight away. The write is watched, so a refusal says
       so, and the row comes back on the next load if it did not land. */
    setRows((p) => p.filter((r) => r.id !== id));
    await saveOrFail(
      supabase.from('estimates').update({ acceptance_dismissed_at: new Date().toISOString() }).eq('id', id),
      'Clearing that'
    );
    setBusy(null);
  };

  if (!rows.length) return null;

  return (
    <div style={{ marginBottom: 30 }}>
      <SectionLabel>Just accepted ({rows.length})</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${C.green}`,
              borderRadius: radius.lg,
              background: C.panel,
              padding: '15px 16px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ minWidth: 220, flex: 1 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
                  fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: C.text,
                }}
              >
                {r.customer} accepted {r.jobName}.
              </div>
              <div style={{ fontSize: 13.5, color: C.faint, marginTop: 4, lineHeight: 1.5 }}>
                {/*
                  The deposit line is the reason this card exists. Accepting
                  drafts an invoice and deliberately does not send it, so the
                  card has to say the money is sitting there and hand over the
                  one control that does something about it.
                */}
                {r.invoice
                  ? `Deposit invoice ${r.invoice.number} for ${money(r.invoice.total)} is ready to review.`
                  : `${money(r.total)}${r.who ? `, signed ${r.who}` : ''}.`}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {r.invoice ? (
                <Button onClick={() => router.push(`/billing?invoice=${r.invoice!.id}`)}>
                  Open the draft
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => router.push(`/jobs/${r.jobId}`)}>
                  Open the {r.word.toLowerCase()}
                </Button>
              )}
              <Button variant="ghost" disabled={busy === r.id} onClick={() => dismiss(r.id)}>
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
