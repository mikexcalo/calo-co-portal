'use client';

/**
 * The things you owe the platform, with the steps.
 *
 * On Today because they are yours, they block something, and nobody else is
 * going to do them. The steps are the point: these do not get postponed
 * because they are hard, they get postponed because remembering which screen
 * the button is on costs more than the task.
 *
 * Disappears entirely once everything is done or skipped, rather than sitting
 * there as a row of ticks. A finished checklist is a thing to stop showing.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { SETUP_ITEMS } from '@/lib/spine/setup';
import { useOrg } from '@/lib/spine/org';
import { Button, C, Card, SectionLabel } from './ui';

type Status = 'todo' | 'doing' | 'done' | 'skipped';

export function YourSetup() {
  const { org } = useOrg();
  const [state, setState] = useState<Record<string, Status>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  /**
   * Folded by default.
   *
   * Seven cards on the screen you open every morning is a to-do list you did
   * not write, sitting above the work you did. It is worth one line saying it
   * is there, and nothing more until you decide to spend the afternoon on it.
   */
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase.from('setup_items').select('key, status');
    if (!res.error) {
      setState(Object.fromEntries((res.data ?? []).map((r) => [r.key, r.status as Status])));
    }
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = async (key: string, status: Status) => {
    if (!org) return;
    setState((s) => ({ ...s, [key]: status }));
    await supabase.from('setup_items').upsert({ org_id: org.id, key, status }, { onConflict: 'org_id,key' });
  };

  if (!loaded || !org) return null;

  const items = SETUP_ITEMS.filter(
    (i) => (!i.appliesTo || i.appliesTo === org.kind) && (state[i.key] ?? 'todo') !== 'done' && state[i.key] !== 'skipped'
  );

  if (items.length === 0) return null;

  if (!showAll) {
    return (
      <div style={{ marginBottom: 26 }}>
        <button
          onClick={() => setShowAll(true)}
          style={{
            width: '100%', textAlign: 'left', background: 'transparent',
            border: `1px dashed ${C.border}`, borderRadius: 9, padding: '11px 14px',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, color: C.dim,
          }}
        >
          <span style={{ color: C.text }}>{items.length} things only you can switch on</span>
          {' · '}
          {items.slice(0, 3).map((i) => i.title.replace(/^(Add|Set|Claim|Invite|Upgrade|Change|Send) /, '')).join(', ')}
          {items.length > 3 ? ', and more' : ''}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <SectionLabel>Yours to switch on ({items.length})</SectionLabel>
        <Button variant="ghost" onClick={() => setShowAll(false)}>Hide</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((i) => {
          const isOpen = open === i.key;
          return (
            <Card key={i.key}>
              <div
                onClick={() => setOpen(isOpen ? null : i.key)}
                style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', cursor: 'pointer' }}
              >
                <span style={{ fontSize: 14.5, color: C.text, flex: 1, minWidth: 200 }}>{i.title}</span>
                {i.cost && <span style={{ fontSize: 12.5, color: C.faint }}>{i.cost}</span>}
                <span style={{ fontSize: 12, color: C.blue }}>{isOpen ? 'Hide' : 'How'}</span>
              </div>

              {/* The consequence, always visible. An item nobody can name a
                  cost for should not be nagging anybody. */}
              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 4, lineHeight: 1.55, maxWidth: 640 }}>
                {i.blocks}
              </div>

              {isOpen && (
                <div style={{ marginTop: 12 }}>
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: C.dim, lineHeight: 1.75 }}>
                    {i.steps.map((s, n) => <li key={n}>{s}</li>)}
                  </ol>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <Button onClick={() => set(i.key, 'done')}>Done</Button>
                    <Button variant="ghost" onClick={() => set(i.key, 'skipped')}>Not doing this</Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
