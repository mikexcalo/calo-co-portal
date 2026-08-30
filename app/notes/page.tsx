'use client';

/**
 * Somewhere to put a conversation.
 *
 * The gap this fills: everything the business knows that isn't a receipt or an
 * invoice. What the customer said on the phone. Notes from a walkthrough. A
 * transcript from a recorded call. It lived in a notes app, a voice memo, or
 * nowhere, and it was the context that made the invoice make sense.
 *
 * Paste it, read what came back, correct what's wrong, save it against the
 * customer. The reading costs about a cent and happens once — the answer is
 * stored, so opening it next year is free.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import {
  Button,
  C,
  Card,
  Empty,
  Field,
  Page,
  Pill,
  SectionLabel,
  inputStyle,
  shortDate,
} from '@/components/spine/ui';

interface Person { name: string; role?: string | null; email?: string | null; phone?: string | null }
interface Task { what: string; who?: string | null; due?: string | null }
interface Amount { amount: number; what: string }

interface Extracted {
  title: string;
  summary: string;
  people: Person[];
  tasks: Task[];
  amounts: Amount[];
  happened_on?: string | null;
  uncertain: string[];
}

interface NoteRow {
  id: string;
  title: string | null;
  body: string;
  kind: string | null;
  source: string | null;
  happened_on: string | null;
  created_at: string;
  customer_id: string | null;
}

export default function NotesPage() {
  const { org, vocab } = useOrg();

  const [raw, setRaw] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [result, setResult] = useState<Extracted | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    if (!org) return;
    const [c, n] = await Promise.all([
      supabase.from('customers').select('id, name').eq('org_id', org.id).order('name'),
      supabase
        .from('customer_notes')
        .select('id, title, body, kind, source, happened_on, created_at, customer_id')
        .eq('org_id', org.id)
        .order('created_at', { ascending: false })
        .limit(40),
    ]);
    setCustomers(c.data ?? []);
    setNotes((n.data ?? []) as NoteRow[]);
    setLoading(false);
  }, [org]);

  useEffect(() => { load(); }, [load]);

  const read = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const context = customers.find((c) => c.id === customerId)?.name;
      const res = await fetch('/api/notes/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: raw, context }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not read that.');
      setResult(payload.extracted as Extracted);
      setCost(payload.costCents ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * The summary is saved alongside the original, never instead of it. A model
   * summary is a convenience; the transcript is the record, and the moment
   * somebody disputes what was agreed, the convenience is worthless and the
   * record is everything.
   */
  const save = async () => {
    if (!org || !result) return;
    setBusy(true);
    setError(null);
    try {
      const parts = [
        result.summary,
        result.tasks.length
          ? '\nAgreed:\n' + result.tasks.map((t) => `· ${t.what}${t.who ? ` — ${t.who}` : ''}${t.due ? ` (by ${t.due})` : ''}`).join('\n')
          : '',
        result.amounts.length
          ? '\nAmounts mentioned:\n' + result.amounts.map((a) => `· $${a.amount} — ${a.what}`).join('\n')
          : '',
        result.people.length
          ? '\nPeople:\n' + result.people.map((p) => `· ${p.name}${p.role ? `, ${p.role}` : ''}${p.email ? ` — ${p.email}` : ''}${p.phone ? ` — ${p.phone}` : ''}`).join('\n')
          : '',
        result.uncertain.length
          ? '\nUnclear in the original:\n' + result.uncertain.map((u) => `· ${u}`).join('\n')
          : '',
        '\n\n— — —\nOriginal:\n' + raw,
      ];

      const res = await supabase.from('customer_notes').insert({
        org_id: org.id,
        customer_id: customerId || null,
        title: result.title,
        body: parts.filter(Boolean).join('\n'),
        kind: 'note',
        source: 'transcript',
        happened_on: result.happened_on || new Date().toISOString().slice(0, 10),
      });
      if (res.error) throw new Error(res.error.message);

      setResult(null);
      setRaw('');
      setCost(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = async (file: File) => {
    if (!/\.(txt|md|vtt|srt|csv|rtf)$/i.test(file.name) && !file.type.startsWith('text/')) {
      setError('That needs to be a text file — a .txt, .md or a transcript export.');
      return;
    }
    setRaw(await file.text());
    setError(null);
  };

  return (
    <Page
      title="Notes"
      subtitle="Paste a call transcript or your notes. It pulls out what matters; you check it before it's saved."
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16, maxWidth: 720 }}>
          <div style={{ color: C.red, fontSize: 13, lineHeight: 1.6 }}>{error}</div>
        </Card>
      )}

      {!result && (
        <Card style={{ maxWidth: 720 }}>
          <div style={{ maxWidth: 320, marginBottom: 14 }}>
            <Field label={`Who is this about? · optional`}>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Not about anyone in particular</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onDrop(f);
            }}
            style={{
              border: `2px dashed ${dragging ? C.blue : C.border}`,
              borderRadius: 10,
              background: dragging ? C.blueSoft : 'transparent',
              padding: 3,
              transition: 'border-color .15s, background .15s',
            }}
          >
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={12}
              placeholder={
                'Paste a transcript or type your notes here.\n\nOr drop a .txt file onto this box.\n\nExample: "Spoke to Dana about the deck. She wants it stained before the 14th, and asked about replacing two boards at the north end. Quoted roughly $800 for the extra boards, she\'ll confirm Friday."'
              }
              style={{
                ...inputStyle,
                border: 'none',
                background: 'transparent',
                minHeight: 220,
                resize: 'vertical',
                lineHeight: 1.65,
                fontSize: 13.5,
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <Button onClick={read} disabled={busy || raw.trim().length < 40}>
              {busy ? 'Reading…' : 'Read this'}
            </Button>
            <span style={{ fontSize: 12, color: C.faint }}>
              About a cent, paid once. Opening it again later is free.
            </span>
          </div>
        </Card>
      )}

      {result && (
        <Card style={{ maxWidth: 720 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 4 }}>
            <SectionLabel>Check this before it&apos;s saved</SectionLabel>
            {cost != null && (
              <span style={{ fontSize: 11.5, color: C.faint }}>Cost {cost.toFixed(2)}¢</span>
            )}
          </div>

          <input
            value={result.title}
            onChange={(e) => setResult({ ...result, title: e.target.value })}
            style={{ ...inputStyle, fontSize: 15.5, fontWeight: 600, marginBottom: 12 }}
          />

          <div style={{ fontSize: 11.5, color: C.dim, fontWeight: 600, marginBottom: 5 }}>Summary</div>
          <textarea
            value={result.summary}
            onChange={(e) => setResult({ ...result, summary: e.target.value })}
            rows={4}
            style={{ ...inputStyle, lineHeight: 1.6, resize: 'vertical', marginBottom: 16 }}
          />

          {result.uncertain.length > 0 && (
            <div
              style={{
                background: C.amberSoft,
                border: `1px solid ${C.amber}44`,
                borderRadius: 8,
                padding: '11px 13px',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, marginBottom: 5 }}>
                Not sure about these
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: C.dim, lineHeight: 1.7 }}>
                {result.uncertain.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            </div>
          )}

          {result.tasks.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, color: C.dim, fontWeight: 600, marginBottom: 6 }}>
                Agreed ({result.tasks.length})
              </div>
              {result.tasks.map((t, i) => (
                <div key={i} style={{ fontSize: 13.5, color: C.text, padding: '5px 0', lineHeight: 1.5 }}>
                  · {t.what}
                  {t.who && <span style={{ color: C.faint }}> — {t.who}</span>}
                  {t.due && <span style={{ marginLeft: 8 }}><Pill tone="amber">by {t.due}</Pill></span>}
                </div>
              ))}
            </div>
          )}

          {result.amounts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, color: C.dim, fontWeight: 600, marginBottom: 6 }}>
                Money mentioned
              </div>
              {result.amounts.map((a, i) => (
                <div key={i} style={{ fontSize: 13.5, color: C.text, padding: '4px 0' }}>
                  ${a.amount.toLocaleString()} — <span style={{ color: C.dim }}>{a.what}</span>
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6, lineHeight: 1.55 }}>
                Recorded as part of the note, not as a quote. Numbers said out loud in a
                conversation aren&apos;t an estimate until you make one.
              </div>
            </div>
          )}

          {result.people.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11.5, color: C.dim, fontWeight: 600, marginBottom: 6 }}>
                People mentioned
              </div>
              {result.people.map((p, i) => (
                <div key={i} style={{ fontSize: 13.5, color: C.text, padding: '4px 0' }}>
                  {p.name}
                  {p.role && <span style={{ color: C.faint }}>, {p.role}</span>}
                  {(p.email || p.phone) && (
                    <span style={{ color: C.dim }}> — {[p.email, p.phone].filter(Boolean).join(' · ')}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save this note'}
            </Button>
            <Button variant="ghost" onClick={() => setResult(null)}>Back to the text</Button>
          </div>
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
            The original text is kept underneath the summary. A summary is a convenience; if
            anyone ever disputes what was agreed, the original is the record.
          </div>
        </Card>
      )}

      <div style={{ marginTop: 30 }}>
        <SectionLabel>Saved notes</SectionLabel>
        {loading ? (
          <Card><Empty>Loading…</Empty></Card>
        ) : notes.length === 0 ? (
          <Card>
            <Empty>
              Nothing yet. Anything you paste above ends up here, filed against the{' '}
              {vocab.customer.toLowerCase()} it&apos;s about.
            </Empty>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.map((n) => {
              const who = customers.find((c) => c.id === n.customer_id)?.name;
              return (
                <Card key={n.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>
                        {n.title || 'Note'}
                      </div>
                      <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>
                        {who ? `${who} · ` : ''}{shortDate(n.happened_on || n.created_at)}
                      </div>
                    </div>
                    {n.source === 'transcript' && <Pill tone="blue">From a transcript</Pill>}
                  </div>
                  <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>
                    {n.body.split('— — —')[0].trim().slice(0, 400)}
                    {n.body.length > 400 ? '…' : ''}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Page>
  );
}
