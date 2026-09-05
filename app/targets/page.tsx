'use client';

/**
 * Pipeline: everybody you want, before they are anybody you have.
 *
 * This read from a separate table of targets, which meant a company you were
 * chasing and a company you had signed were two different records with two
 * different status words, and converting one to the other stranded every note
 * taken during the chase on a row nobody opens again.
 *
 * Same table now. Pipeline is everything before Won; Clients is Won and Past.
 * Nothing moves between lists when a deal closes; the window changes.
 *
 * WHAT THE COLUMNS ARE FOR
 *
 * Grouped by stage rather than listed, because the question is never "show me
 * all hundred and four". It is which four am I letting go quiet, and a column
 * with two cards in it answers that without being asked.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { LANE, OPEN_STAGES, daysSince, stale, type Stage } from '@/lib/spine/stage';
import { Avatar, Button, C, Card, Empty, Page, inputStyle } from '@/components/spine/ui';
import { Tags } from '@/components/spine/Tags';
import { brandAssetUrl } from '@/lib/spine/db';

interface Row {
  id: string;
  name: string;
  stage: Stage;
  tags: string[] | null;
  next_action: string | null;
  last_contacted_on: string | null;
  logo_url: string | null;
  website: string | null;
}

/** The four open stages, in order, minus won which is the other list. */
const COLUMNS = LANE.filter((s) => OPEN_STAGES.includes(s.id));

export default function PipelinePage() {
  const router = useRouter();
  const { org, vocab } = useOrg();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase
      .from('customers')
      .select('id, name, stage, tags, next_action, last_contacted_on, logo_url, website')
      .in('stage', OPEN_STAGES)
      .order('name');
    if (res.error) setError(res.error.message);
    else setRows((res.data ?? []) as Row[]);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => (r.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [rows]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tag && !(r.tags ?? []).includes(tag)) return false;
      if (!t) return true;
      return `${r.name} ${(r.tags ?? []).join(' ')}`.toLowerCase().includes(t);
    });
  }, [rows, q, tag]);

  /**
   * The ones going quiet, named before the board.
   *
   * A hundred and four cards is not information. Four of them that have sat
   * untouched past the point where a reply was likely is the only thing on this
   * screen anybody can act on this morning.
   */
  const quiet = useMemo(
    () =>
      shown
        .map((r) => ({ r, days: stale(r.stage, r.last_contacted_on) }))
        .filter((x) => x.days !== null)
        .sort((a, b) => (b.days ?? 0) - (a.days ?? 0)),
    [shown]
  );

  const move = async (row: Row, next: Stage) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, stage: next } : r)));
    const res = await supabase
      .from('customers')
      .update({ stage: next, stage_why: null, stage_changed_on: new Date().toISOString().slice(0, 10) })
      .eq('id', row.id);
    if (res.error) { setError(res.error.message); load(); }
    // Leaving the open stages means it belongs to the other list now.
    if (!OPEN_STAGES.includes(next)) load();
  };

  const add = async () => {
    if (!org || !name.trim()) return;
    setBusy(true);
    const res = await supabase
      .from('customers')
      .insert({ org_id: org.id, name: name.trim(), stage: 'noticed' })
      .select('id')
      .maybeSingle();
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setName('');
    setAdding(false);
    load();
  };

  return (
    <Page
      title="Pipeline"
      subtitle={`Everybody you want. They become ${vocab.customerPlural.toLowerCase()} the moment you mark one won.`}
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
              <div style={{ fontSize: 12.5, color: C.amber, marginBottom: 8 }}>
                Going quiet ({quiet.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {quiet.slice(0, 5).map(({ r, days }) => (
                  <button
                    key={r.id}
                    onClick={() => router.push(`/customers/${r.id}`)}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'baseline', textAlign: 'left',
                      background: 'transparent', border: 'none', padding: 0,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: 13.5, color: C.text }}>{r.name}</span>
                    <span style={{ fontSize: 12.5, color: C.faint, flex: 1 }}>
                      {days} days since you last spoke, and they are at {r.stage}.
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or tag"
              style={{ ...inputStyle, maxWidth: 240 }}
            />
            {allTags.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {allTags.slice(0, 12).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTag(tag === t ? null : t)}
                    style={{
                      border: `1px solid ${tag === t ? C.accent : C.border}`,
                      background: tag === t ? C.accentSoft : 'transparent',
                      color: tag === t ? C.text : C.faint,
                      borderRadius: 6, padding: '3px 9px', fontSize: 12,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              alignItems: 'start',
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
                      borderBottom: `2px solid ${col.tone === 'amber' ? C.amber : C.border}`,
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: C.dim, fontWeight: 500 }}>{col.label}</span>
                    <span style={{ fontSize: 12, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
                      {cards.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {cards.length === 0 && (
                      <div style={{ fontSize: 12, color: C.faint, padding: '6px 0' }}>Nobody here.</div>
                    )}
                    {cards.map((r) => {
                      const quietDays = stale(r.stage, r.last_contacted_on);
                      const seen = daysSince(r.last_contacted_on);
                      return (
                        <Card key={r.id} style={{ padding: '10px 12px' }}>
                          <button
                            onClick={() => router.push(`/customers/${r.id}`)}
                            style={{
                              display: 'flex', gap: 8, alignItems: 'center', width: '100%',
                              textAlign: 'left', background: 'transparent', border: 'none',
                              padding: 0, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            <Avatar src={brandAssetUrl(r.logo_url)} name={r.name} size={20} shape="company" />
                            <span style={{ fontSize: 13.5, color: C.text, lineHeight: 1.35 }}>{r.name}</span>
                          </button>

                          {(r.tags ?? []).length > 0 && (
                            <div style={{ marginTop: 6 }}>
                              <Tags tags={(r.tags ?? []).slice(0, 3)} editable={false} />
                            </div>
                          )}

                          {r.next_action && (
                            <div style={{ fontSize: 12, color: C.dim, marginTop: 6, lineHeight: 1.45 }}>
                              {r.next_action}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11.5, color: quietDays ? C.amber : C.faint }}>
                              {seen === null ? 'never spoken' : seen === 0 ? 'today' : `${seen}d ago`}
                            </span>
                            <span style={{ flex: 1 }} />
                            {/* One step forward, which is the only move
                                anybody makes from a board. Anything else is a
                                decision, and decisions belong on the record. */}
                            {col.id !== 'proposed' ? (
                              <button
                                onClick={() => move(r, COLUMNS[COLUMNS.findIndex((c) => c.id === col.id) + 1].id)}
                                style={{
                                  background: 'transparent', border: 'none', padding: 0,
                                  color: C.blue, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                                }}
                              >
                                → {COLUMNS[COLUMNS.findIndex((c) => c.id === col.id) + 1].label}
                              </button>
                            ) : (
                              <button
                                onClick={() => move(r, 'won')}
                                style={{
                                  background: 'transparent', border: 'none', padding: 0,
                                  color: C.green, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                                }}
                              >
                                Won
                              </button>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}
