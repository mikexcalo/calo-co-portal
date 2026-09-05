'use client';

/**
 * Pipeline: everybody you want, before they are anybody you have.
 *
 * Three versions of this screen, and the two failures either side are worth
 * keeping because they are opposite mistakes.
 *
 * A kanban first, which lies about your data unless the columns are balanced.
 * John's read 104 / 0 / 1 / 0: three columns saying nobody here and one a mile
 * of scroll, with each card carrying wrapping tags and a footer, so a hundred
 * and four companies took twenty screens.
 *
 * Then a table, which was readable and still unworkable, because there was no
 * way to touch more than one row. A hundred and four records arrived by import
 * and every edit was a page load.
 *
 * This is the same table with the two things a list is for: select many, do one
 * thing to all of them, and keep the filter you built.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { LANE, OPEN_STAGES, STAGE, daysSince, stale, type Stage } from '@/lib/spine/stage';
import { Avatar, Button, C, Card, Empty, Page, inputStyle } from '@/components/spine/ui';
import { BulkAction, BulkBar, RecordTable, type Column } from '@/components/spine/RecordTable';
import { SavedViews, type View } from '@/components/spine/SavedViews';
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
  const [view, setView] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(false);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState(false);
  const [tagWord, setTagWord] = useState('');
  const [bulkStage, setBulkStage] = useState(false);

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

  const move = async (ids: string[], next: Stage) => {
    setRows((prev) =>
      OPEN_STAGES.includes(next)
        ? prev.map((r) => (ids.includes(r.id) ? { ...r, stage: next } : r))
        : prev.filter((r) => !ids.includes(r.id))
    );
    setPicked(new Set());
    setBulkStage(false);
    const res = await supabase
      .from('customers')
      .update({ stage: next, stage_why: null, stage_changed_on: new Date().toISOString().slice(0, 10) })
      .in('id', ids);
    if (res.error) { setError(res.error.message); load(); }
  };

  /**
   * Adds a tag without touching the ones already there.
   *
   * Writing the array wholesale would wipe a company's own tags to apply one,
   * so each row is merged with what it already had. Postgres has no array union
   * in an update, and doing it in one statement per row is fine at this size.
   */
  const addTag = async (ids: string[], word: string) => {
    const w = word.trim();
    if (!w) return;
    setBusy(true);
    const updates = rows
      .filter((r) => ids.includes(r.id) && !(r.tags ?? []).includes(w))
      .map((r) => supabase.from('customers').update({ tags: [...(r.tags ?? []), w] }).eq('id', r.id));
    const out = await Promise.all(updates);
    setBusy(false);
    const bad = out.find((o) => o.error);
    if (bad?.error) setError(bad.error.message);
    setTagWord('');
    setBulkTag(false);
    setPicked(new Set());
    load();
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
    if (res.error) {
      // The unique index speaking. Worth translating, because "duplicate key
      // value violates unique constraint" is not a sentence anybody should read.
      setError(
        res.error.code === '23505'
          ? `${name.trim()} is already on your list.`
          : res.error.message
      );
      return;
    }
    setName('');
    setAdding(false);
    load();
  };

  const applyView = (v: View | null) => {
    setView(v?.id ?? null);
    const f = (v?.filters ?? {}) as { q?: string; tag?: string | null; only?: Stage | 'all' };
    setQ(f.q ?? '');
    setTag(f.tag ?? null);
    setOnly(f.only ?? 'all');
  };

  const columns: Column<Row>[] = [
    {
      key: 'name',
      label: 'Company',
      width: 'minmax(170px, 1.7fr)',
      sortBy: (r) => r.name.toLowerCase(),
      render: (r) => (
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
          <Avatar src={brandAssetUrl(r.logo_url)} name={r.name} size={19} shape="company" />
          <span style={{ fontSize: 13.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.name}
          </span>
        </span>
      ),
    },
    {
      key: 'tags',
      label: 'Tags',
      width: 'minmax(130px, 1.4fr)',
      render: (r) => (
        <span style={{ fontSize: 12, color: C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {(r.tags ?? []).join(' · ')}
        </span>
      ),
    },
    {
      key: 'next',
      label: 'Next step',
      width: 'minmax(140px, 1.6fr)',
      render: (r) => (
        <span style={{ fontSize: 12.5, color: r.next_action ? C.dim : C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {r.next_action ?? '—'}
        </span>
      ),
    },
    {
      key: 'stage',
      label: 'Stage',
      width: '118px',
      sortBy: (r) => -(RANK[r.stage] ?? 0),
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); move([r.id], nextOf(r.stage)); }}
          title={`Move to ${STAGE[nextOf(r.stage)].label}`}
          style={{
            border: `1px solid ${tone(r.stage)}55`, background: 'transparent', color: tone(r.stage),
            borderRadius: 999, padding: '2px 10px', fontSize: 11.5,
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          {STAGE[r.stage].label} →
        </button>
      ),
    },
    {
      key: 'last',
      label: 'Last',
      width: '74px',
      align: 'right',
      sortBy: (r) => daysSince(r.last_contacted_on) ?? 99_999,
      render: (r) => {
        const seen = daysSince(r.last_contacted_on);
        return (
          <span style={{ fontSize: 11.5, color: stale(r.stage, r.last_contacted_on) ? C.amber : C.faint, fontVariantNumeric: 'tabular-nums' }}>
            {seen === null ? 'never' : seen === 0 ? 'today' : `${seen}d`}
          </span>
        );
      },
    },
  ];

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
      action={!adding ? <Button onClick={() => setAdding(true)}>Add a company</Button> : undefined}
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

          <SavedViews
            screen="pipeline"
            orgId={org?.id ?? null}
            current={{ q, tag, only }}
            active={view}
            onApply={applyView}
          />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            {chip('All', only === 'all', () => setOnly('all'), rows.length)}
            {COLUMNS.map((c) => chip(c.label, only === c.id, () => setOnly(c.id), counts[c.id] ?? 0))}
            <span style={{ flex: 1 }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              style={{ ...inputStyle, maxWidth: 180, padding: '5px 11px', fontSize: 13 }}
            />
            {allTags.length > 0 && (
              <button
                onClick={() => setShowTags((v) => !v)}
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

          {showTags && allTags.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
              {tag && chip('Clear', false, () => { setTag(null); setShowTags(false); })}
              {allTags.map(([t, n]) => chip(t, tag === t, () => setTag(tag === t ? null : t), n))}
            </div>
          )}

          <RecordTable
            rows={shown}
            columns={columns}
            selected={picked}
            onSelect={setPicked}
            onOpen={(r) => router.push(`/customers/${r.id}`)}
            empty="Nothing matches."
          />

          <div style={{ fontSize: 12, color: C.faint, marginTop: 10 }}>
            {shown.length} of {rows.length}. Tick rows to work several at once; shift-click for a run.
          </div>

          <BulkBar count={picked.size} onClear={() => setPicked(new Set())}>
            {bulkTag ? (
              <input
                value={tagWord}
                onChange={(e) => setTagWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTag(Array.from(picked), tagWord);
                  if (e.key === 'Escape') { setBulkTag(false); setTagWord(''); }
                }}
                placeholder="Tag them…"
                autoFocus
                list="pipeline-tags"
                style={{
                  border: '1px solid rgba(255,255,255,.3)', background: 'transparent',
                  borderRadius: 999, padding: '4px 12px', fontSize: 12.5,
                  color: C.panel, fontFamily: 'inherit', width: 150, outline: 'none',
                }}
              />
            ) : (
              <BulkAction onClick={() => setBulkTag(true)}>Tag</BulkAction>
            )}

            {bulkStage ? (
              <>
                {COLUMNS.map((c) => (
                  <BulkAction key={c.id} onClick={() => move(Array.from(picked), c.id)}>
                    {c.label}
                  </BulkAction>
                ))}
                <BulkAction onClick={() => move(Array.from(picked), 'won')}>Won</BulkAction>
                <BulkAction onClick={() => move(Array.from(picked), 'cold')} tone="danger">Cold</BulkAction>
              </>
            ) : (
              <BulkAction onClick={() => setBulkStage(true)}>Move to…</BulkAction>
            )}
          </BulkBar>

          <datalist id="pipeline-tags">
            {allTags.map(([t]) => <option key={t} value={t} />)}
          </datalist>
        </>
      )}
    </Page>
  );
}
