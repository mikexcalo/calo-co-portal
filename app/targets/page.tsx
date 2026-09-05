'use client';

/**
 * Pipeline: everybody you want, before they are anybody you have.
 *
 * WHY THIS IS A TABLE AND NOT A BOARD
 *
 * The first version was a kanban, and a kanban is a lie about your data unless
 * the columns are roughly balanced. John's read 104 / 0 / 1 / 0, which is four
 * columns of which three say "nobody here" and one is a mile of scroll. Each
 * card carried the name, three wrapping tags, a next step and a footer, so a
 * hundred and four companies took about twenty screens and told you nothing you
 * could act on.
 *
 * A row is 34 pixels. The same list fits in four screens, sorted so the ones in
 * motion are at the top and the untouched research list is underneath. That is
 * what every CRM worth using opens with, and the board is a view you switch to
 * once the columns have something in them.
 *
 * The stage bar people think of as "the Attio thing" is on the record, not
 * here. A list tells you which one to open; the record is where you work it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { LANE, OPEN_STAGES, STAGE, daysSince, stale, type Stage } from '@/lib/spine/stage';
import { Avatar, Button, C, Card, Empty, Page, inputStyle } from '@/components/spine/ui';
import { brandAssetUrl } from '@/lib/spine/db';

interface Row {
  id: string;
  name: string;
  stage: Stage;
  tags: string[] | null;
  next_action: string | null;
  last_contacted_on: string | null;
  logo_url: string | null;
}

const COLUMNS = LANE.filter((s) => OPEN_STAGES.includes(s.id));

/** Furthest along first, so the top of the list is where the work is. */
const RANK: Record<string, number> = { proposed: 4, talking: 3, reached: 2, noticed: 1 };

const tone = (s: Stage) =>
  s === 'proposed' ? C.green : s === 'talking' ? C.accent : s === 'reached' ? C.amber : C.faint;

