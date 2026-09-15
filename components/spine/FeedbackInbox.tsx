'use client';

/**
 * What people are asking for, across every workspace you belong to.
 *
 * A tester writing in her own workspace is invisible from yours, so an inbox
 * scoped the usual way would be five inboxes nobody checks. This reads across
 * membership instead: everything from every business you belong to, in one
 * list, on the screen you already open first.
 *
 * Only appears when there is something. A permanently empty panel on Home is a
 * thing you learn to look past, and then miss the day it fills.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { Button, C, Card, SectionLabel, inputStyle } from './ui';

interface Row {
  id: string;
  org_id: string;
  kind: string;
  body: string;
  page: string | null;
  status: string;
  reply: string | null;
  created_at: string;
  orgs: { name: string }[] | { name: string } | null;
}

const TONE: Record<string, string> = { broken: 'red', confusing: 'amber', idea: 'faint' };

export function FeedbackInbox({ currentOrgId }: { currentOrgId: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  const load = useCallback(async () => {
    const res = await supabase
      .from('feedback')
      .select('id, org_id, kind, body, page, status, reply, created_at, orgs(name)')
      .in('status', ['open', 'building'])
      .order('created_at', { ascending: false })
      .limit(25);
    if (!res.error) setRows((res.data ?? []) as Row[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Yours is not news to you.
   *
   * A note you wrote yourself in this workspace is already on the screen
   * underneath, in Tell us. What belongs here is what somebody else said.
   */
  const others = rows.filter((r) => r.org_id !== currentOrgId);
  if (others.length === 0) return null;

  const orgName = (r: Row) => (Array.isArray(r.orgs) ? r.orgs[0]?.name : r.orgs?.name) ?? 'a workspace';

  const answer = async (id: string, status: string) => {
    setRows((p) => p.filter((r) => r.id !== id || status === 'building'));
    await supabase
      .from('feedback')
      .update({
        status,
        reply: reply.trim() || null,
        closed_at: status === 'done' || status === 'wont' ? new Date().toISOString() : null,
      })
      .eq('id', id);
    setReply('');
    setOpen(null);
    load();
  };

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel>Asked for ({others.length})</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {others.map((r) => {
          const isOpen = open === r.id;
          const tone = TONE[r.kind] ?? 'faint';
          return (
            <Card key={r.id}>
              <div
                onClick={() => { setOpen(isOpen ? null : r.id); setReply(r.reply ?? ''); }}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11, borderRadius: 999, padding: '1px 9px', flexShrink: 0,
                      color: tone === 'red' ? C.red : tone === 'amber' ? C.amber : C.faint,
                      border: `1px solid ${tone === 'red' ? `${C.red}55` : tone === 'amber' ? `${C.amber}55` : C.border}`,
                    }}
                  >
                    {r.kind}
                  </span>
                  <span style={{ fontSize: 12.5, color: C.faint }}>{orgName(r)}</span>
                  {r.page && <span style={{ fontSize: 12, color: C.faint }}>{r.page}</span>}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, color: C.faint }}>{r.created_at.slice(0, 10)}</span>
                </div>
                <div style={{ fontSize: 13.5, color: C.text, marginTop: 5, lineHeight: 1.55 }}>
                  {r.body}
                </div>
              </div>

              {isOpen && (
                <div style={{ marginTop: 12 }}>
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Say something back. They see it where they wrote it."
                    style={inputStyle}
                  />
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                    <Button onClick={() => answer(r.id, 'done')}>Built it</Button>
                    <button onClick={() => answer(r.id, 'building')}
                      style={{ background: 'transparent', border: 'none', padding: 0, color: C.blue, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Working on it
                    </button>
                    <span style={{ flex: 1 }} />
                    {r.page && (
                      <button onClick={() => router.push(r.page as string)}
                        style={{ background: 'transparent', border: 'none', padding: 0, color: C.blue, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Go and look
                      </button>
                    )}
                    <button onClick={() => answer(r.id, 'wont')}
                      style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Not doing it
                    </button>
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
