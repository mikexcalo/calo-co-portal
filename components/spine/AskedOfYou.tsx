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

/**
 * How much of a message shows before you ask for the rest.
 *
 * One of these ran to twenty-four lines — a five-step walkthrough, a note about
 * what the reader should expect, and a closing paragraph about where to send
 * feedback — and it sat above everything else on Home. A notice long enough to
 * need scrolling is one you stop reading, and it pushed the day's actual work
 * off the screen.
 */
const PREVIEW_LINES = 2;

export function AskedOfYou() {
  const [rows, setRows] = useState<Ask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  /**
   * Yours, not the workspace's.
   *
   * read_at on the notification is shared by everybody in the business, so an
   * agency looking in and pressing Done cleared the task off the client's
   * screen. Whether you have dealt with something is a row about you.
   */
  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id;
    if (!me) { setLoaded(true); return; }

    const [all, mine] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, title, body, href, created_at')
        .eq('kind', 'system')
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('notification_reads').select('notification_id').eq('user_id', me),
    ]);

    const done = new Set((mine.data ?? []).map((r) => (r as { notification_id: string }).notification_id));
    if (!all.error) setRows(((all.data ?? []) as Ask[]).filter((r) => !done.has(r.id)).slice(0, 10));
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function done(id: string) {
    setRows((p) => p.filter((r) => r.id !== id));
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id;
    if (!me) return;
    await saveOrFail(
      supabase.from('notification_reads').upsert({ notification_id: id, user_id: me }),
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
                {r.body && (() => {
                  const lines = r.body.split('\n').filter((l) => l.trim());
                  const long = lines.length > PREVIEW_LINES;
                  const shown = open.has(r.id) || !long;
                  return (
                    <>
                      <div style={{ fontSize: 14, color: C.dim, marginTop: 4, lineHeight: 1.6, maxWidth: '62ch', whiteSpace: 'pre-wrap' }}>
                        {shown ? r.body : lines.slice(0, PREVIEW_LINES).join('\n')}
                      </div>
                      {long && (
                        <button
                          onClick={() =>
                            setOpen((p) => {
                              const n = new Set(p);
                              if (n.has(r.id)) n.delete(r.id);
                              else n.add(r.id);
                              return n;
                            })
                          }
                          style={{
                            background: 'transparent', border: 'none', padding: 0, marginTop: 6,
                            color: C.faint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {shown ? 'Less' : `Read the rest (${lines.length - PREVIEW_LINES} more lines)`}
                        </button>
                      )}
                    </>
                  );
                })()}
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
