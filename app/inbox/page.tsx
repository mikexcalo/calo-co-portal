'use client';

/**
 * One place to put a thing you have not decided about yet.
 *
 * Everything else in here needs to know what a thing is before it will accept
 * it: a receipt goes to Receipts, a contract to Records, a logo to a client
 * who already exists. So anything that arrives before its subject does —
 * a prospect's brand files, a screenshot of a competitor's pricing, a phone
 * number on the back of a card — had nowhere to go and went nowhere.
 *
 * This asks one question, and only when you are ready to answer it: who is
 * this about? Until then it sits in a list that is honest about being a pile.
 * A pile you can see beats a pile in your downloads folder.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { DropShelf, type FilingOption } from '@/components/spine/DropShelf';
import { listDrops, type Drop } from '@/lib/spine/drops';
import { C, Card, Empty, Page, SectionLabel } from '@/components/spine/ui';

export default function InboxPage() {
  const { org, vocab } = useOrg();
  const [options, setOptions] = useState<FilingOption[]>([]);
  const [filed, setFiled] = useState<Drop[]>([]);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!org?.id) return;

    const [people, customers] = await Promise.all([
      supabase.from('customer_contacts').select('id, name').eq('org_id', org.id).order('name').limit(300),
      supabase.from('customers').select('id, name').eq('org_id', org.id).order('name').limit(300),
    ]);

    setOptions([
      ...((people.data ?? []) as { id: string; name: string }[])
        .map((p) => ({ id: p.id, name: p.name, kind: 'person' as const })),
      ...((customers.data ?? []) as { id: string; name: string }[])
        .map((c) => ({ id: c.id, name: `${c.name} (${vocab.customer.toLowerCase()})`, kind: 'customer' as const })),
    ]);

    try {
      const all = await listDrops({ orgId: org.id });
      setFiled(all.filter((d) => d.filed_at));
    } catch {
      setFiled([]);
    }
  }, [org?.id, vocab.customer]);

  useEffect(() => { load(); }, [load, tick]);

  return (
    <Page
      title="Unfiled"
      subtitle="A shelf for things that arrived before you knew where they go — a logo, a screenshot, a link, a note to yourself. Say who it is about whenever you like, or never."
    >
      {!org?.id ? (
        <Empty>Pick a business first.</Empty>
      ) : (
        <div style={{ display: 'grid', gap: 18, maxWidth: 860 }}>
          <Card>
            <SectionLabel>Not filed yet</SectionLabel>
            <p style={{ fontSize: 12.5, color: C.faint, margin: '6px 0 12px' }}>
              Nothing here is lost — it just has not been said who it is about.
              Answer that on any item and it moves onto their record.
            </p>
            <DropShelf
              orgId={org.id}
              filingOptions={options}
              onChange={() => setTick((t) => t + 1)}
            />
          </Card>

          {filed.length > 0 && (
            <Card>
              <SectionLabel>Filed</SectionLabel>
              <p style={{ fontSize: 12.5, color: C.faint, margin: '6px 0 12px' }}>
                {filed.length} {filed.length === 1 ? 'thing has' : 'things have'} a
                home. You will find each one on the record it belongs to.
              </p>
            </Card>
          )}
        </div>
      )}
    </Page>
  );
}
