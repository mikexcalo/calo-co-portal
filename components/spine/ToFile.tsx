'use client';

/**
 * The pile, said out loud on Home.
 *
 * Drops has always been a nav row, which is enough when the only things in it
 * are files somebody deliberately dragged there. It stopped being enough when
 * a note typed on a roof with nobody picked started landing in it: that note
 * is a thing somebody wrote and expects to see again, and a nav row you have
 * to think to visit is where it goes quiet.
 *
 * So Home says how many and offers the one tap. It shows nothing when the
 * pile is empty, which is most days - a card reading "0 to file" is a chore
 * the product invented for itself.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listDrops } from '@/lib/spine/drops';
import { Button, C, Card, radius } from './ui';

export function ToFile({ orgId }: { orgId: string | null }) {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);
  const [newest, setNewest] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    (async () => {
      if (!orgId) return;
      try {
        const rows = await listDrops({ orgId, unfiledOnly: true });
        if (off) return;
        setCount(rows.length);
        /* The most recent one, in its own words, so the card is about
           something rather than about a number. */
        const first = rows.find((d) => (d.body ?? '').trim());
        setNewest(first ? (first.body ?? '').trim() : null);
      } catch {
        /* A count that cannot be read is not worth a red banner on Home.
           The row stays hidden and Drops itself will say so. */
        if (!off) setCount(0);
      }
    })();
    return () => { off = true; };
  }, [orgId]);

  if (!count) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <Card style={{ borderLeft: `3px solid ${C.amber}`, borderRadius: radius.lg }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 3 }}>
              {count} to file
            </div>
            <div
              style={{
                fontSize: 13.5, color: C.dim, lineHeight: 1.5,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {newest ?? 'Saved without a subject, waiting for you to say who they are about.'}
            </div>
          </div>
          <Button onClick={() => router.push('/inbox')}>Open Drops</Button>
        </div>
      </Card>
    </div>
  );
}
