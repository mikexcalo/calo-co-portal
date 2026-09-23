'use client';

import type { CSSProperties } from 'react';

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
import { useViewAs } from '@/lib/spine/viewas';
import { Button, C, Card, SectionLabel } from './ui';
import { Glyph } from './icons';
import { save as saveOrFail } from '@/lib/spine/save';
import { orgNow } from '@/lib/spine/db';

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

const rowBtn: CSSProperties = {
  background: 'transparent', border: 'none', padding: '2px 4px',
  color: '#8A949E', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
};

export function YourSetup() {
  const { org } = useOrg();
  const { effectiveRole } = useViewAs();
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
  /*
    Closed until asked for.

    Open by default meant eight tasks, each with its reasoning, sat between the
    numbers at the top of Home and the work at the bottom — so the two things
    somebody opens Home to see were separated by a wall of text about things
    they are not doing right now.
  */
  /*
    Urgent means you can see it without pressing anything.

    Everything collapsed to one line by default, so "1 urgent" sat inside a
    summary of six tasks and the urgent one was whichever of the three titles
    happened to fit. A thing worth calling urgent and then hiding behind a
    click is not being called urgent, it is being counted.
  */
  /*
    Open when something is urgent, and closable either way.

    First attempt at surfacing the urgent one overrode the collapsed render
    instead of the default, so Hide became a button that set a flag nothing
    read. Pressing it did nothing, which is worse than not having it. The
    urgency decides how it STARTS; the button still decides the rest.
  */
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase.from('setup_items').select('key, status, steps_done').eq('org_id', await orgNow());
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

  /*
    Open on arrival when something is urgent, and closable after that.

    Urgency decides how the list STARTS. It must not decide whether Hide
    works: the first attempt overrode the collapsed branch of the render
    instead of the default, so pressing Hide set a flag nothing read and the
    button did nothing, which is worse than not having one.
  */
  const anyUrgent = loaded && org
    ? SETUP_ITEMS.some(
        (i) =>
          i.urgent &&
          (!i.appliesTo || i.appliesTo === org.kind) &&
          (!i.onlyOrg || i.onlyOrg === org.slug) &&
          (state[i.key] ?? 'todo') !== 'done' &&
          state[i.key] !== 'skipped'
      )
    : false;
  useEffect(() => { if (anyUrgent) setShowAll(true); }, [anyUrgent]);

  const set = async (key: string, status: Status) => {
    if (!org) return;
    setState((s) => ({ ...s, [key]: status }));
    await saveOrFail(supabase.from('setup_items').upsert({ org_id: org.id, key, status }, { onConflict: 'org_id,key' }));
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

    await saveOrFail(supabase.from('setup_items').upsert(
      { org_id: org.id, key, steps_done: next, status: finished ? 'done' : 'todo' },
      { onConflict: 'org_id,key' }
    ));
  };

  if (!loaded || !org) return null;

  /**
   * Urgent first, then the order they were written.
   *
   * The written order is roughly what depends on what, so it is worth keeping.
   * The one exception is something already built and sitting broken, which
   * belongs at the top no matter where it sits in the sequence.
   */
  const items = SETUP_ITEMS
    .filter((i) =>
      (!i.appliesTo || i.appliesTo === org.kind) &&
      // Anything addressed to one workspace stays there.
      (!i.onlyOrg || i.onlyOrg === org.slug) &&
      // Whoever is looking, really or in preview.
      (!i.forRoles || !effectiveRole || i.forRoles.includes(effectiveRole)) &&
      (state[i.key] ?? 'todo') !== 'done' &&
      state[i.key] !== 'skipped')
    .sort((a, b) => Number(Boolean(b.urgent)) - Number(Boolean(a.urgent)));

  if (items.length === 0) return null;

  if (!showAll) {
    return (
      <div style={{ marginBottom: 26 }}>
        <button
          onClick={() => setShowAll(true)}
          style={{
            width: '100%', textAlign: 'left', background: 'transparent',
            border: `1px dashed ${C.border}`, borderRadius: 10, padding: '11px 14px',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, color: C.dim,
          }}
        >
          {/* Closed, the urgent count is the only thing that has to survive. */}
          <span style={{ color: C.text }}>Your tasks ({items.length})</span>
          {items.some((i) => i.urgent) && (
            <span style={{ color: C.red }}>
              {'  ·  '}{items.filter((i) => i.urgent).length} urgent
            </span>
          )}
          {' · '}
          {/*
            Joined with commas, and the titles contain commas.

            "Let replies come back, Retire mikecalo.co, and see what people
            actually search, the site in Google Search Console, and more" is
            four tasks and reads as one run-on sentence nobody can parse. A
            middle dot cannot be mistaken for punctuation inside a title.
          */}
          {items.slice(0, 3).map((i) => i.title.replace(/^(Add|Set|Claim|Invite|Upgrade|Change|Send|Point|Verify|Redirect) /, '')).join('  ·  ')}
          {items.length > 3 ? '  ·  and more' : ''}
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
                style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }}
              >
                {/* Recognized rather than read. Nine identical lines of text
                    is a paragraph you parse; nine marks is a list you scan. */}
                <Glyph name={i.icon} size={16} color={i.urgent ? C.red : C.faint} />
                <span style={{ fontSize: 14.5, color: C.text, flex: 1, minWidth: 200 }}>{i.title}</span>
                {i.urgent && (
                  <span
                    style={{
                      fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em',
                      textTransform: 'uppercase', color: C.red,
                      border: `1px solid ${C.red}55`, borderRadius: 5, padding: '2px 7px',
                    }}
                  >
                    Urgent
                  </span>
                )}
                {i.cost && <span style={{ fontSize: 12.5, color: C.faint }}>{i.cost}</span>}
                {(ticks[i.key]?.length ?? 0) > 0 && (
                  <span style={{ fontSize: 12, color: C.amber }}>
                    {ticks[i.key].length} of {i.steps.length}
                  </span>
                )}
                <span style={{ fontSize: 12, color: C.blue }}>{isOpen ? 'Hide' : 'How'}</span>
                {/*
                  Done and Not doing, on the row.

                  They existed, at the bottom of the How panel, under the
                  steps — so getting rid of a task you were never going to do
                  meant opening the instructions for it first and reading past
                  them. A list you cannot clear is not a list, it is a wall,
                  and the one on this screen has "retire mikecalo.co" on it for
                  a domain that lapses on its own in four days.
                */}
                <button
                  onClick={(e) => { e.stopPropagation(); set(i.key, 'done'); }}
                  title="Mark done"
                  style={rowBtn}
                >
                  Done
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); set(i.key, 'skipped'); }}
                  title="Take it off the list"
                  style={rowBtn}
                >
                  Not doing
                </button>
              </div>

              {/*
                The first line closed, the rest when you ask.

                This printed every word of "why it matters" on every task at
                once, three and four paragraphs each, eight of them, so the
                home screen became about four thousand words of reasoning
                stacked above the work. All of it is worth reading once and
                none of it is worth re-reading every morning. The first
                sentence says which task this is; opening it says why.
              */}
              <div
                style={{
                  fontSize: 12.5, color: C.faint, marginTop: 5, lineHeight: 1.6,
                  maxWidth: 640, whiteSpace: 'pre-line', paddingLeft: 26,
                }}
              >
                {isOpen ? i.blocks : i.blocks.split('\n')[0]}
              </div>

              {isOpen && (
                <div style={{ marginTop: 12, paddingLeft: 26 }}>
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
