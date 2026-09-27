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
import { C, Card, Empty, Page, RowsLoading, SectionLabel } from '@/components/spine/ui';

export default function InboxPage() {
  const { org, vocab } = useOrg();
  const [options, setOptions] = useState<FilingOption[]>([]);
  const [filed, setFiled] = useState<Drop[]>([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org?.id) return;

    const [people, customers, jobs] = await Promise.all([
      supabase.from('customer_contacts').select('id, name').eq('org_id', org.id).order('name').limit(300),
      supabase.from('customers').select('id, name').eq('org_id', org.id).order('name').limit(300),
      /*
        Jobs too, because half of what lands here is about one.

        The shelf has always been able to file against a job - `fileDrop`
        takes a job_id and always has - and the inbox simply never offered
        one, so "a photo of the wrong flashing on Burnet Rd" could only be
        filed to the customer and lost which roof it was.

        Live ones only. Filing something to a job finished last spring is
        almost always a mis-tap, and a list of every job there has ever been
        is a list nobody can find anything in.
      */
      supabase.from('jobs').select('id, name')
        .eq('org_id', org.id)
        .in('status', ['lead', 'estimating', 'won', 'active'])
        .order('updated_at', { ascending: false }).limit(200),
    ]);

    setOptions([
      ...((people.data ?? []) as { id: string; name: string }[])
        .map((p) => ({ id: p.id, name: p.name, kind: 'person' as const })),
      ...((customers.data ?? []) as { id: string; name: string }[])
        .map((c) => ({ id: c.id, name: `${c.name} (${vocab.customer.toLowerCase()})`, kind: 'customer' as const })),
      ...((jobs.data ?? []) as { id: string; name: string }[])
        .map((j) => ({ id: j.id, name: `${j.name} (${vocab.job.toLowerCase()})`, kind: 'job' as const })),
    ]);

    try {
      const all = await listDrops({ orgId: org.id });
      setFiled(all.filter((d) => d.filed_at));
    } catch {
      setFiled([]);
    } finally {
      setLoading(false);
    }
  }, [org?.id, vocab.customer, vocab.job]);

  useEffect(() => { load(); }, [load, tick]);

  return (
    <Page
      title="Drops"
      subtitle="Anything you have not filed yet."
    >
      {!org?.id ? (
        <Empty>Pick a business first.</Empty>
      ) : loading ? (
        /* This screen had no loading state at all, which was survivable while
           it only held files somebody had just dragged in. It holds notes
           people typed now, and an empty pile and an unread pile look the
           same for the second it takes to find out which. */
        <div style={{ display: 'grid', gap: 18, maxWidth: 860 }}>
          <RowsLoading rows={3} />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18, maxWidth: 860 }}>
          <Card>
            {/* "Nothing here is lost, it just has not been said who it is
                about. Answer that on any item and it moves onto their record."
                Two sentences of reassurance about a list you are looking at,
                above a heading that already says Not filed yet. */}
            <SectionLabel>Not filed yet</SectionLabel>
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
