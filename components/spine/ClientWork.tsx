'use client';

/**
 * What actually exists for this client.
 *
 * The client record is the screen everybody lands on, and it knew about five
 * things while the product had built twenty. John Litton's page showed five
 * empty boxes on the same day a hundred and four targets were loaded for him,
 * which is not a layout problem: nothing on his record could see them.
 *
 * So this is one strip that counts the real work and links to it, and it
 * renders nothing at all when there is nothing to show. An empty state for
 * every feature a client does not use is how a new record ends up being five
 * boxes of the word nothing.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { C, Card, SectionLabel, money0 } from './ui';

interface Tile {
  label: string;
  /** One or the other. Money formats differently and is never a count. */
  count?: number;
  money?: number;
  href: string;
  hint?: string;
  tone?: 'amber';
}

export function ClientWork({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [tiles, setTiles] = useState<Tile[]>([]);

  const load = useCallback(async () => {
    const [targets, brands, stories, pitches, jobs, invoices, seo, reviews] = await Promise.all([
      supabase.from('targets').select('id, status', { count: 'exact', head: false }).eq('for_client_id', customerId),
      supabase.from('brands').select('id').eq('customer_id', customerId),
      supabase.from('case_studies').select('id').eq('customer_id', customerId),
      supabase.from('pitches').select('id').eq('customer_id', customerId),
      supabase.from('job_ledger').select('job_id, invoiced_total, collected, unbilled_labor, unbilled_cost').eq('customer_id', customerId),
      supabase.from('job_invoices').select('total, amount_paid, status, job:jobs!inner(customer_id)').eq('job.customer_id', customerId),
      supabase.from('seo_profile').select('id').eq('customer_id', customerId).maybeSingle(),
      supabase.from('review_requests').select('id, clicked_at').eq('customer_id', customerId),
    ]);

    const t = targets.data ?? [];
    const open = t.filter((x) => x.status !== 'won' && x.status !== 'passed').length;

    const ledger = jobs.data ?? [];
    const owed = (invoices.data ?? [])
      .filter((i) => i.status !== 'void')
      .reduce((sum, i) => sum + (Number(i.total) - Number(i.amount_paid)), 0);
    const unbilled = ledger.reduce(
      (sum, r) => sum + Number(r.unbilled_labor ?? 0) + Number(r.unbilled_cost ?? 0),
      0
    );

    const next: Tile[] = [];

    /**
     * Money first, and only when there is money.
     *
     * A client who owes nothing should not be shown a zero: it reads as a
     * problem that has been checked rather than a fact that does not apply.
     */
    if (owed > 0) next.push({ label: 'Owed to you', money: owed, href: '/billing', tone: 'amber' });
    if (unbilled > 0) next.push({ label: 'Unbilled', money: unbilled, href: '/jobs', tone: 'amber' });
    if (ledger.length) next.push({ label: 'Engagements', count: ledger.length, href: '/jobs' });

    if (t.length) next.push({ label: 'Targets', count: t.length, href: '/targets', hint: `${open} still open` });
    if (brands.data?.length) next.push({ label: 'Brand', count: brands.data.length, href: `/brands/${brands.data[0].id}` });
    if (stories.data?.length) next.push({ label: 'Case studies', count: stories.data.length, href: '/stories' });
    if (pitches.data?.length) next.push({ label: 'Pitches', count: pitches.data.length, href: '/pitches' });

    const asked = reviews.data ?? [];
    if (asked.length) {
      next.push({
        label: 'Reviews asked',
        count: asked.length,
        href: '/reviews',
        hint: `${asked.filter((r) => r.clicked_at).length} followed`,
      });
    }
    if (seo.data) next.push({ label: 'Search', count: 1, href: `/seo?client=${customerId}` });

    setTiles(next);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  // Nothing to show means no heading either. A "Work for them" label above an
  // empty row is the same failure this component was built to remove.
  if (tiles.length === 0) return null;

  return (
    <div style={{ marginBottom: 26 }}>
      <SectionLabel>Work for them</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {tiles.map((t) => (
          <Card key={t.label}>
            <div onClick={() => router.push(t.href)} style={{ cursor: 'pointer' }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  color: t.tone === 'amber' ? C.amber : C.text,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {t.money != null ? money0(t.money) : t.count}
              </div>
              <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>{t.label}</div>
              {t.hint && <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{t.hint}</div>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
