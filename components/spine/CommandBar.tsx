'use client';

/**
 * One input for everything.
 *
 * The pattern every good tool has converged on, and it is worth naming why
 * rather than copying the shape. Linear, Notion, Attio and Stripe all put a
 * single field behind one key, and in all of them the model is a result type
 * rather than a destination. You never "go to the AI". You type what is in
 * your head and the software works out whether that was a place, a record, or
 * a question.
 *
 * That is the difference between an AI-native product and a wrapper. A wrapper
 * makes you visit the chat. This makes the chat unnecessary most of the time,
 * because most of what somebody types is a name, and a name should never cost
 * a model call or a second of latency.
 *
 * SO THE ORDER OF WORK IS DELIBERATE
 *
 *   1. Match locally against everything already loaded. Instant, free, and
 *      covers the overwhelming majority of what gets typed.
 *   2. Only when the query reads like a question, and only when the person
 *      presses enter on it, ask the model which question it was.
 *
 * Nothing here fires a request while you type. A palette that calls a model on
 * every keystroke is how a feature that costs a tenth of a cent becomes a
 * feature that costs a hundred dollars a month.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { C, useIsPhone } from './ui';

interface Item {
  id: string;
  label: string;
  hint?: string;
  href: string;
  group: string;
  /** A color swatch, for brand palette hits. */
  swatch?: string;
  /** Copied instead of navigated to, when the useful thing is the value. */
  copy?: string;
}

const NAV: Item[] = [
  { id: 'n-today', label: 'Home', href: '/', group: 'Go to' },
  { id: 'n-jobs', label: 'Engagements', href: '/jobs', group: 'Go to' },
  { id: 'n-clients', label: 'Clients', href: '/customers', group: 'Go to' },
  { id: 'n-people', label: 'People', href: '/people', group: 'Go to' },
  { id: 'n-access', label: 'Access — who is on what', href: '/access', group: 'Go to' },
  { id: 'n-digital', label: 'Digital', href: '/digital', group: 'Go to' },
  { id: 'n-traffic', label: 'Traffic and analytics', href: '/traffic', group: 'Go to' },
  { id: 'n-notes', label: 'Notes', href: '/notes', group: 'Go to' },
  { id: 'n-receipts', label: 'Receipts', href: '/documents', group: 'Go to' },
  { id: 'n-invoices', label: 'Invoices', href: '/billing', group: 'Go to' },
  { id: 'n-pl', label: 'Profit and Loss', href: '/pl', group: 'Go to' },
  { id: 'n-overheads', label: 'Overheads', href: '/expenses', group: 'Go to' },
  { id: 'n-pitches', label: 'Pitches', href: '/pitches', group: 'Go to' },
  { id: 'n-framework', label: 'Brand Framework', href: '/framework', group: 'Go to' },
  { id: 'n-stories', label: 'Case Studies', href: '/stories', group: 'Go to' },
  { id: 'n-brandkit', label: 'Brand Kit', href: '/brand-kit', group: 'Go to' },
  { id: 'n-business', label: 'Business settings', href: '/business', group: 'Go to' },
];

/** Reads like a question, so offering to answer it is worth the keystroke. */
const looksLikeQuestion = (q: string) =>
  /\?$/.test(q.trim()) ||
  /^(who|what|what's|whats|how|how's|when|which|where|why|do i|am i|are there|is there|show me|list)\b/i.test(q.trim());

