'use client';

/**
 * Your site, as the sections it is made of.
 *
 * Editing calo.company means opening a code editor, finding a string,
 * deploying and hoping. Doing that for a fourth and fifth client site means
 * doing it four and five times, because nothing from the last one was reusable.
 *
 * The unit here is a whole section, never an element inside one. You edit the
 * words and pick between two or three cuts of the section; you never touch
 * padding or type size. That constraint is the product — it is what keeps
 * every site looking like you made it, and it is precisely what a page builder
 * gives away in exchange for a canvas nobody needs.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { HOW_IT_WORKS, SECTIONS, specFor, type SectionSpec } from '@/lib/spine/sections';
import { SectionThumb } from '@/components/site/SectionThumb';
import { SITE_TABS, Button, C, Card, Empty, Page, SectionLabel, inputStyle } from '@/components/spine/ui';

interface Row {
  id: string;
  kind: string;
  variant: string;
  content: Record<string, string>;
  draft: Record<string, string> | null;
  sort: number;
  live: boolean;
  published_at: string | null;
}

export default function WebsitePage() {
  const { org, refresh } = useOrg();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHow, setShowHow] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase
      .from('site_sections')
      .select('id, kind, variant, content, draft, sort, live, published_at')
      .is('customer_id', null)
      .order('sort');
    if (res.error) setError(res.error.message);
    else setRows((res.data ?? []) as Row[]);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = useMemo(() => rows.filter((r) => r.draft !== null).length, [rows]);
  const previewUrl = org?.site_preview_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/preview/${org.site_preview_token}`
    : null;

  /** Editing writes to draft only. The published copy is never touched here. */
  const edit = async (row: Row, key: string, value: string) => {
    const next = { ...(row.draft ?? row.content), [key]: value };
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, draft: next } : r)));
    await supabase.from('site_sections').update({ draft: next }).eq('id', row.id);
  };

  const setVariant = async (row: Row, variant: string) => {
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, variant } : r)));
    await supabase.from('site_sections').update({ variant }).eq('id', row.id);
  };

  /** Publishing is a copy. draft goes to content and stops existing. */
  const publish = async (ids: string[]) => {
    setBusy(true);
    const now = new Date().toISOString();
    const targets = rows.filter((r) => ids.includes(r.id) && r.draft);
    for (const r of targets) {
      await supabase
        .from('site_sections')
        .update({ content: r.draft, draft: null, published_at: now })
        .eq('id', r.id);
    }
    setBusy(false);
    load();
  };

  const discard = async (row: Row) => {
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, draft: null } : r)));
    await supabase.from('site_sections').update({ draft: null }).eq('id', row.id);
  };

  const toggleLive = async (row: Row) => {
    const next = !row.live;
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, live: next } : r)));
    await supabase.from('site_sections').update({ live: next }).eq('id', row.id);
  };

  const add = async (spec: SectionSpec) => {
    if (!org) return;
    setBusy(true);
    const res = await supabase.from('site_sections').insert({
      org_id: org.id,
      kind: spec.kind,
      variant: spec.variants[0].id,
      content: {},
      sort: rows.length,
    });
    setBusy(false);
    setAdding(false);
    if (res.error) { setError(res.error.message); return; }
    load();
  };

  const move = async (row: Row, dir: -1 | 1) => {
    const i = rows.findIndex((r) => r.id === row.id);
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const reordered = [...rows];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    setRows(reordered.map((r, n) => ({ ...r, sort: n })));
    await Promise.all(
      reordered.map((r, n) => supabase.from('site_sections').update({ sort: n }).eq('id', r.id))
    );
  };

  return (
    <Page
      title="Your website"
      subtitle="The site as the sections it is made of. Edit the words, look at it on a real link, publish when you are happy."
      tabs={SITE_TABS}
      action={
        <>
          {previewUrl && (
            <Button variant="ghost" onClick={() => window.open(previewUrl, '_blank')}>
              Preview
            </Button>
          )}
          {pending > 0 && (
            <Button onClick={() => publish(rows.filter((r) => r.draft).map((r) => r.id))} disabled={busy}>
              {busy ? 'Publishing…' : `Publish ${pending}`}
            </Button>
          )}
        </>
      }
    >
      {error && <div style={{ fontSize: 13, color: C.red, marginBottom: 12 }}>{error}</div>}

      {/*
        How it works, in the product.
        
        A tool that needs explaining and does not explain itself is a tool you
        use once. Folded after the first read, because instructions you have
        absorbed become furniture.
      */}
      <Card style={{ marginBottom: 16 }}>
        <div
          onClick={() => setShowHow((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
              fontSize: 14, fontWeight: 600, color: C.text, flex: 1,
            }}
          >
            How this works
          </span>
          <span style={{ fontSize: 12, color: C.blue }}>{showHow ? 'Hide' : 'Read'}</span>
        </div>

        {showHow && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.step} style={{ display: 'flex', gap: 12 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
                    fontSize: 12, fontWeight: 700, color: C.faint,
                    width: 18, flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {i + 1}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: C.text, fontWeight: 500 }}>{s.step}</div>
                  <div style={{ fontSize: 13, color: C.faint, lineHeight: 1.6, marginTop: 2, maxWidth: '68ch' }}>
                    {s.detail}
                  </div>
                </div>
              </div>
            ))}
            {previewUrl && (
              <div style={{ fontSize: 12.5, color: C.faint, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                Your preview link, which needs no login so you can send it:{' '}
                <a href={previewUrl} target="_blank" rel="noreferrer noopener" style={{ color: C.blue }}>
                  {previewUrl.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>
        )}
      </Card>

      {!loaded ? (
        <Empty>Loading…</Empty>
      ) : (
        <>
          {pending > 0 && (
            <div
              style={{
                fontSize: 12.5, color: C.amber, marginBottom: 12, lineHeight: 1.6,
                padding: '8px 12px', borderRadius: 8,
                background: C.amberSoft, border: `1px solid ${C.amber}44`,
              }}
            >
              {pending} section{pending === 1 ? '' : 's'} edited and not published. The live site
              still shows the old words.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((row, i) => {
              const spec = specFor(row.kind);
              const isOpen = open === row.id;
              const data = row.draft ?? row.content;
              return (
                <Card key={row.id}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 11.5, color: C.faint, width: 16,
                        fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    {/* What shape this is, without opening it. */}
                    <SectionThumb kind={row.kind} variant={row.variant} />
                    <span
                      onClick={() => setOpen(isOpen ? null : row.id)}
                      style={{
                        fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
                        fontSize: 14.5, fontWeight: 600, color: row.live ? C.text : C.faint,
                        cursor: 'pointer',
                      }}
                    >
                      {spec?.label ?? row.kind}
                    </span>
                    <span style={{ fontSize: 12, color: C.faint }}>
                      {spec?.variants.find((v) => v.id === row.variant)?.label ?? row.variant}
                    </span>
                    {row.draft && (
                      <span
                        style={{
                          fontSize: 11, color: C.amber, border: `1px solid ${C.amber}55`,
                          borderRadius: 999, padding: '1px 9px',
                        }}
                      >
                        edited
                      </span>
                    )}
                    {!row.live && (
                      <span style={{ fontSize: 11.5, color: C.faint }}>hidden</span>
                    )}
                    <span style={{ flex: 1 }} />
                    <button onClick={() => move(row, -1)} disabled={i === 0}
                      style={{ background: 'transparent', border: 'none', color: i === 0 ? C.border : C.faint, cursor: 'pointer', fontSize: 13, padding: 0 }}>↑</button>
                    <button onClick={() => move(row, 1)} disabled={i === rows.length - 1}
                      style={{ background: 'transparent', border: 'none', color: i === rows.length - 1 ? C.border : C.faint, cursor: 'pointer', fontSize: 13, padding: 0 }}>↓</button>
                    <button
                      onClick={() => setOpen(isOpen ? null : row.id)}
                      style={{ background: 'transparent', border: 'none', padding: 0, color: C.blue, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {isOpen ? 'Close' : 'Edit'}
                    </button>
                  </div>

                  {isOpen && spec && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.6, marginBottom: 12, maxWidth: '68ch' }}>
                        {spec.purpose}
                      </div>

                      <SectionLabel>Which cut</SectionLabel>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                        {spec.variants.map((v) => {
                          const on = row.variant === v.id;
                          return (
                            <button
                              key={v.id}
                              onClick={() => setVariant(row, v.id)}
                              title={v.when}
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                border: `1px solid ${on ? C.accent : C.border}`,
                                background: on ? C.accentSoft : 'transparent',
                                color: on ? C.text : C.faint,
                                borderRadius: 10, padding: '8px 10px', fontSize: 12.5,
                                cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              {/* Choosing between two cuts by name is guessing.
                                  The shape is the whole difference. */}
                              <SectionThumb kind={row.kind} variant={v.id} />
                              {v.label}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 12, color: C.faint, marginTop: -8, marginBottom: 14 }}>
                        {spec.variants.find((v) => v.id === row.variant)?.when}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {spec.fields.map((f) => (
                          <div key={f.key}>
                            <div style={{ fontSize: 12.5, color: C.dim, fontWeight: 500 }}>{f.label}</div>
                            {f.hint && (
                              <div style={{ fontSize: 12, color: C.faint, margin: '1px 0 5px', lineHeight: 1.5 }}>
                                {f.hint}
                              </div>
                            )}
                            {f.kind === 'line' || f.kind === 'url' ? (
                              <input
                                value={data[f.key] ?? ''}
                                onChange={(e) => edit(row, f.key, e.target.value)}
                                style={inputStyle}
                              />
                            ) : (
                              <textarea
                                value={data[f.key] ?? ''}
                                onChange={(e) => edit(row, f.key, e.target.value)}
                                rows={f.kind === 'list' ? 5 : 3}
                                style={{ ...inputStyle, lineHeight: 1.6, resize: 'vertical' }}
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                        <Button onClick={() => publish([row.id])} disabled={busy || !row.draft}>
                          {row.draft ? 'Publish this section' : 'Nothing to publish'}
                        </Button>
                        {row.draft && (
                          <button onClick={() => discard(row)}
                            style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Throw the edit away
                          </button>
                        )}
                        <span style={{ flex: 1 }} />
                        <button onClick={() => toggleLive(row)}
                          style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {row.live ? 'Hide from the site' : 'Put back on the site'}
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <div style={{ marginTop: 14 }}>
            {adding ? (
              <Card>
                <SectionLabel>Add a section</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {SECTIONS.map((s) => (
                    <button
                      key={s.kind}
                      onClick={() => add(s)}
                      style={{
                        textAlign: 'left', background: 'transparent',
                        border: `1px solid ${C.border}`, borderRadius: 10,
                        padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <SectionThumb kind={s.kind} variant={s.variants[0].id} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, color: C.text, fontWeight: 500 }}>{s.label}</div>
                          <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.5, marginTop: 2 }}>
                            {s.purpose}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  <div>
                    <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Button variant="ghost" onClick={() => setAdding(true)}>Add a section</Button>
            )}
          </div>
        </>
      )}
    </Page>
  );
}
