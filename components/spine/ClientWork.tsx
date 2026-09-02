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
import { C, Card, SectionLabel } from './ui';

interface Tile {
  label: string;
  count: number;
  href: string;
  hint?: string;
}

export function ClientWork({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [tiles, setTiles] = useState<Tile[]>([]);

  const load = useCallback(async () => {
    const [targets, brands, stories, pitches] = await Promise.all([
      supabase.from('targets').select('id, status', { count: 'exact', head: false }).eq('for_client_id', customerId),
      supabase.from('brands').select('id').eq('customer_id', customerId),
      supabase.from('case_studies').select('id').eq('customer_id', customerId),
      supabase.from('pitches').select('id').eq('customer_id', customerId),
    ]);

    const t = targets.data ?? [];
    const open = t.filter((x) => x.status !== 'won' && x.status !== 'passed').length;

    const next: Tile[] = [];
    if (t.length) next.push({ label: 'Targets', count: t.length, href: '/targets', hint: `${open} still open` });
    if (brands.data?.length) next.push({ label: 'Brands', count: brands.data.length, href: `/brands/${brands.data[0].id}` });
    if (stories.data?.length) next.push({ label: 'Case studies', count: stories.data.length, href: '/stories' });
    if (pitches.data?.length) next.push({ label: 'Pitches', count: pitches.data.length, href: '/pitches' });

    setTiles(next);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  if (tiles.length === 0) return null;

  return (
    <div style={{ marginBottom: 26 }}>
      <SectionLabel>Work for them</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {tiles.map((t) => (
          <Card key={t.label}>
            <div onClick={() => router.push(t.href)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                {t.count}
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
