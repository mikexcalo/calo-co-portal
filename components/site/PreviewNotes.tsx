'use client';

/**
 * A note button on every section of a preview.
 *
 * Feedback used to come back as "the second bit reads oddly", and somebody had
 * to work out which section that was. Attaching the note to the block it is
 * about is the whole feature: the comment and its subject arrive together.
 *
 * Sits quietly until you hover the section, because a page covered in comment
 * buttons is a page nobody can judge the design of, and judging the design is
 * what the client opened the link to do.
 */

import { useState } from 'react';

export function PreviewNotes({
  token,
  sectionId,
  label,
}: {
  token: string;
  sectionId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/preview/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sectionId, author, body }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not send that.'); return; }
      setDone(true);
      setBody('');
      setTimeout(() => { setDone(false); setOpen(false); }, 2200);
    } catch {
      setError('Could not reach the site.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="note-anchor">
      {!open ? (
        <button className="note-btn" onClick={() => setOpen(true)}>
          Comment on {label.toLowerCase()}
        </button>
      ) : (
        <div className="note-box">
          {done ? (
            <div className="note-done">Sent. Thank you.</div>
          ) : (
            <>
              <div className="note-head">{label}</div>
              <input
                className="note-input"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name"
              />
              <textarea
                className="note-input note-area"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What would you change?"
                rows={4}
                autoFocus
              />
              {error && <div className="note-error">{error}</div>}
              <div className="note-actions">
                <button className="note-send" onClick={send} disabled={busy || !body.trim()}>
                  {busy ? 'Sending…' : 'Send'}
                </button>
                <button className="note-cancel" onClick={() => { setOpen(false); setError(null); }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