export function CommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const phone = useIsPhone();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /**
   * Loaded once, on first open.
   *
   * These are small tables for any business this serves, so holding them in
   * memory makes every keystroke instant. If somebody ever has ten thousand
   * clients this becomes a server-side search, and that is a good problem.
   */
  const load = useCallback(async () => {
    const [cust, jobs, brands, stories, people, notes] = await Promise.all([
      supabase.from('customers').select('id, name, email, stage, tags').limit(500),
      supabase.from('jobs').select('id, name, status').limit(500),
      supabase.from('brands').select('id, name, kit').limit(100),
      supabase.from('case_studies').select('id, client, title').limit(200),
      /**
       * People, which were not indexed at all.
       *
       * Typing a person's name is the most common thing anybody does in a CRM
       * and it returned nothing, because this searched companies, engagements,
       * brands and case studies and no humans. Somebody looking for Luis had
       * to remember which company he belonged to first, which is backwards:
       * the person is the thing you remember and the company is what you are
       * trying to look up.
       */
      supabase
        .from('customer_contacts')
        .select('id, name, title, email, customer_id, customers(name)')
        .limit(500),
      // Notes, by their first line. The body is what holds the answer to
      // "what did they say about pricing", and none of it was findable.
      supabase
        .from('customer_notes')
        .select('id, body, happened_on, customer_id, customers(name)')
        .order('happened_on', { ascending: false })
        .limit(300),
    ]);

    const next: Item[] = [...NAV];

    for (const c of cust.data ?? []) {
      // Tags in the hint, so typing "Connecticut" or "seafood" finds every
      // company carrying it without going near a filter screen.
      const tags = ((c as { tags?: string[] | null }).tags ?? []).join(' · ');
      next.push({
        id: `c-${c.id}`,
        label: c.name,
        hint: [c.stage, c.email, tags].filter(Boolean).join(' · '),
        href: `/customers/${c.id}`,
        group: 'Clients',
      });
    }
    /**
     * The embedded company comes back as an array.
     *
     * PostgREST types a joined relation as a list even when the foreign key
     * guarantees one row, so this reads the first rather than casting past the
     * type and finding undefined at runtime.
     */
    const firstName = (rel: { name: string }[] | { name: string } | null) =>
      Array.isArray(rel) ? rel[0]?.name : rel?.name;

    for (const p of (people.data ?? []) as Array<{
      id: string; name: string; title: string | null; email: string | null;
      customer_id: string | null; customers: { name: string }[] | null;
    }>) {
      next.push({
        id: `p-${p.id}`,
        label: p.name,
        hint: [p.title, firstName(p.customers), p.email].filter(Boolean).join(' · ') || 'Person',
        href: p.customer_id ? `/customers/${p.customer_id}` : '/people',
        group: 'People',
      });
    }

    for (const n of (notes.data ?? []) as Array<{
      id: string; body: string; happened_on: string | null;
      customer_id: string | null; customers: { name: string }[] | null;
    }>) {
      // The first line is the title the reader gave it; the rest is the hint,
      // so a search for a word buried in the body still matches the item.
      const [first, ...rest] = n.body.split('\n');
      next.push({
        id: `n-${n.id}`,
        label: first.slice(0, 90) || 'Note',
        hint: [firstName(n.customers), n.happened_on, rest.join(' ').slice(0, 160)].filter(Boolean).join(' · '),
        href: n.customer_id ? `/customers/${n.customer_id}?tab=history` : '/notes',
        group: 'Notes',
      });
    }

    for (const j of jobs.data ?? []) {
      next.push({ id: `j-${j.id}`, label: j.name, hint: j.status, href: `/jobs/${j.id}`, group: 'Engagements' });
    }
    for (const b of brands.data ?? []) {
      next.push({ id: `b-${b.id}`, label: b.name, hint: 'Brand kit', href: `/brands/${b.id}`, group: 'Brands' });

      /**
       * Colors indexed individually, by name and by role.
       *
       * "What is Colette's CTA button color" is a real question with a real
       * answer sitting in the kit, and routing it through a model to find a
       * hex code would be absurd. Typing cta finds it, and the hit copies the
       * value rather than navigating, because the value is the answer.
       */
      const kit = (b.kit ?? {}) as { colors?: Array<{ name: string; hex: string; role?: string }>; fonts?: Array<{ family: string; role?: string }> };
      for (const col of kit.colors ?? []) {
        next.push({
          id: `col-${b.id}-${col.hex}`,
          label: `${col.name} · ${col.hex}`,
          hint: [b.name, col.role].filter(Boolean).join(' · '),
          href: `/brands/${b.id}`,
          group: 'Brand colors',
          swatch: col.hex,
          copy: col.hex,
        });
      }
      for (const f of kit.fonts ?? []) {
        next.push({
          id: `f-${b.id}-${f.family}`,
          label: f.family,
          hint: [b.name, f.role].filter(Boolean).join(' · '),
          href: `/brands/${b.id}`,
          group: 'Typefaces',
        });
      }
    }
    for (const s of stories.data ?? []) {
      next.push({ id: `s-${s.id}`, label: `${s.client}: ${s.title}`, href: '/stories', group: 'Case studies' });
    }

    setItems(next);
  }, []);

  useEffect(() => {
    if (open) {
      if (items.length === 0) load();
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setQ('');
      setAnswer(null);
      setAnswerError(null);
      setCursor(0);
    }
  }, [open, items.length, load]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items.filter((i) => i.group === 'Go to').slice(0, 7);

    const scored = items
      .map((i) => {
        const hay = `${i.label} ${i.hint ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return null;
        // A match at the start of the label beats one buried in a hint.
        const rank = i.label.toLowerCase().startsWith(needle) ? 0 : i.label.toLowerCase().includes(needle) ? 1 : 2;
        return { item: i, rank };
      })
      .filter(Boolean) as Array<{ item: Item; rank: number }>;

    return scored.sort((a, b) => a.rank - b.rank).slice(0, 9).map((s) => s.item);
  }, [q, items]);

  const canAsk = looksLikeQuestion(q) && q.trim().length > 5;
  const rows = canAsk ? results.length + 1 : results.length;

  const runAsk = async () => {
    setAsking(true);
    setAnswer(null);
    setAnswerError(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const text = await res.text();
      let data: { answer?: string; error?: string; suggestions?: string[] } = {};
      // Parsed defensively: an empty body here used to surface as an
      // unreadable JSON error with no explanation of what failed.
      try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }

      if (data.answer) setAnswer(data.answer);
      else if (data.error) setAnswerError(data.error);
      else if (data.suggestions?.length) {
        setAnswerError(`Not something it can work out yet. Try: ${data.suggestions.slice(0, 3).join(', ')}`);
      } else setAnswerError('No answer came back.');
    } catch (e) {
      setAnswerError((e as Error).message);
    }
    setAsking(false);
  };

  const choose = (i: Item) => {
    if (i.copy) {
      navigator.clipboard?.writeText(i.copy);
      setOpen(false);
      return;
    }
    setOpen(false);
    router.push(i.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, rows - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canAsk && cursor === results.length) runAsk();
      else if (results[cursor]) choose(results[cursor]);
    }
  };

  let lastGroup = '';

  return (
    <>
      {/* The affordance, so this is discoverable without knowing the shortcut,
          and reachable on a phone where there is no shortcut at all. */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Search"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          border: `1px solid ${C.border}`, background: C.panel,
          borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
          color: C.faint, fontFamily: 'inherit', fontSize: 13.5,
          // On a phone the label and the shortcut are both dead weight: there
          // is no keyboard to press and no room for the words.
          minWidth: phone ? 0 : 190,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="7.2" cy="7.2" r="4.6" /><path d="M10.6 10.6 13.6 13.6" />
        </svg>
        {!phone && <span>Search or ask</span>}
        {!phone && <span style={{ marginLeft: 'auto', fontSize: 11.5, color: C.faint }}>⌘K</span>}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(20,22,26,.34)',
            zIndex: 200, display: 'flex', alignItems: 'flex-start',
            justifyContent: 'center', padding: '12vh 16px 16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 620, background: C.panel,
              border: `1px solid ${C.border}`, borderRadius: 12,
              boxShadow: '0 24px 60px rgba(20,22,26,.22)', overflow: 'hidden',
            }}
          >
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setCursor(0); setAnswer(null); setAnswerError(null); }}
              onKeyDown={onKeyDown}
              placeholder="Search clients, jobs, colors. Or ask a question."
              style={{
                width: '100%', border: 'none', outline: 'none',
                padding: '16px 18px', fontSize: 16, color: C.text,
                fontFamily: 'inherit', background: 'transparent',
              }}
            />

            {(results.length > 0 || canAsk) && (
              <div style={{ borderTop: `1px solid ${C.border}`, maxHeight: '54vh', overflowY: 'auto' }}>
                {results.map((i, idx) => {
                  const header = i.group !== lastGroup ? i.group : null;
                  lastGroup = i.group;
                  return (
                    <div key={i.id}>
                      {header && (
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.09em', color: C.faint, fontWeight: 600, padding: '10px 18px 4px' }}>
                          {header}
                        </div>
                      )}
                      <div
                        onMouseEnter={() => setCursor(idx)}
                        onClick={() => choose(i)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 18px', cursor: 'pointer',
                          background: cursor === idx ? C.accentSoft : 'transparent',
                        }}
                      >
                        {i.swatch && (
                          <span style={{ width: 16, height: 16, borderRadius: 4, background: i.swatch, border: `1px solid ${C.border}`, flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: 14.5, color: C.text }}>{i.label}</span>
                        {i.hint && <span style={{ fontSize: 12.5, color: C.faint }}>{i.hint}</span>}
                        {i.copy && <span style={{ fontSize: 11.5, color: C.faint, marginLeft: 'auto' }}>copy</span>}
                      </div>
                    </div>
                  );
                })}

                {/* The model, offered as one more result rather than as a mode
                    you switch into. */}
                {canAsk && (
                  <div
                    onMouseEnter={() => setCursor(results.length)}
                    onClick={runAsk}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '11px 18px', cursor: 'pointer',
                      borderTop: results.length ? `1px solid ${C.border}` : 'none',
                      background: cursor === results.length ? C.accentSoft : 'transparent',
                    }}
                  >
                    <span style={{ fontSize: 14.5, color: C.blue }}>
                      {asking ? 'Working it out…' : `Answer “${q.trim()}”`}
                    </span>
                    <span style={{ fontSize: 11.5, color: C.faint, marginLeft: 'auto' }}>from your data</span>
                  </div>
                )}
              </div>
            )}

            {(answer || answerError) && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 18px' }}>
                <div style={{ fontSize: 14.5, color: answerError ? C.dim : C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {answer ?? answerError}
                </div>
              </div>
            )}

            {q && results.length === 0 && !canAsk && !answer && !answerError && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 18px', fontSize: 14, color: C.faint }}>
                Nothing matches. End with a question mark to have it worked out from your data.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
