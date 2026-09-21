'use client';

/**
 * What somebody is waiting on you for.
 *
 * The same rows the bell shows, but on the screen you open first and large
 * enough to read. A task that only lives in a tray is a task you have to
 * remember to go looking for.
 *
 * Disappears entirely when there is nothing, rather than sitting there as an
 * empty heading teaching you to scroll past it.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { save as saveOrFail } from '@/lib/spine/save';
import { Button, C, Card, SectionLabel } from './ui';

interface Ask {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  created_at: string;
}

export function AskedOfYou() {
  const [rows, setRows] = useState<Ask[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase
      .from('notifications')
      .select('id, title, body, href, created_at')
      .eq('kind', 'system')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(10);
    if (!res.error) setRows((res.data ?? []) as Ask[]);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function done(id: string) {
    setRows((p) => p.filter((r) => r.id !== id));
    await saveOrFail(
      supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id),
      'Marking that done'
    );
  }

  if (!loaded || rows.length === 0) return null;

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel>Waiting on you ({rows.length})</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {rows.map((r) => (
          <Card key={r.id}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{r.title}</div>
                {r.body && (
                  <div style={{ fontSize: 14, color: C.dim, marginTop: 4, lineHeight: 1.6, maxWidth: '62ch', whiteSpace: 'pre-wrap' }}>
                    {r.body}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {r.href && (
                  <a href={r.href} style={{ fontSize: 13, color: C.blue, textDecoration: 'none' }}>
                    Open →
                  </a>
                )}
                <Button variant="ghost" onClick={() => done(r.id)}>Done</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
