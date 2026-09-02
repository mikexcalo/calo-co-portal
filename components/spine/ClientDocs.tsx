'use client';

/**
 * The documents held for this client.
 *
 * Above each one, what it is and what it means, because a thirty thousand
 * character business plan and a one page answer sheet look identical in a list
 * and an excerpt of their first three lines tells you nothing.
 *
 * Beside each one, who may see it. Recorded rather than assumed: the
 * assumption people make when a system is silent is that everything is
 * shareable, and that assumption is only wrong once.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { Button, C, Card, Pill, SectionLabel, shortDate } from './ui';

interface Doc {
  id: string;
  brand_id: string | null;
  title: string | null;
  summary: string | null;
  takeaway: string | null;
  visibility: 'ours' | 'shared' | 'theirs';
  live_url: string | null;
  source: string | null;
  happened_on: string | null;
  body: string;
}

const SEEN: Record<Doc['visibility'], { label: string; tone: 'neutral' | 'blue' | 'green' }> = {
  ours: { label: 'ours only', tone: 'neutral' },
  shared: { label: 'shared', tone: 'blue' },
  theirs: { label: 'theirs', tone: 'green' },
};

export function ClientDocs({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await supabase
      .from('brand_intel')
      .select('id, brand_id, title, summary, takeaway, visibility, live_url, source, happened_on, body')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (!res.error) setDocs((res.data ?? []) as Doc[]);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const setVisibility = async (d: Doc, visibility: Doc['visibility']) => {
    setDocs((rows) => rows.map((r) => (r.id === d.id ? { ...r, visibility } : r)));
    await supabase.from('brand_intel').update({ visibility }).eq('id', d.id);
  };


  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, color: C.faint }}>and {docs.length} document{docs.length === 1 ? '' : 's'} they sent</div>
        {/* Capture was a sidebar row. It is a verb, and it files against a
            client, so it belongs on the client rather than in a list of
            places. */}
        <Button variant="ghost" onClick={() => router.push(`/notes?client=${customerId}`)}>
          Add something
        </Button>
      </div>

      {docs.length === 0 && (
        <div style={{ fontSize: 13, color: C.faint }}>
          Nothing yet. Anything they send you goes here with a summary above it.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {docs.map((d) => {
          const isOpen = open === d.id;
          return (
            <Card key={d.id}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span
                  onClick={() => setOpen(isOpen ? null : d.id)}
                  style={{ fontSize: 14.5, fontWeight: 600, color: C.text, cursor: 'pointer', flex: 1, minWidth: 200 }}
                >
                  {d.title ?? 'Untitled'}
                </span>
                <select
                  value={d.visibility}
                  onChange={(e) => setVisibility(d, e.target.value as Doc['visibility'])}
                  style={{
                    border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent',
                    fontSize: 11.5, color: C.dim, padding: '3px 6px', fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  <option value="ours">Ours only</option>
                  <option value="shared">Shared with them</option>
                  <option value="theirs">Theirs</option>
                </select>
                <Pill tone={SEEN[d.visibility].tone}>{SEEN[d.visibility].label}</Pill>
              </div>

              {d.summary && (
                <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6, margin: '8px 0 0', maxWidth: 680 }}>
                  {d.summary}
                </p>
              )}

              {d.takeaway && (
                <div
                  style={{
                    fontSize: 13, color: C.dim, marginTop: 8, lineHeight: 1.6,
                    paddingLeft: 11, borderLeft: `2px solid ${C.accentSoft}`, maxWidth: 660,
                  }}
                >
                  {d.takeaway}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: C.faint }}>
                  {[d.source, d.happened_on ? shortDate(d.happened_on) : null, `${Math.round(d.body.length / 1000)}k characters`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <button
                  onClick={() => setOpen(isOpen ? null : d.id)}
                  style={{ border: 'none', background: 'none', padding: 0, fontSize: 12.5, color: C.blue, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {isOpen ? 'Hide' : 'Read it'}
                </button>
                {d.live_url && (
                  <a href={d.live_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: C.blue, textDecoration: 'none' }}>
                    Open the live copy
                  </a>
                )}
                {d.brand_id && (
                  <button
                    onClick={() => router.push(`/brands/${d.brand_id}/intel`)}
                    style={{ border: 'none', background: 'none', padding: 0, fontSize: 12.5, color: C.blue, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Use it for the framework
                  </button>
                )}
              </div>

              {isOpen && (
                <pre
                  style={{
                    marginTop: 12, padding: '14px 16px', background: C.panelAlt,
                    border: `1px solid ${C.border}`, borderRadius: 8,
                    fontSize: 13, lineHeight: 1.75, color: C.dim,
                    whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                    maxHeight: '55vh', overflowY: 'auto',
                  }}
                >
                  {d.body}
                </pre>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
