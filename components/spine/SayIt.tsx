'use client';

/**
 * Talk about a client, and have it land in the right places.
 *
 * The gap this closes: a call could become a note and a task, and the eight
 * fields describing the client stayed exactly as they were. So notes piled up
 * underneath a brief that slowly went out of date, and the brief is the thing
 * anybody actually reads.
 *
 * NOTHING IS WRITTEN WITHOUT BEING SEEN
 *
 * Every proposal is shown with the reason it was made and the text it would
 * replace, and each is accepted on its own. A rambling five minutes about
 * shipping must never silently overwrite a paragraph somebody wrote carefully
 * about the economics, and the only way to guarantee that is to never write
 * without a person looking.
 *
 * The note itself is saved regardless, because the note is the record. The
 * proposals are an opinion about the note.
 */

import { useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, SectionLabel } from './ui';
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

interface Update { field: string; text: string; why: string }
interface Person { name: string; role?: string | null; email?: string | null; phone?: string | null }
interface Task { what: string; who?: string | null; due?: string | null }

interface Read {
  title: string;
  summary: string;
  people: Person[];
  tasks: Task[];
  brief_updates: Update[];
  waiting_on?: string | null;
  uncertain: string[];
}

export function SayIt({
  customerId,
  clientName,
  orgId,
  onDone,
}: {
  customerId: string;
  clientName: string;
  orgId: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState<Read | null>(null);
  const [transcript, setTranscript] = useState('');
  const [current, setCurrent] = useState<Record<string, string>>({});
  const [taken, setTaken] = useState<Set<string>>(new Set());

  const send = async (text: string) => {
    setBusy(true);
    setError(null);
    setTranscript(text);
    try {
      // The brief goes with it, so a rewrite keeps what is still true rather
      // than reducing a field to whatever today's call happened to mention.
      const c = await supabase.from('customers').select('brief').eq('id', customerId).maybeSingle();
      const brief = (c.data?.brief ?? {}) as Record<string, string>;
      setCurrent(brief);

      const res = await fetch('/api/notes/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context: clientName, brief }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not read that.'); return; }
      /**
       * The reading is nested, and both panels read the top level.
       *
       * The route answers { extracted, model, costCents }. Reading json
       * directly made every field undefined, so the review screen rendered
       * blank and the filed note literally began with the word "undefined"
       * twice. Tolerant of both shapes so a future change to either side
       * cannot silently do this again.
       */
      const read = (json.extracted ?? json) as Read;
      if (!read?.summary && !read?.title) {
        setError('The reader came back with nothing usable. The note is still yours to paste in.');
        return;
      }
      setRead(read);
    } catch {
      setError('Could not reach the reader. The note is still yours to paste in by hand.');
    } finally {
      setBusy(false);
    }
  };

  /** The note is the record, so it is saved before anything is judged. */
  const saveNote = async (r: Read) => {
    await supabase.from('customer_notes').insert({
      org_id: orgId,
      customer_id: customerId,
      kind: 'call',
      body: `${r.title}\n\n${r.summary}\n\n---\nSaid:\n${transcript}`,
      happened_on: new Date().toISOString().slice(0, 10),
    });
  };

  const accept = async (u: Update) => {
    const next = { ...current, [u.field]: u.text };
    await supabase.from('customers').update({ brief: next }).eq('id', customerId);
    setCurrent(next);
    setTaken((s) => new Set(s).add(u.field));
  };

  const acceptWaiting = async (w: string) => {
    await supabase
      .from('customers')
      .update({ waiting_on: w, awaiting_reply_since: new Date().toISOString().slice(0, 10) })
      .eq('id', customerId);
    setTaken((s) => new Set(s).add('__waiting'));
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          border: `1px dashed ${C.border}`, background: 'transparent', width: '100%',
          borderRadius: 10, padding: '10px 13px', marginBottom: 14, textAlign: 'left',
          fontSize: 13, color: C.faint, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Talk about {clientName} and file it
      </button>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
        <SectionLabel>Say it</SectionLabel>
        <Button variant="ghost" onClick={() => { setOpen(false); setRead(null); }}>Close</Button>
      </div>

      {!read && (
        <>
          <TalkToIt onText={send} label={`Talk about ${clientName}`} />
          {busy && <div style={{ fontSize: 13, color: C.faint }}>Reading it…</div>}
          {error && <div style={{ fontSize: 13, color: C.red }}>{error}</div>}
        </>
      )}

      {read && (
        <Card>
          <div style={{ fontSize: 14.5, fontWeight: 500, color: C.text, marginBottom: 5 }}>
            {read.title}
          </div>
          <div style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.6, marginBottom: 14 }}>
            {read.summary}
          </div>

          {/* Named first, because a misheard number is the failure mode that
              matters and it is invisible once it is in a field. */}
          {read.uncertain?.length > 0 && (
            <div
              style={{
                fontSize: 12.5, color: C.amber, marginBottom: 14, lineHeight: 1.55,
                padding: '8px 11px', borderRadius: 7,
                background: C.amberSoft, border: `1px solid ${C.amber}44`,
              }}
            >
              Not sure about: {read.uncertain.join(' · ')}
            </div>
          )}

          {read.brief_updates?.length > 0 ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: C.faint, marginBottom: 7 }}>
                Proposed changes to the brief. Nothing is saved until you take it.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {read.brief_updates.map((u) => {
                  const done = taken.has(u.field);
                  return (
                    <div
                      key={u.field}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}
                    >
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                          {FIELD_LABEL[u.field] ?? u.field}
                        </span>
                        <span style={{ fontSize: 12, color: C.faint, flex: 1 }}>{u.why}</span>
                      </div>
                      <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {u.text}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        {done ? (
                          <span style={{ fontSize: 12.5, color: C.green }}>Saved</span>
                        ) : (
                          <Button onClick={() => accept(u)}>Take this</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 14 }}>
              Nothing here changes what we know about {clientName}, which is the usual answer.
            </div>
          )}

          {read.waiting_on && !taken.has('__waiting') && (
            <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: C.dim }}>
                Waiting on: {read.waiting_on}
              </span>
              <Button variant="ghost" onClick={() => acceptWaiting(read.waiting_on as string)}>
                Set it
              </Button>
            </div>
          )}

          {read.tasks?.length > 0 && (
            <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 14, lineHeight: 1.6 }}>
              Committed to: {read.tasks.map((t) => t.what).join(' · ')}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <Button
              onClick={async () => {
                await saveNote(read);
                setRead(null);
                setOpen(false);
                onDone?.();
              }}
            >
              File the note
            </Button>
            <Button variant="ghost" onClick={() => setRead(null)}>Start again</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
