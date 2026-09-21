'use client';

/**
 * What people are asking for, on the workspace you are standing in.
 *
 * A tester writing in her own workspace is invisible from yours, so this reads
 * across membership: everything from every business you belong to, in one
 * query, on the screen you already open first.
 *
 * What it does NOT do any more is show them all at once. Standing in Global
 * Seafood's workspace, Lakemere's complaint was sitting on the home screen —
 * one client's workspace showing another client's name. Nobody else can see
 * it (the row filter only returns businesses you belong to), but it makes the
 * switcher a lie: if the workspace does not change what is on the page, there
 * is no point having one.
 *
 * So the notes written here are shown here, and everything else is one muted
 * line saying where it is.
 *
 * Only appears when there is something. A permanently empty panel on Home is a
 * thing you learn to look past, and then miss the day it fills.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { Button, C, Card, SectionLabel, inputStyle } from './ui';
import { save as saveOrFail } from '@/lib/spine/save';

interface Row {
  id: string;
  org_id: string;
  author_id: string | null;
  kind: string;
  body: string;
  page: string | null;
  status: string;
  reply: string | null;
  created_at: string;
  orgs: { name: string }[] | { name: string } | null;
}

const TONE: Record<string, string> = { broken: 'red', confusing: 'amber', idea: 'faint' };

/**
 * The verb has to match what they said.
 *
 * Every note got "Built it", including "this screen confused me" — which
 * answers a request nobody made and reads as though nothing was understood.
 * Somebody reporting confusion wants to hear it was made clearer; somebody
 * reporting a break wants to hear it was fixed.
 */
const DONE_LABEL: Record<string, string> = {
  idea: 'Built it',
  broken: 'Fixed it',
  confusing: 'Made it clearer',
};

export function FeedbackInbox({ currentOrgId }: { currentOrgId: string | null }) {
  const router = useRouter();
  const { switchOrg } = useOrg();
  const [going, setGoing] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data?.user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    const res = await supabase
      .from('feedback')
      .select('id, org_id, author_id, kind, body, page, status, reply, created_at, orgs(name)')
      .in('status', ['open', 'building'])
      .order('created_at', { ascending: false })
      .limit(25);
    if (!res.error) setRows((res.data ?? []) as Row[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Not mine, rather than not here.
   *
   * This filtered on workspace, which meant Go and look removed the reply box
   * it had just sent you to use: switch into her workspace to see what she
   * saw, and her note stops being "somebody else's" and disappears. Authorship
   * is the thing that was actually meant — a note you wrote is not news to
   * you no matter which workspace you are standing in.
   */
  const notMine = rows.filter((r) => r.author_id !== me);
  const others = notMine.filter((r) => r.org_id === currentOrgId);
  const elsewhere = notMine.filter((r) => r.org_id !== currentOrgId);
  if (others.length === 0 && elsewhere.length === 0) return null;

  const orgName = (r: Row) => (Array.isArray(r.orgs) ? r.orgs[0]?.name : r.orgs?.name) ?? 'a workspace';

  /* One line per workspace, not one per note — the point is where to go. */
  const byOrg = elsewhere.reduce<Record<string, { name: string; n: number }>>((acc, r) => {
    const k = r.org_id;
    acc[k] = { name: orgName(r), n: (acc[k]?.n ?? 0) + 1 };
    return acc;
  }, {});

  const answer = async (id: string, status: string) => {
    setRows((p) => p.filter((r) => r.id !== id || status === 'building'));
    await saveOrFail(supabase
      .from('feedback')
      .update({
        status,
        reply: reply.trim() || null,
        closed_at: status === 'done' || status === 'wont' ? new Date().toISOString() : null,
      })
      .eq('id', id));
    /**
     * Tell them you answered.
     *
     * The reply landed on the screen they wrote it on and nothing said so, so
     * a tester had to go back and check on the off chance. Somebody who is
     * doing you a favour by reporting a bug should not have to.
     */
    const row = rows.find((r) => r.id === id);
    if (row) {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const said = { done: 'sorted', building: 'on it', wont: 'not doing it' }[status] ?? 'answered';
      if (token) {
        await fetch('/api/asks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            orgId: row.org_id,
            title: `We answered: ${row.body.slice(0, 60)}${row.body.length > 60 ? '…' : ''}`,
            detail: reply.trim() ? `${reply.trim()}\n\n— marked ${said}` : `Marked ${said}.`,
            href: '/feedback',
          }),
        }).catch(() => {});
      }
    }

    setReply('');
    setOpen(null);
    load();
  };

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel>Asked for ({others.length})</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {others.length === 0 && (
          <div style={{ fontSize: 13, color: C.faint }}>Nothing asked for here.</div>
        )}
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
                  {/*
                    Three answers, three buttons that look like buttons.
                    
                    It was one pill and three pieces of text, so two of the
                    four things you could do here did not read as clickable at
                    all. Going to look is not an answer to her, so it sits
                    apart from the three that are.
                  */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                    <Button onClick={() => answer(r.id, 'done')}>
                      {DONE_LABEL[r.kind] ?? 'Sorted it'}
                    </Button>
                    <Button variant="ghost" onClick={() => answer(r.id, 'building')}>
                      Working on it
                    </Button>
                    <Button variant="ghost" onClick={() => answer(r.id, 'wont')}>
                      Not doing it
                    </Button>
                    <span style={{ flex: 1 }} />
                    <button
                      disabled={going === r.id}
                      onClick={async () => {
                        setGoing(r.id);
                        try {
                          /**
                           * Her screen, not your screen.
                           *
                           * This used to push the path and nothing else, so a
                           * note written in Lakemere's workspace opened your
                           * own copy of that path — and when the path was "/"
                           * and you were already on Home, it did nothing at
                           * all. The workspace is most of the answer to "what
                           * was she looking at", so switch first and navigate
                           * second.
                           */
                          if (r.org_id !== currentOrgId) await switchOrg(r.org_id);
                          const path = r.page && r.page.startsWith('/') ? r.page : '/';
                          router.push(path);
                          router.refresh();
                        } finally {
                          setGoing(null);
                        }
                      }}
                      title={`Switch to ${orgName(r)} and open ${r.page || 'Home'}`}
                      style={{ background: 'transparent', border: 'none', padding: 0, color: C.blue, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {going === r.id ? 'Going…' : `Go and look${r.org_id !== currentOrgId ? ` in ${orgName(r)}` : ''}`}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {Object.keys(byOrg).length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {Object.entries(byOrg).map(([id, o]) => (
            <button
              key={id}
              onClick={async () => { await switchOrg(id); router.push('/'); router.refresh(); }}
              style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {o.n} waiting in {o.name} →
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
