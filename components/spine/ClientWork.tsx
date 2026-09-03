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
  /**
   * Optional, because some of these have nowhere honest to go yet.
   *
   * Case studies, pitches and reviews all linked to their global screen, none
   * of which can filter by client, so the tile promised this client's two
   * pitches and delivered everybody's. A count with no link is honest. A link
   * to an unfiltered list is not, and it is worse than no tile because it
   * costs a page load to discover.
   */
  href?: string;
  hint?: string;
  tone?: 'amber';
}

export function ClientWork({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [tiles, setTiles] = useState<Tile[]>([]);

  /**
   * One query, not ten.
   *
   * This fetched targets, brands, case studies, pitches, the ledger, invoices,
   * search and reviews separately, then made an eleventh call for documents
   * once the brand came back. At a third of a second each that is most of why
   * the record took seconds to settle, and client_overview was built for
   * exactly this and then not used.
   */
  const load = useCallback(async () => {
    const res = await supabase
      .from('client_overview')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();
    if (res.error || !res.data) return;
    const o = res.data as Record<string, number | string | null>;

    const n = (k: string) => Number(o[k] ?? 0);
    const next: Tile[] = [];

    // Money first, and only when there is money. A client owing nothing should
    // not be shown a zero: a zero reads as a problem somebody checked.
    if (n('owed') > 0) next.push({ label: 'Owed to you', money: n('owed'), href: `/jobs?client=${customerId}`, tone: 'amber' });
    if (n('unbilled') > 0) next.push({ label: 'Unbilled', money: n('unbilled'), href: `/jobs?client=${customerId}`, tone: 'amber' });
    if (n('engagements')) next.push({ label: 'Engagements', count: n('engagements'), href: `/jobs?client=${customerId}` });
    if (n('targets')) next.push({ label: 'Targets', count: n('targets'), href: `/targets?client=${customerId}`, hint: `${n('targets_open')} still open` });
    if (n('brands')) next.push({ label: 'Brand', count: n('brands'), href: `/brands/${o.brand_id}` });
    /**
     * Stays on the client.
     *
     * This used to jump to a screen headed Intel inside a brand, which is a
     * different object with a different breadcrumb, and you arrived with no
     * idea how you got there. The documents belong to the client, so the tile
     * opens the client's own Documents tab.
     */
    if (n('documents')) next.push({ label: 'Documents', count: n('documents'), href: `?tab=given` });
    if (n('case_studies')) next.push({ label: 'Case studies', count: n('case_studies') });
    if (n('pitches')) next.push({ label: 'Pitches', count: n('pitches') });
    if (n('reviews_asked')) next.push({ label: 'Reviews asked', count: n('reviews_asked'), hint: `${n('reviews_followed')} followed` });
    if (n('has_search')) next.push({ label: 'Search', count: 1, href: `/seo?client=${customerId}` });

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
            <div
              onClick={() => t.href && router.push(t.href)}
              style={{ cursor: t.href ? 'pointer' : 'default' }}
            >
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
