'use client';

/**
 * One box. Talk or paste, and it goes where it belongs.
 *
 * The thing you do most often was the thing buried deepest: open Clients, find
 * the client, open them, land on Brief, find a faint dashed line, click it,
 * then talk. Six actions to write down what somebody just told you on the
 * phone, which means it does not get written down.
 *
 * This lives in the top bar, so it is one click from every screen, and it does
 * not ask which client first. You say what happened; picking the client is a
 * detail it can usually work out and you can always correct.
 *
 * WHY IT STILL SHOWS YOU EVERYTHING BEFORE SAVING
 *
 * Speed of capture, not speed of filing. Getting the note in has to be
 * instant. Deciding that it rewrites what we believe about a client's
 * economics does not, and never should be automatic.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, inputStyle } from './ui';
import { TalkToIt } from './TalkToIt';

const FIELD_LABEL: Record<string, string> = {
  opportunity: 'The opportunity',
  offer: 'What they sell',
  buyers: 'Who buys',
  edge: 'Why them',
  economics: 'How the money works',
  gtm: 'How it goes to market',
  constraints: 'What they will not do',
  ours: 'What we are doing',
};

interface Client { id: string; name: string }
interface Update { field: string; text: string; why: string }
interface Read {
  title: string;
  summary: string;
  tasks: { what: string }[];
  brief_updates: Update[];
  waiting_on?: string | null;
  uncertain: string[];
}

export function DropIt({ onClose }: { onClose: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [clientId, setClientId] = useState<string>('');
  const [read, setRead] = useState<Read | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from('customers').select('id, name').order('name'),
        supabase.from('profiles').select('active_org_id').maybeSingle(),
      ]);
      setClients((c.data ?? []) as Client[]);
      setOrgId((p.data as { active_org_id?: string } | null)?.active_org_id ?? null);
    })();
  }, []);

  /**
   * Guessed from what was said, then confirmed.
   *
   * Asking which client before you have said anything is the wrong order: you
   * open this because something just happened, not because you already
   * navigated to a record.
   */
  const guess = useMemo(() => {
    const t = text.toLowerCase();
    if (!t) return null;
    return (
      clients.find((c) => t.includes(c.name.toLowerCase())) ??
      clients.find((c) => c.name.split(/\s+/).some((w) => w.length > 4 && t.includes(w.toLowerCase()))) ??
      null
    );
  }, [text, clients]);

  useEffect(() => { if (guess && !clientId) setClientId(guess.id); }, [guess, clientId]);

  const chosen = clients.find((c) => c.id === clientId) ?? null;

  const distill = useCallback(async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      let brief: Record<string, string> = {};
      if (clientId) {
        const c = await supabase.from('customers').select('brief').eq('id', clientId).maybeSingle();
        brief = (c.data?.brief ?? {}) as Record<string, string>;
        setCurrent(brief);
      }
      const res = await fetch('/api/notes/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context: chosen?.name, brief }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not read that.'); return; }
      setRead(json as Read);
    } catch {
      setError('Could not reach the reader.');
    } finally {
      setBusy(false);
    }
  }, [text, clientId, chosen]);

  const fileIt = async () => {
    if (!read || !orgId) return;
    setBusy(true);
    await supabase.from('customer_notes').insert({
      org_id: orgId,
      customer_id: clientId || null,
      kind: 'note',
      body: `${read.title}\n\n${read.summary}\n\n---\n${text}`,
      happened_on: new Date().toISOString().slice(0, 10),
    });
    setBusy(false);
    setSaved(true);
  };

  const accept = async (u: Update) => {
    if (!clientId) return;
    const next = { ...current, [u.field]: u.text };
    await supabase.from('customers').update({ brief: next }).eq('id', clientId);
    setCurrent(next);
    setTaken((s) => new Set(s).add(u.field));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!read ? (
        <>
          <TalkToIt onText={(t) => setText((prev) => (prev ? `${prev}\n\n${t}` : t))} label="Talk" />

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="Say it or paste it. A call, a meeting, a thought on the way home. It works out who it is about."
            style={{ ...inputStyle, fontSize: 14, lineHeight: 1.6, resize: 'vertical' }}
          />

          <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              style={{
                background: C.panelAlt, color: clientId ? C.text : C.faint,
                border: `1px solid ${C.border}`, borderRadius: 7,
                padding: '7px 10px', fontSize: 13.5, fontFamily: 'inherit',
              }}
            >
              <option value="">Not about a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {guess && guess.id === clientId && (
              <span style={{ fontSize: 12.5, color: C.faint }}>picked up from what you said</span>
            )}

            <Button onClick={distill} disabled={busy || text.trim().length < 40} >
              {busy ? 'Reading…' : 'Sort it out'}
            </Button>
          </div>

          {text.trim().length > 0 && text.trim().length < 40 && (
            <div style={{ fontSize: 12.5, color: C.faint }}>
              A bit more and it can do something with it.
            </div>
          )}
          {error && <div style={{ fontSize: 13, color: C.red }}>{error}</div>}
        </>
      ) : (
        <>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 4 }}>
              {read.title}
            </div>
            <div style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.6 }}>{read.summary}</div>
          </div>

          {read.uncertain?.length > 0 && (
            <div
              style={{
                fontSize: 12.5, color: C.amber, lineHeight: 1.55,
                padding: '8px 11px', borderRadius: 7,
                background: C.amberSoft, border: `1px solid ${C.amber}44`,
              }}
            >
              Not sure about: {read.uncertain.join(' · ')}
            </div>
          )}

          {read.tasks?.length > 0 && (
            <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.6 }}>
              Committed to: {read.tasks.map((t) => t.what).join(' · ')}
            </div>
          )}

          {read.brief_updates?.length > 0 && chosen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: C.faint }}>
                Changes to what we know about {chosen.name}. Nothing saves until you take it.
              </div>
              {read.brief_updates.map((u) => (
                <div key={u.field} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 11px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                      {FIELD_LABEL[u.field] ?? u.field}
                    </span>
                    <span style={{ fontSize: 12, color: C.faint, flex: 1 }}>{u.why}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {u.text}
                  </div>
                  <div style={{ marginTop: 7 }}>
                    {taken.has(u.field)
                      ? <span style={{ fontSize: 12.5, color: C.green }}>Saved</span>
                      : <Button onClick={() => accept(u)}>Take this</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {saved ? (
              <>
                <span style={{ fontSize: 13, color: C.green }}>Filed.</span>
                <Button variant="ghost" onClick={onClose}>Done</Button>
              </>
            ) : (
              <>
                <Button onClick={fileIt} disabled={busy}>
                  {chosen ? `File it on ${chosen.name}` : 'File it'}
                </Button>
                <Button variant="ghost" onClick={() => { setRead(null); setTaken(new Set()); }}>
                  Back
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
