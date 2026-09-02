'use client';

/**
 * The questions you asked, and what came back.
 *
 * These were seven thousand characters of prose inside a document, which can
 * only be read from the top. An answer is not a paragraph in a file: it is a
 * question somebody asked, about a subject, that informs a decision. Kept that
 * way it can be filtered, quoted, and pointed at from the module it feeds.
 *
 * Flagged is the useful column and it means one of two things: the answer
 * changes what you would do, or it is thin and needs asking again. Both are
 * reasons to come back, which is the only reason to mark anything.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { FRAMEWORK } from '@/lib/spine/framework';
import { useRouter } from 'next/navigation';
import { Button, C, Card, Pill, SectionLabel } from './ui';

interface Draft {
  name: string;
  summary: string;
  lines: Array<{ description: string; qty: number; unit?: string | null; optional: boolean; basis: string }>;
  scope_in: string[];
  scope_out: string[];
  ask_first: string[];
  rate: number | null;
}

interface Row {
  id: string;
  subject: string | null;
  question: string;
  answer: string | null;
  informs: string | null;
  flagged: boolean;
  note: string | null;
  position: number;
}

export function Discovery({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  /** Answers picked for a proposal. Nothing is selected until you pick it. */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [brandId, setBrandId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>('all');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  /**
   * Open by default.
   *
   * These are the learned information. Folding them to three flagged lines
   * meant opening a client and being told there were eleven answers somewhere,
   * which is the same as not having them.
   */
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    const res = await supabase
      .from('discovery')
      .select('id, subject, question, answer, informs, flagged, note, position')
      .eq('customer_id', customerId)
      .order('position');
    if (!res.error) setRows((res.data ?? []) as Row[]);

    // The brand is where a finding lands when it feeds a framework module.
    const b = await supabase.from('brands').select('id').eq('customer_id', customerId).maybeSingle();
    setBrandId(b.data?.id ?? null);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const flag = async (r: Row) => {
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, flagged: !x.flagged } : x)));
    await supabase.from('discovery').update({ flagged: !r.flagged }).eq('id', r.id);
  };

  /**
   * A finding written into the module it feeds.
   *
   * Free, deterministic, and appended rather than overwritten: an answer is
   * evidence for a module, not a replacement for what somebody already decided
   * about it. Marked as unchecked so it reads as raw material until a person
   * has shaped it.
   */
  const useForModule = async (r: Row) => {
    if (!brandId || !r.informs || !r.answer) return;
    setBusy(r.id);
    setError(null);

    const b = await supabase.from('brands').select('messaging').eq('id', brandId).maybeSingle();
    const modules = (b.data?.messaging ?? []) as Array<{ id: string; content: string; source?: string }>;
    const next = modules.map((m) =>
      m.id === r.informs
        ? {
            ...m,
            content: [m.content?.trim(), r.answer].filter(Boolean).join('\n\n'),
            source: 'From what they told you, unchecked',
          }
        : m
    );

    const res = await supabase.from('brands').update({ messaging: next }).eq('id', brandId);
    setBusy(null);
    if (res.error) { setError(res.error.message); return; }
    setDone((d) => ({ ...d, [r.id]: `Added to ${moduleName(r.informs)}` }));
  };

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  /**
   * The draft becomes a real engagement and a real proposal.
   *
   * This is the part that makes the whole section worth having. Everything up
   * to here is still storage; this produces a thing with a link you can send,
   * which the client accepts by name.
   *
   * Saved as a draft, never sent. A proposal that goes out because somebody
   * clicked once is a proposal nobody read.
   */
  const acceptDraft = async () => {
    if (!draft) return;
    setBusy('save');
    setError(null);
    try {
      const org = await supabase.rpc('current_org_id');
      const job = await supabase
        .from('jobs')
        .insert({
          org_id: org.data,
          customer_id: customerId,
          name: draft.name,
          billing_type: draft.rate ? 'tm' : 'fixed',
          labor_rate: draft.rate,
          status: 'estimating',
          description: draft.summary,
        })
        .select('id')
        .single();
      if (job.error) throw new Error(job.error.message);

      const est = await supabase
        .from('estimates')
        .insert({
          org_id: org.data,
          job_id: job.data.id,
          version: 1,
          total: 0,
          status: 'draft',
          notes: draft.summary,
          scope_in: draft.scope_in,
          scope_out: draft.scope_out,
        })
        .select('id')
        .single();
      if (est.error) throw new Error(est.error.message);

      const lines = draft.lines.map((l, i) => ({
        estimate_id: est.data.id,
        kind: 'labor',
        description: l.description,
        qty: l.qty,
        unit: l.unit ?? (draft.rate ? 'hr' : null),
        // No rate on file means no invented prices. The lines and the shape are
        // the useful output; the money is a decision you make.
        unit_price: draft.rate ?? 0,
        total: draft.rate ? Math.round(l.qty * draft.rate * 100) / 100 : 0,
        optional: l.optional,
        position: i + 1,
      }));
      const ins = await supabase.from('estimate_lines').insert(lines);
      if (ins.error) throw new Error(ins.error.message);

      router.push(`/jobs/${job.data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const draftProposal = async () => {
    setBusy('draft');
    setError(null);
    try {
      const res = await fetch('/api/proposals/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, ids: Array.from(picked) }),
      });
      const text = await res.text();
      let data: Draft & { error?: string } = {} as Draft;
      try { data = text ? JSON.parse(text) : ({} as Draft); } catch { /* handled below */ }
      if (!res.ok || !data.lines) { setError(data.error ?? 'Could not draft that.'); }
      else setDraft(data);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  };

  const subjects = useMemo(
    () => Array.from(new Set(rows.map((r) => r.subject).filter(Boolean))) as string[],
    [rows]
  );

  const shown = rows.filter(
    (r) => (subject === 'all' || r.subject === subject) && (!onlyFlagged || r.flagged)
  );

  if (rows.length === 0) return null;

  const moduleName = (id: string | null) =>
    id ? FRAMEWORK.find((m) => m.id === id)?.name ?? id : null;

  const flaggedCount = rows.filter((r) => r.flagged).length;

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span style={{ fontSize: 10, color: C.faint }}>{open ? '▼' : '▶'}</span>
          <SectionLabel>What they gave you</SectionLabel>
        </button>
        <span style={{ fontSize: 12.5, color: flaggedCount > 0 ? C.amber : C.faint }}>
          {rows.length} answers{flaggedCount > 0 ? `, ${flaggedCount} worth revisiting` : ''}
        </span>
      </div>

      {!open ? (
        /* Folded to the flagged ones, because those are the reason to open it. */
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {rows.filter((r) => r.flagged).slice(0, 3).map((r) => (
              <div key={r.id} style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.55 }}>
                <span style={{ color: C.text }}>{r.subject}</span> · {r.note ?? r.question}
              </div>
            ))}
            <button
              onClick={() => setOpen(true)}
              style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', fontSize: 12.5, color: C.blue, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Read all {rows.length}
            </button>
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {['all', ...subjects].map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                style={{
                  border: `1px solid ${subject === s ? C.accent : C.border}`,
                  background: subject === s ? C.accentSoft : 'transparent',
                  color: subject === s ? C.text : C.dim,
                  borderRadius: 20, padding: '5px 12px', fontSize: 12.5,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {s === 'all' ? 'Everything' : s}
              </button>
            ))}
            {picked.size > 0 && (
              <Button onClick={draftProposal} disabled={busy === 'draft'}>
                {busy === 'draft' ? 'Drafting…' : `Draft a proposal from ${picked.size}`}
              </Button>
            )}
            <button
              onClick={() => setOnlyFlagged((v) => !v)}
              style={{
                border: `1px solid ${onlyFlagged ? C.amber : C.border}`,
                background: onlyFlagged ? C.amberSoft : 'transparent',
                color: onlyFlagged ? C.text : C.dim,
                borderRadius: 20, padding: '5px 12px', fontSize: 12.5,
                cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto',
              }}
            >
              Flagged only
            </button>
          </div>

          {draft && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{draft.name}</div>
              <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.6, margin: '6px 0 14px', maxWidth: 660 }}>
                {draft.summary}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                {draft.lines.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, color: C.text, flex: 1, minWidth: 200 }}>
                      {l.description}
                    </span>
                    {l.optional && <Pill tone="neutral">optional</Pill>}
                    {draft.rate ? (
                      <span style={{ fontSize: 13.5, color: C.dim, fontVariantNumeric: 'tabular-nums' }}>
                        {l.qty} hr
                      </span>
                    ) : (
                      <span style={{ fontSize: 12.5, color: C.faint }}>price it yourself</span>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: C.faint, fontWeight: 600, marginBottom: 6 }}>
                    Covers
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 17, fontSize: 13, color: C.dim, lineHeight: 1.65 }}>
                    {draft.scope_in.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: C.faint, fontWeight: 600, marginBottom: 6 }}>
                    Does not
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 17, fontSize: 13, color: C.dim, lineHeight: 1.65 }}>
                    {draft.scope_out.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
              </div>

              {draft.ask_first.length > 0 && (
                <div style={{ fontSize: 13, color: C.amber, marginBottom: 14, lineHeight: 1.6 }}>
                  Worth knowing first: {draft.ask_first.join('. ')}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button onClick={acceptDraft} disabled={busy === 'save'}>
                  {busy === 'save' ? 'Creating…' : 'Make it a proposal'}
                </Button>
                <Button variant="ghost" onClick={() => setDraft(null)}>Discard</Button>
                <span style={{ fontSize: 12.5, color: C.faint }}>
                  Saved as a draft you edit and send. Nothing goes out from here.
                </span>
              </div>
            </Card>
          )}

          {error && (
            <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{error}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shown.map((r) => (
              <Card key={r.id}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
                  {/* Picked for a proposal. Nothing is selected by default,
                      because a proposal built from everything they ever said
                      is not a proposal. */}
                  <input
                    type="checkbox"
                    checked={picked.has(r.id)}
                    onChange={() => toggle(r.id)}
                    style={{ width: 15, height: 15, accentColor: C.accent, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 11.5, color: C.faint }}>{r.subject}</span>
                  {r.informs && <Pill tone="blue">{moduleName(r.informs)}</Pill>}
                  <button
                    onClick={() => flag(r)}
                    style={{
                      marginLeft: 'auto', border: 'none', background: 'none', padding: 0,
                      fontSize: 12, color: r.flagged ? C.amber : C.faint,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {r.flagged ? 'flagged' : 'flag it'}
                  </button>
                </div>

                <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5, marginBottom: 7 }}>
                  {r.question}
                </div>

                {r.answer && (
                  <div
                    style={{
                      fontSize: 13.5, color: C.dim, lineHeight: 1.7,
                      paddingLeft: 12, borderLeft: `2px solid ${C.border}`, maxWidth: 680,
                    }}
                  >
                    {r.answer}
                  </div>
                )}

                {/* Yours, not theirs. What the answer means rather than what it said. */}
                {r.note && (
                  <div style={{ fontSize: 13, color: C.blue, marginTop: 8, lineHeight: 1.6, maxWidth: 660 }}>
                    {r.note}
                  </div>
                )}

                {/*
                  The next move.
                  
                  A finding that ends without one is decoration. This is the
                  whole point of the section: an answer about what people did
                  before you existed is brand idea material, and it should take
                  one click to become brand idea material.
                */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                  {done[r.id] ? (
                    <span style={{ fontSize: 12.5, color: C.green }}>{done[r.id]}</span>
                  ) : (
                    r.informs && r.answer && brandId && (
                      <button
                        onClick={() => useForModule(r)}
                        disabled={busy === r.id}
                        style={{
                          border: 'none', background: 'none', padding: 0, fontSize: 12.5,
                          color: C.blue, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {busy === r.id ? 'Adding…' : `Use it for ${moduleName(r.informs)}`}
                      </button>
                    )
                  )}
                  {!picked.has(r.id) && (
                    <button
                      onClick={() => toggle(r.id)}
                      style={{
                        border: 'none', background: 'none', padding: 0, fontSize: 12.5,
                        color: C.faint, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Put it in a proposal
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
