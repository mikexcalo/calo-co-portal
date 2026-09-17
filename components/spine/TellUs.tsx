'use client';

/**
 * Say what you need, from the screen where you noticed it.
 *
 * Feedback arrives as a text message, or three days later in conversation, by
 * which point the person has forgotten which screen they were on and what they
 * were trying to do. Both of those are the useful half, so this sits on Home
 * and records the page by itself.
 *
 * Three kinds, because they want different responses and lumping them together
 * puts the broken ones in a queue behind the ideas.
 */

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { Button, C, Card, SectionLabel, inputStyle } from './ui';
import { save as saveOrFail } from '@/lib/spine/save';

const KINDS = [
  { id: 'idea',      label: 'I need something', hint: 'A thing that is not here yet.' },
  { id: 'broken',    label: 'This is broken',   hint: 'It did the wrong thing.' },
  { id: 'confusing', label: 'I got lost',       hint: 'You could not find or understand something.' },
] as const;

export function TellUs() {
  const { org } = useOrg();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>('idea');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<{ id: string; body: string; status: string; reply: string | null }[]>([]);

  const load = useCallback(async () => {
    if (!org) return;
    const { data: auth } = await supabase.auth.getUser();
    const meId = auth?.user?.id;
    if (!meId) { setMine([]); return; }
    const res = await supabase
      .from('feedback')
      .select('id, body, status, reply')
      .eq('org_id', org.id)
      // Yours only. Everyone else's notes belong in Asked for, where there is
      // something to answer them with.
      .eq('author_id', meId)
      .order('created_at', { ascending: false })
      .limit(6);
    if (!res.error) setMine(res.data ?? []);
  }, [org]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!org || !body.trim()) return;
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const res = await saveOrFail(supabase.from('feedback').insert({
      org_id: org.id,
      author_id: auth?.user?.id ?? null,
      kind,
      body: body.trim(),
      // Recorded rather than asked. "Which screen" is the question nobody can
      // answer afterwards.
      page: pathname,
    }));
    setBusy(false);
    if (res.error) return;
    setBody('');
    setSent(true);
    setTimeout(() => { setSent(false); setOpen(false); }, 2500);
    load();
  };

  if (!open) {
    return (
      <div style={{ marginBottom: 22 }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            border: `1px dashed ${C.border}`, background: 'transparent', width: '100%',
            borderRadius: 10, padding: '11px 14px', textAlign: 'left',
            fontSize: 13.5, color: C.dim, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Tell us what you need, or what went wrong
          {mine.length > 0 && (
            <span style={{ color: C.faint }}>
              {'  ·  '}{mine.length} sent{mine.some((m) => m.reply) ? ', some answered' : ''}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 9 }}>
        <SectionLabel>Tell us</SectionLabel>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Close
        </button>
      </div>

      <Card>
        {sent ? (
          <div style={{ fontSize: 13.5, color: C.green }}>
            Sent. It goes straight through, and you will see a reply here.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {KINDS.map((k) => {
                const on = kind === k.id;
                return (
                  <button
                    key={k.id}
                    onClick={() => setKind(k.id)}
                    title={k.hint}
                    style={{
                      border: `1px solid ${on ? C.accent : C.border}`,
                      background: on ? C.accentSoft : 'transparent',
                      color: on ? C.text : C.faint,
                      borderRadius: 999, padding: '4px 13px', fontSize: 12.5,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {k.label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              autoFocus
              placeholder={KINDS.find((k) => k.id === kind)?.hint}
              style={{ ...inputStyle, lineHeight: 1.6, resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10 }}>
              <Button onClick={send} disabled={busy || !body.trim()}>
                {busy ? 'Sending…' : 'Send it'}
              </Button>
              <span style={{ fontSize: 12, color: C.faint }}>
                The screen you are on goes with it.
              </span>
            </div>
          </>
        )}

        {mine.length > 0 && (
          <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            {mine.map((m) => (
              <div key={m.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, color: C.dim, flex: 1, lineHeight: 1.5 }}>{m.body}</span>
                  <span
                    style={{
                      fontSize: 11, flexShrink: 0,
                      color: m.status === 'done' ? C.green : m.status === 'building' ? C.amber : C.faint,
                    }}
                  >
                    {m.status}
                  </span>
                </div>
                {m.reply && (
                  <div style={{ fontSize: 12.5, color: C.green, marginTop: 3, lineHeight: 1.5 }}>
                    {m.reply}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
