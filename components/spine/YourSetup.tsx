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

/**
 * A step that can contain a link, written as [label](url).
 *
 * Steps were plain sentences telling you to go to Search Console or the Vercel
 * domain settings, and then you went and found them yourself. A step that
 * names a place should take you there: the whole point of writing the task
 * down was to stop the looking-up costing more than the task.
 *
 * Deliberately the smallest possible syntax rather than a markdown library. It
 * handles one thing, and anything it does not recognise renders as the plain
 * text it already was.
 */
function StepText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (!m) return <span key={i}>{part}</span>;
        return (
          <a
            key={i}
            href={m[2]}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            style={{ color: C.accent, textDecoration: 'none' }}
          >
            {m[1]} ↗
          </a>
        );
      })}
    </>
  );
}

export function YourSetup() {
  const { org } = useOrg();
  const [state, setState] = useState<Record<string, Status>>({});
  /** Which steps are ticked, per item. */
  const [ticks, setTicks] = useState<Record<string, number[]>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  /**
   * Shown, not folded.
   *
   * This was one dashed line reading "9 things only you can switch on", on the
   * reasoning that a to-do list you did not write should not sit above the work
   * you did. That reasoning was wrong about whose list it is. These are the
   * jobs nobody else can do, they are the reason Stripe and Search Console keep
   * getting asked about, and a list you cannot see is a list you keep asking
   * somebody to repeat.
   *
   * The compromise that keeps it from being a wall: every item shows its title
   * and what it blocks, and the steps stay one click away.
   */
  const [showAll, setShowAll] = useState(true);

  const load = useCallback(async () => {
    const res = await supabase.from('setup_items').select('key, status, steps_done');
    if (!res.error) {
      setState(Object.fromEntries((res.data ?? []).map((r) => [r.key, r.status as Status])));
      setTicks(
        Object.fromEntries(
          (res.data ?? []).map((r) => [r.key, ((r as { steps_done?: number[] }).steps_done ?? [])])
        )
      );
    }
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = async (key: string, status: Status) => {
    if (!org) return;
    setState((s) => ({ ...s, [key]: status }));
    await supabase.from('setup_items').upsert({ org_id: org.id, key, status }, { onConflict: 'org_id,key' });
  };

  /**
   * Ticking a step, and noticing when that was the last one.
   *
   * The whole item is marked done automatically when every step is ticked,
   * because asking somebody to tick nine boxes and then press Done as well is
   * asking them to say the same thing twice.
   */
  const tick = async (key: string, index: number, total: number) => {
    if (!org) return;
    const now = ticks[key] ?? [];
    const next = now.includes(index) ? now.filter((n) => n !== index) : [...now, index];
    setTicks((t) => ({ ...t, [key]: next }));

    const finished = next.length === total;
    if (finished) setState((st) => ({ ...st, [key]: 'done' }));

    await supabase.from('setup_items').upsert(
      { org_id: org.id, key, steps_done: next, status: finished ? 'done' : 'todo' },
      { onConflict: 'org_id,key' }
    );
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
          <span style={{ color: C.text }}>Your tasks ({items.length})</span>
          {' · '}
          {items.slice(0, 3).map((i) => i.title.replace(/^(Add|Set|Claim|Invite|Upgrade|Change|Send|Point|Verify|Redirect) /, '')).join(', ')}
          {items.length > 3 ? ', and more' : ''}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        {/* "Yours to switch on" described a switch. Half of these are a
            morning's work with a registrar. They are tasks. */}
        <SectionLabel>Your tasks ({items.length})</SectionLabel>
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
                {(ticks[i.key]?.length ?? 0) > 0 && (
                  <span style={{ fontSize: 12, color: C.amber }}>
                    {ticks[i.key].length} of {i.steps.length}
                  </span>
                )}
                <span style={{ fontSize: 12, color: C.blue }}>{isOpen ? 'Hide' : 'How'}</span>
              </div>

              {/* The consequence, always visible. An item nobody can name a
                  cost for should not be nagging anybody. */}
              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 4, lineHeight: 1.55, maxWidth: 640 }}>
                {i.blocks}
              </div>

              {isOpen && (
                <div style={{ marginTop: 12 }}>
                  {/* One line, one tick. Reading nine steps to work out where
                      you were is why a task like this gets abandoned halfway. */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {i.steps.map((s, n) => {
                      const on = (ticks[i.key] ?? []).includes(n);
                      return (
                        <label
                          key={n}
                          style={{
                            display: 'flex', gap: 10, alignItems: 'flex-start',
                            padding: '7px 0', cursor: 'pointer',
                            borderTop: n === 0 ? 'none' : `1px solid ${C.border}`,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => tick(i.key, n, i.steps.length)}
                            style={{ marginTop: 3, flexShrink: 0, cursor: 'pointer' }}
                          />
                          <span
                            style={{
                              fontSize: 13.5, lineHeight: 1.6,
                              color: on ? C.faint : C.dim,
                              textDecoration: on ? 'line-through' : undefined,
                            }}
                          >
                            <StepText text={s} />
                          </span>
                        </label>
                      );
                    })}
                  </div>
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
