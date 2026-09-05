'use client';

/**
 * What you have pushed out to be built, and what happened to it.
 *
 * Pressing send has to lead somewhere you can look at afterwards, or it is a
 * button that swallows things. Each row holds the exact before and after of
 * every field that moved, so whoever picks it up can make the change without
 * asking a question first.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { specFor } from '@/lib/spine/sections';
import { SITE_TABS, Button, C, Card, Empty, Page } from '@/components/spine/ui';

interface Req {
  id: string;
  kind: string;
  variant: string;
  before: Record<string, string> | null;
  after: Record<string, string>;
  changed: string[];
  status: 'open' | 'building' | 'done' | 'dropped';
  created_at: string;
}

const TONE: Record<Req['status'], string> = {
  open: 'amber',
  building: 'blue',
  done: 'green',
  dropped: 'neutral',
};

export default function QueuePage() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase
      .from('site_change_requests')
      .select('id, kind, variant, before, after, changed, status, created_at')
      .order('created_at', { ascending: false })
      .limit(120);
    if (!res.error) setRows((res.data ?? []) as Req[]);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: Req['status']) => {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
    await supabase
      .from('site_change_requests')
      .update({ status, closed_at: status === 'done' || status === 'dropped' ? new Date().toISOString() : null })
      .eq('id', id);
  };

  const shown = rows.filter((r) => (showDone ? true : r.status === 'open' || r.status === 'building'));
  const openCount = rows.filter((r) => r.status === 'open').length;

  return (
    <Page
      title="Build queue"
      subtitle="Edits pushed out to be made real on the site."
      tabs={SITE_TABS}
      action={
        <Button variant="ghost" onClick={() => setShowDone((v) => !v)}>
          {showDone ? 'Hide finished' : 'Show finished'}
        </Button>
      }
    >
      {!loaded ? (
        <Empty>Loading…</Empty>
      ) : shown.length === 0 ? (
        <Card>
          <Empty>
            Nothing waiting. Edit a section, look at the preview, then send it to build.
          </Empty>
        </Card>
      ) : (
        <>
          {openCount > 0 && (
            <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 12 }}>
              {openCount} waiting to be built.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map((r) => {
              const spec = specFor(r.kind);
              const isOpen = open === r.id;
              const tone = TONE[r.status];
              return (
                <Card key={r.id}>
                  <div
                    onClick={() => setOpen(isOpen ? null : r.id)}
                    style={{ display: 'flex', gap: 11, alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap' }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
                        fontSize: 14, fontWeight: 600, color: C.text,
                      }}
                    >
                      {spec?.label ?? r.kind}
                    </span>
                    <span style={{ fontSize: 12.5, color: C.faint }}>
                      {r.changed.length} field{r.changed.length === 1 ? '' : 's'}
                    </span>
                    <span
                      style={{
                        fontSize: 11, borderRadius: 999, padding: '1px 9px',
                        color: tone === 'amber' ? C.amber : tone === 'green' ? C.green : C.faint,
                        border: `1px solid ${tone === 'amber' ? `${C.amber}55` : tone === 'green' ? `${C.green}55` : C.border}`,
                      }}
                    >
                      {r.status}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 11.5, color: C.faint }}>
                      {r.created_at.slice(0, 10)}
                    </span>
                    <span style={{ fontSize: 12, color: C.blue }}>{isOpen ? 'Close' : 'What changed'}</span>
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: 12 }}>
                      {r.changed.length === 0 ? (
                        <div style={{ fontSize: 13, color: C.faint }}>Nothing textual changed.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {r.changed.map((k) => {
                            const label = spec?.fields.find((f) => f.key === k)?.label ?? k;
                            return (
                              <div key={k}>
                                <div style={{ fontSize: 11.5, color: C.faint, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                                  {label}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
                                  <Side title="Was" text={r.before?.[k] ?? ''} muted />
                                  <Side title="Now" text={r.after[k] ?? ''} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                        {r.status !== 'done' && (
                          <Button onClick={() => setStatus(r.id, 'done')}>Mark built</Button>
                        )}
                        {r.status === 'open' && (
                          <button onClick={() => setStatus(r.id, 'building')}
                            style={{ background: 'transparent', border: 'none', padding: 0, color: C.blue, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Being built
                          </button>
                        )}
                        <span style={{ flex: 1 }} />
                        {r.status !== 'dropped' && (
                          <button onClick={() => setStatus(r.id, 'dropped')}
                            style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Drop it
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}

/** One side of the change, so old and new sit next to each other. */
function Side({ title, text, muted }: { title: string; text: string; muted?: boolean }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '8px 10px',
        background: muted ? C.panelAlt : C.panel,
      }}
    >
      <div style={{ fontSize: 10.5, color: C.faint, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: muted ? C.faint : C.text, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
        {text || '—'}
      </div>
    </div>
  );
}
