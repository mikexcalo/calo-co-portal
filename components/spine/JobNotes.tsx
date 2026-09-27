'use client';

/**
 * What has been said about this job, and the ones nobody has read yet.
 *
 * The job screen showed hours, costs, invoices, estimates and documents, and
 * not one note - so a note written from the job's own action bar landed
 * somewhere the job could not see. That was survivable while every note went
 * through the reader and surfaced on the customer's history. It stopped being
 * survivable the moment notes could be saved unread: a note with no summary,
 * filed against a job that does not list notes, is a note nobody will find
 * again.
 *
 * An unsorted note is shown as what it is - the words, whole - with the offer
 * to sort it. Not an error, not a warning. The text is safe; it simply has no
 * summary yet, and that is a thing that can be fixed later rather than a
 * thing that went wrong.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { human, READ_FAILED } from '@/lib/spine/errors';
import { save as saveOrFail } from '@/lib/spine/save';
import { Button, C, Card, Empty, SectionLabel, radius } from './ui';

interface Note {
  id: string;
  title: string | null;
  body: string;
  happened_on: string;
  sorted_at: string | null;
}

export function JobNotes({
  jobId,
  customerId,
  refresh = 0,
}: {
  jobId: string;
  customerId: string | null;
  /**
   * Bumped by whatever just wrote a note, so this list goes and looks again.
   *
   * The action bar's own reload refreshes the job, which re-renders this but
   * does not re-run its effect - the effect is keyed on the job id and the
   * job id did not change. The visible result was a note saved into the
   * database and a list underneath it that still said two.
   */
  refresh?: number;
}) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await supabase
      .from('customer_notes')
      .select('id, title, body, happened_on, sorted_at')
      .eq('job_id', jobId)
      .order('happened_on', { ascending: false })
      .limit(30);
    if (res.error) { setError(human(res.error.message, READ_FAILED)); return; }
    setNotes((res.data ?? []) as Note[]);
  }, [jobId, refresh]);

  useEffect(() => { void load(); }, [load]);

  /* Sorting one that was saved unread. The same route the sheet uses, so
     there is one reader and one idea of what reading means. */
  const sortIt = async (n: Note) => {
    setBusy(n.id);
    setError(null);
    try {
      const res = await fetch('/api/notes/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: n.body }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'The reader could not take it.'); return; }
      const read = (json.extracted ?? json) as { title?: string; summary?: string };
      if (!read?.title && !read?.summary) {
        setError('The reader came back with nothing usable. The note is unchanged.');
        return;
      }
      const up = await saveOrFail(
        supabase
          .from('customer_notes')
          .update({
            title: read.title ?? null,
            body: `${read.title ?? ''}\n\n${read.summary ?? ''}\n\n---\n${n.body}`.trim(),
            sorted_at: new Date().toISOString(),
          })
          .eq('id', n.id),
        'Sorting the note'
      );
      if (!up.error) await load();
    } catch {
      setError('Could not reach the reader. The note is unchanged.');
    } finally {
      setBusy(null);
    }
  };

  if (notes !== null && notes.length === 0 && !error) return null;

  return (
    <div style={{ marginTop: 26 }}>
      <SectionLabel>Notes{notes ? ` (${notes.length})` : ''}</SectionLabel>
      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 10 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}
      {notes === null ? (
        <Card><div className="skel" style={{ height: 44, borderRadius: radius.md }} /></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map((n) => (
            <Card key={n.id}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  {n.title && (
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text, marginBottom: 3 }}>
                      {n.title}
                    </div>
                  )}
                  <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {n.body}
                  </div>
                  <div style={{ fontSize: 12, color: C.faint, marginTop: 6 }}>
                    {new Date(n.happened_on).toLocaleDateString(undefined, {
                      day: 'numeric', month: 'long',
                    })}
                    {!n.sorted_at && ' · Not sorted yet'}
                  </div>
                </div>
                {!n.sorted_at && (
                  <Button variant="ghost" disabled={busy === n.id} onClick={() => sortIt(n)}>
                    {busy === n.id ? 'Sorting…' : 'Sort it'}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
