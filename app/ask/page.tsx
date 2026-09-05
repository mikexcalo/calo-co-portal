'use client';

/**
 * Ask, in a sentence.
 *
 * The screens are all still there. This is for the moment you know what you
 * want and not which screen has it, which is most moments for somebody who
 * uses this twice a week rather than daily.
 *
 * The suggested questions are the real list, not examples of a wider
 * capability. Showing exactly what it answers is more useful than implying it
 * answers anything, and clicking one costs nothing because an exact match
 * skips the model entirely.
 */

import { useState } from 'react';
import { QUESTIONS } from '@/lib/spine/questions';
import { Button, C, Card, Page, inputStyle } from '@/components/spine/ui';

export default function AskPage() {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (question: string) => {
    if (question.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    setSuggestions(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not answer that.'); }
      else if (data.answer) { setAnswer(data.answer); setAsked(data.question); }
      else { setSuggestions(data.suggestions ?? []); }
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <Page title="Ask" subtitle="A question about your own numbers, answered from what is logged.">
      <Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ask(q); }}
            placeholder="Who owes me money?"
            autoFocus
            style={{ ...inputStyle, flex: '1 1 280px', fontSize: 15 }}
          />
          <Button onClick={() => ask(q)} disabled={busy || q.trim().length < 3}>
            {busy ? 'Looking…' : 'Ask'}
          </Button>
        </div>

        {answer && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 8 }}>{asked}</div>
            <div style={{ fontSize: 15.5, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {answer}
            </div>
          </div>
        )}

        {suggestions && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 14, color: C.dim, marginBottom: 10 }}>
              That one is not covered yet. These are:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQ(s); ask(s); }}
                  style={{
                    textAlign: 'left', border: 'none', background: 'none', padding: 0,
                    fontSize: 14, color: C.blue, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ fontSize: 13.5, color: C.red, marginTop: 12 }}>{error}</div>}
      </Card>

      {!answer && !suggestions && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 10 }}>
            What it can answer today
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUESTIONS.map((x) => (
              <button
                key={x.id}
                onClick={() => { setQ(x.example); ask(x.example); }}
                style={{
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  borderRadius: 999,
                  padding: '7px 14px',
                  fontSize: 13.5,
                  color: C.dim,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {x.example}
              </button>
            ))}
          </div>
        </div>
      )}
    </Page>
  );
}