export default function PipelinePage() {
  const router = useRouter();
  const { vocab, org } = useOrg();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [only, setOnly] = useState<Stage | 'all'>('all');
  const [board, setBoard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase
      .from('customers')
      .select('id, name, stage, tags, next_action, last_contacted_on, logo_url')
      .in('stage', OPEN_STAGES)
      .order('name');
    if (res.error) setError(res.error.message);
    else setRows((res.data ?? []) as Row[]);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Tags worth showing as filters: the ones more than one company has. */
  const allTags = useMemo(() => {
    const count = new Map<string, number>();
    rows.forEach((r) => (r.tags ?? []).forEach((t) => count.set(t, (count.get(t) ?? 0) + 1)));
    return Array.from(count.entries())
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [rows]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (only !== 'all' && r.stage !== only) return false;
        if (tag && !(r.tags ?? []).includes(tag)) return false;
        if (!t) return true;
        return `${r.name} ${(r.tags ?? []).join(' ')} ${r.next_action ?? ''}`.toLowerCase().includes(t);
      })
      .sort(
        (a, b) =>
          (RANK[b.stage] ?? 0) - (RANK[a.stage] ?? 0) ||
          (daysSince(b.last_contacted_on) ?? -1) - (daysSince(a.last_contacted_on) ?? -1) ||
          a.name.localeCompare(b.name)
      );
  }, [rows, q, tag, only]);

  const quiet = useMemo(
    () =>
      shown
        .map((r) => ({ r, days: stale(r.stage, r.last_contacted_on) }))
        .filter((x) => x.days !== null)
        .sort((a, b) => (b.days ?? 0) - (a.days ?? 0)),
    [shown]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => { c[r.stage] = (c[r.stage] ?? 0) + 1; });
    return c;
  }, [rows]);

  const move = async (row: Row, next: Stage) => {
    setRows((prev) =>
      OPEN_STAGES.includes(next)
        ? prev.map((r) => (r.id === row.id ? { ...r, stage: next } : r))
        : prev.filter((r) => r.id !== row.id)
    );
    const res = await supabase
      .from('customers')
      .update({ stage: next, stage_why: null, stage_changed_on: new Date().toISOString().slice(0, 10) })
      .eq('id', row.id);
    if (res.error) { setError(res.error.message); load(); }
  };

  const nextOf = (s: Stage): Stage => {
    const i = COLUMNS.findIndex((c) => c.id === s);
    return i < 0 || i === COLUMNS.length - 1 ? 'won' : COLUMNS[i + 1].id;
  };

  const add = async () => {
    if (!org || !name.trim()) return;
    setBusy(true);
    const res = await supabase.from('customers').insert({ org_id: org.id, name: name.trim(), stage: 'noticed' });
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setName('');
    setAdding(false);
    load();
  };

  /** One row of the table. Fixed height, nothing wraps, nothing reflows. */
  const GRID = 'minmax(180px, 1.7fr) minmax(140px, 1.5fr) minmax(150px, 1.7fr) 118px 74px';

  const chip = (label: string, on: boolean, onClick: () => void, count?: number) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'baseline', gap: 6,
        border: `1px solid ${on ? C.accent : C.border}`,
        background: on ? C.accentSoft : 'transparent',
        color: on ? C.text : C.faint,
        borderRadius: 999, padding: '3px 12px', fontSize: 12.5,
        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}
    >
      {label}
      {count !== undefined && (
        <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      )}
    </button>
  );

  return (
    <Page
      title="Pipeline"
      subtitle={`Everybody you want. They become ${vocab.customerPlural.toLowerCase()} the moment one is marked won.`}
      action={
        <>
          <Button variant="ghost" onClick={() => setBoard((b) => !b)}>
            {board ? 'List' : 'Board'}
          </Button>
          {!adding && <Button onClick={() => setAdding(true)}>Add a company</Button>}
        </>
      }
    >
      {error && <div style={{ fontSize: 13, color: C.red, marginBottom: 12 }}>{error}</div>}

      {adding && (
        <Card>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              placeholder="Company name. Everything else can wait."
              autoFocus
              style={{ ...inputStyle, flex: '1 1 240px' }}
            />
            <Button onClick={add} disabled={busy || !name.trim()}>Add</Button>
            <Button variant="ghost" onClick={() => { setAdding(false); setName(''); }}>Cancel</Button>
          </div>
        </Card>
      )}

      {!loaded ? (
        <Empty>Loading…</Empty>
      ) : rows.length === 0 ? (
        <Card>
          <Empty>
            Nobody in the pipeline. Add a company you want and it starts at Noticed, then moves
            itself the first time you write to them.
          </Empty>
        </Card>
      ) : (
        <>
          {quiet.length > 0 && (
            <Card style={{ marginBottom: 14, borderColor: `${C.amber}55` }}>
              <div style={{ fontSize: 12.5, color: C.amber, marginBottom: 7 }}>
                Going quiet ({quiet.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {quiet.slice(0, 4).map(({ r, days }) => (
                  <button
                    key={r.id}
                    onClick={() => router.push(`/customers/${r.id}`)}
                    style={{
                      display: 'flex', gap: 9, alignItems: 'baseline', textAlign: 'left',
                      background: 'transparent', border: 'none', padding: 0,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: 13.5, color: C.text }}>{r.name}</span>
                    <span style={{ fontSize: 12.5, color: C.faint }}>
                      {days} days quiet at {STAGE[r.stage].label.toLowerCase()}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Stage counts double as the filter, so the shape of the funnel is
              readable without a chart and one click narrows to it. */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            {chip('All', only === 'all', () => setOnly('all'), rows.length)}
            {COLUMNS.map((c) => chip(c.label, only === c.id, () => setOnly(c.id), counts[c.id] ?? 0))}
            <span style={{ flex: 1 }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              style={{ ...inputStyle, maxWidth: 190, padding: '5px 11px', fontSize: 13 }}
            />
            {allTags.length > 0 && (
              <button
                onClick={() => setShowFilters((v) => !v)}
                style={{
                  border: `1px solid ${tag ? C.accent : C.border}`,
                  background: tag ? C.accentSoft : 'transparent',
                  color: tag ? C.text : C.faint,
                  borderRadius: 999, padding: '4px 12px', fontSize: 12.5,
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
              >
                {tag ?? 'Tags'}
              </button>
            )}
          </div>

          {/* Folded away by default. Seventeen tags across the top of a screen
              is a second navigation bar for something you use occasionally. */}
          {showFilters && allTags.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
              {tag && chip('Clear', false, () => { setTag(null); setShowFilters(false); })}
              {allTags.map(([t, n]) => chip(t, tag === t, () => setTag(tag === t ? null : t), n))}
            </div>
          )}

          {board ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(200px, 1fr))`,
                gap: 12, alignItems: 'start', overflowX: 'auto',
              }}
            >
              {COLUMNS.map((col) => {
                const cards = shown.filter((r) => r.stage === col.id);
                return (
                  <div key={col.id}>
                    <div
                      style={{
                        display: 'flex', gap: 7, alignItems: 'baseline',
                        marginBottom: 8, paddingBottom: 6,
                        borderBottom: `2px solid ${tone(col.id)}`,
                      }}
                    >
                      <span style={{ fontSize: 12.5, color: C.dim, fontWeight: 500 }}>{col.label}</span>
                      <span style={{ fontSize: 12, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
                        {cards.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {cards.length === 0 && (
                        <div style={{ fontSize: 12, color: C.faint }}>Nobody here.</div>
                      )}
                      {/* Capped, and it says so. An uncapped column of a
                          hundred is why this stopped being the default. */}
                      {cards.slice(0, 25).map((r) => (
                        <button
                          key={r.id}
                          onClick={() => router.push(`/customers/${r.id}`)}
                          style={{
                            display: 'flex', gap: 8, alignItems: 'center', textAlign: 'left',
                            border: `1px solid ${C.border}`, background: C.panel,
                            borderRadius: 8, padding: '7px 10px',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          <Avatar src={brandAssetUrl(r.logo_url)} name={r.name} size={18} shape="company" />
                          <span
                            style={{
                              fontSize: 13, color: C.text, overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}
                          >
                            {r.name}
                          </span>
                        </button>
                      ))}
                      {cards.length > 25 && (
                        <div style={{ fontSize: 12, color: C.faint, paddingTop: 4 }}>
                          and {cards.length - 25} more. The list shows all of them.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid', gridTemplateColumns: GRID, gap: 12,
                  padding: '7px 14px', background: C.panelAlt,
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: C.faint,
                }}
              >
                <span>Company</span>
                <span>Tags</span>
                <span>Next step</span>
                <span>Stage</span>
                <span style={{ textAlign: 'right' }}>Last</span>
              </div>

              {shown.length === 0 && <div style={{ padding: 16 }}><Empty>Nothing matches.</Empty></div>}

              {shown.map((r, i) => {
                const seen = daysSince(r.last_contacted_on);
                const quietDays = stale(r.stage, r.last_contacted_on);
                return (
                  <div
                    key={r.id}
                    onClick={() => router.push(`/customers/${r.id}`)}
                    style={{
                      display: 'grid', gridTemplateColumns: GRID, gap: 12,
                      padding: '8px 14px', alignItems: 'center', cursor: 'pointer',
                      borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                      background: C.panel,
                    }}
                  >
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                      <Avatar src={brandAssetUrl(r.logo_url)} name={r.name} size={19} shape="company" />
                      <span
                        style={{
                          fontSize: 13.5, color: C.text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {r.name}
                      </span>
                    </span>

                    {/* One line, clipped. Wrapping tags is what made every card
                        a different height and the whole list unreadable. */}
                    <span
                      style={{
                        fontSize: 12, color: C.faint,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {(r.tags ?? []).join(' · ')}
                    </span>

                    <span
                      style={{
                        fontSize: 12.5, color: r.next_action ? C.dim : C.faint,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {r.next_action ?? '—'}
                    </span>

                    {/* Advances on click, without opening the record. Moving one
                        step forward is the only thing anybody does from a list. */}
                    <button
                      onClick={(e) => { e.stopPropagation(); move(r, nextOf(r.stage)); }}
                      title={`Move to ${STAGE[nextOf(r.stage)].label}`}
                      style={{
                        justifySelf: 'start',
                        border: `1px solid ${tone(r.stage)}55`,
                        background: 'transparent', color: tone(r.stage),
                        borderRadius: 999, padding: '2px 10px', fontSize: 11.5,
                        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                      }}
                    >
                      {STAGE[r.stage].label} →
                    </button>

                    <span
                      style={{
                        fontSize: 11.5, textAlign: 'right',
                        color: quietDays ? C.amber : C.faint,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {seen === null ? 'never' : seen === 0 ? 'today' : `${seen}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ fontSize: 12, color: C.faint, marginTop: 10 }}>
            {shown.length} of {rows.length}. Open one to move it through the stages or mark it won.
          </div>
        </>
      )}
    </Page>
  );
}
