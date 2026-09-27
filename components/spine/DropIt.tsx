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
import { addDrop } from '@/lib/spine/drops';
import { human } from '@/lib/spine/errors';
import { Button, C, Card, Select, inputStyle } from './ui';
import { TalkToIt } from './TalkToIt';
import { save as saveOrFail } from '@/lib/spine/save';

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

export function DropIt({
  onClose,
  customerId,
  jobId,
}: {
  onClose: () => void;
  /**
   * Who this is about, when the caller already knows.
   *
   * Opened from the top bar, nobody knows yet and the guesser works it out of
   * the words. Opened from a job, the answer is on the screen behind the
   * sheet - and asking anyway meant scrolling a dropdown of every customer to
   * re-select the one whose roof you are standing on.
   */
  customerId?: string | null;
  /** The job it was opened from, so the note files against that job too. */
  jobId?: string | null;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [clientId, setClientId] = useState<string>(customerId ?? '');
  const [read, setRead] = useState<Read | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<Set<string>>(new Set());
  /*
    The reader answered, and the answer was that it cannot help.
    
    Set on any failure of the extract route - unconfigured, unreachable, or
    erroring. It is what turns the one button into two, and it stays set for
    the life of the sheet: having been told the reader is down, somebody
    should not have to press a scanning button again to be told a second time.
  */
  const [readerDown, setReaderDown] = useState(false);
  /* It went to the pile rather than onto somebody's record. */
  const [toFile, setToFile] = useState(false);
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

  /* The guesser only fills a blank. A caller that said who this is about
     outranks a guess made from the words. */
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
      if (!res.ok) {
        setReaderDown(true);
        setError(json.error ?? 'Could not read that.');
        return;
      }
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
      setReaderDown(true);
      setError('Could not reach the reader.');
    } finally {
      setBusy(false);
    }
  }, [text, clientId, chosen]);

  /*
    Keep the words, unread.

    No title and no summary, because nothing has read it - inventing either
    here would be the product guessing and then presenting the guess as a
    record. `sorted_at` stays null, which is what the note screen reads to
    offer sorting later.
  */
  const saveRaw = async () => {
    if (!orgId || !text.trim()) return;
    setBusy(true);

    /*
      With nobody picked, it goes to the pile that exists for exactly this.

      customer_notes.customer_id is NOT NULL, and the first version of this
      treated that as the rule - "pick who this is about and it can be saved".
      Which is the same failure one step along: somebody standing on a roof
      types what happened, and the product asks them to answer a question
      they may not be able to answer before it will keep the words.

      `drops` is already the answer. It is the inbox for anything that
      arrived before its subject did, every column that would name a subject
      is nullable, and `filed_at` null is precisely "nobody has said who this
      is about yet". So an unattributed note is a drop, and the Drops screen
      is the To file list without a second one being built.
    */
    if (!clientId) {
      try {
        await addDrop(orgId, { kind: 'note', body: text.trim(), meta: { unsorted: true } });
        setToFile(true);
        setSaved(true);
      } catch (e) {
        setError(human(e));
      } finally {
        setBusy(false);
      }
      return;
    }

    const res = await saveOrFail(
      supabase.from('customer_notes').insert({
        org_id: orgId,
        customer_id: clientId,
        job_id: jobId ?? null,
        kind: 'note',
        body: text.trim(),
        source: 'typed',
        sorted_at: null,
        happened_on: new Date().toISOString().slice(0, 10),
      }),
      'Saving the note'
    );
    setBusy(false);
    if (!res.error) setSaved(true);
  };

  const fileIt = async () => {
    if (!read || !orgId) return;
    setBusy(true);
    await saveOrFail(supabase.from('customer_notes').insert({
      org_id: orgId,
      customer_id: clientId || null,
      kind: 'note',
      body: `${read.title}\n\n${read.summary}\n\n---\n${text}`,
      happened_on: new Date().toISOString().slice(0, 10),
    }));
    setBusy(false);
    setSaved(true);
  };

  const accept = async (u: Update) => {
    if (!clientId) return;
    const next = { ...current, [u.field]: u.text };
    await saveOrFail(supabase.from('customers').update({ brief: next }).eq('id', clientId));
    setCurrent(next);
    setTaken((s) => new Set(s).add(u.field));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!read && saved ? (
        /*
          Saved without being read, so this says so.

          The confirmation further down belongs to the sorted path and never
          renders here - `read` is null, because nothing read it. Somebody who
          pressed Save note and saw nothing change would reasonably press it
          again.
        */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 13.5, color: C.green, lineHeight: 1.6 }}>
            {toFile
              ? 'Saved to Drops, word for word.'
              : `Saved on ${chosen?.name ?? 'the record'}, word for word.`}
            {' '}Nothing has read it yet, so it has no summary.
          </span>
          <span style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.6 }}>
            {toFile
              ? 'Drops is the pile of things nobody has said a subject for yet. One tap there files it to a customer or a job.'
              : 'It is waiting to be sorted wherever it is filed, and sorting it is a button there once the reader is back.'}
          </span>
          <div>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : !read ? (
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
            <Select
              value={clientId}
              onChange={setClientId}
              placeholder="Not about a client"
              style={{ width: 'auto', minWidth: 200 }}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
            />

            {guess && guess.id === clientId && (
              <span style={{ fontSize: 12.5, color: C.faint }}>picked up from what you said</span>
            )}

            {/*
              One button until the reader lets us down, then the honest one.

              Sorting is better when it works, so it stays the offer. What
              changed is that "it did not work" is no longer the end of the
              road: the words are kept either way, and the sorting can happen
              later from the note itself.
            */}
            {readerDown ? (
              <Button onClick={saveRaw} disabled={busy || !text.trim()}>
                {busy ? 'Saving…' : 'Save note'}
              </Button>
            ) : (
              <Button onClick={distill} disabled={busy || text.trim().length < 40}>
                {busy ? 'Scanning…' : 'Scan and sort'}
              </Button>
            )}
          </div>



          {!readerDown && text.trim().length > 0 && text.trim().length < 40 && (
            <div style={{ fontSize: 12.5, color: C.faint }}>
              A bit more and it can do something with it.
            </div>
          )}

          {readerDown && (
            <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>
              Sorting is unavailable, so this will be kept exactly as you typed
              it.{' '}
              {clientId
                ? `You can sort it later from the ${jobId ? 'job' : 'record'} it is filed against.`
                : 'With nobody picked it goes to Drops, where one tap files it.'}
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
                {/* "Filed." answered nothing. A note that vanishes into a
                    place you cannot name is a note you will write once. */}
                <span style={{ fontSize: 13, color: C.green }}>
                  {chosen
                    ? `Filed on ${chosen.name}, under Now.`
                    : 'Filed. Not attached to a client, so it lives in your notes.'}
                </span>
                {chosen && (
                  <Button
                    onClick={() => {
                      onClose();
                      window.location.href = `/customers/${clientId}?tab=history`;
                    }}
                  >
                    Open it
                  </Button>
                )}
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
