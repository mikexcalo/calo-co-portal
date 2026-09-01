'use client';

/**
 * Case studies.
 *
 * Their own module rather than a kind of pitch, for one reason: lifecycle. A
 * pitch is written for one prospect, sent once, and finished whether it wins
 * or loses. A case study is written once and reused for years, across pitches,
 * the website, and a proposal nobody has thought of yet. Nest the durable
 * thing inside the disposable one and reuse becomes copying, and copies drift
 * until three versions of the same story disagree about the results.
 *
 * Two things are enforced here rather than suggested, and both come from the
 * same discipline the brand framework already applies to proof:
 *
 *   Every number is a row with a source, not a phrase inside a paragraph. A
 *   claim buried in prose cannot be counted; an unsourced row can.
 *
 *   Publishing is the moment a claim goes in front of a stranger, so the
 *   unsourced ones are named at exactly that moment rather than in a checklist
 *   nobody opens.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
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
} from '@/components/spine/ui';

interface Claim {
  id: string;
  claim: string;
  source: string | null;
  dated: string | null;
  status: 'sourced' | 'estimated' | 'unsourced';
}

interface Story {
  id: string;
  client: string;
  title: string;
  summary: string | null;
  sector: string | null;
  year: string | null;
  roles: string[];
  situation: string | null;
  approach: string | null;
  execution: string | null;
  enablement: string | null;
  outcome: string | null;
  status: 'draft' | 'ready' | 'published';
  public_token: string | null;
}

/**
 * The five movements, in the order a reader needs them.
 *
 * Named fields rather than free sections because the shape is the useful part.
 * Every story answers the same five questions in the same order, which makes a
 * blank one a visible gap instead of a section somebody quietly dropped.
 */
const MOVEMENTS = [
  { key: 'situation',  label: 'The situation', ask: 'What was wrong, in their words rather than yours.' },
  { key: 'approach',   label: 'The approach',  ask: 'The decision you made. Usually one structural move.' },
  { key: 'execution',  label: 'What shipped',  ask: 'How it reached the world.' },
  { key: 'enablement', label: 'What the team got', ask: 'The tools that made it stick after you left.' },
  { key: 'outcome',    label: 'What happened', ask: 'The results. Numbers belong in claims below, with sources.' },
] as const;

const CLAIM_TONE = { sourced: 'green', estimated: 'amber', unsourced: 'red' } as const;

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [claims, setClaims] = useState<Record<string, Claim[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Story>>({});
  const [busy, setBusy] = useState(false);
  const [newClaim, setNewClaim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([
      supabase.from('case_studies').select('*').order('created_at', { ascending: false }),
      supabase.from('case_study_claims').select('*').order('created_at'),
    ]);
    if (s.data) setStories(s.data as Story[]);
    if (c.data) {
      const byCase: Record<string, Claim[]> = {};
      for (const row of c.data as Array<Claim & { case_id: string }>) {
        (byCase[row.case_id] ??= []).push(row);
      }
      setClaims(byCase);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (id: string) => {
    setBusy(true);
    setError(null);
    const res = await supabase.from('case_studies').update(draft).eq('id', id);
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setOpen(null);
    load();
  };

  const setStatus = async (s: Story, status: Story['status']) => {
    setBusy(true);
    const res = await supabase.from('case_studies').update({ status }).eq('id', s.id);
    setBusy(false);
    if (!res.error) load();
  };

  const addClaim = async (s: Story) => {
    if (!newClaim.trim()) return;
    const org = await supabase.rpc('current_org_id');
    const res = await supabase.from('case_study_claims').insert({
      org_id: org.data,
      case_id: s.id,
      claim: newClaim.trim(),
      // Always unsourced on arrival. Sourcing is a thing somebody does, not a
      // default, and the database refuses 'sourced' without a source anyway.
      status: 'unsourced',
    });
    if (!res.error) { setNewClaim(''); load(); }
  };

  const sourceClaim = async (c: Claim, source: string) => {
    const value = source.trim();
    const res = await supabase
      .from('case_study_claims')
      .update({ source: value || null, status: value ? 'sourced' : 'unsourced' })
      .eq('id', c.id);
    if (!res.error) load();
  };

  const unsourcedCount = useMemo(
    () => Object.values(claims).flat().filter((c) => c.status !== 'sourced').length,
    [claims]
  );

  if (loading) return <Page title="Case studies"><Card><Empty>Loading…</Empty></Card></Page>;

  return (
    <Page
      title="Case studies"
      subtitle="Written once, used for years. A pitch cites these; it does not contain them."
    >
      {unsourcedCount > 0 && (
        <Card style={{ marginBottom: 22, borderColor: C.amber, background: C.amberSoft }}>
          <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>
            {unsourcedCount} {unsourcedCount === 1 ? 'claim has' : 'claims have'} no source
          </div>
          <p style={{ fontSize: 13, color: C.dim, margin: '6px 0 0', lineHeight: 1.6, maxWidth: 620 }}>
            A results sentence is the one a prospect repeats back to you in a meeting. If nobody
            can say where the number came from, it is a gap dressed as a result, and this is the
            most expensive place to have one. <strong style={{ color: C.text }}>Unsourced claims
            do not appear on the published page.</strong> That is enforced in the database rather
            than by this screen, so it holds even if somebody rewrites this screen.
          </p>
        </Card>
      )}

      {stories.length === 0 ? (
        <Card><Empty>Nothing yet.</Empty></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stories.map((s) => {
            const isOpen = open === s.id;
            const mine = claims[s.id] ?? [];
            const gaps = MOVEMENTS.filter((m) => !((s[m.key] as string | null) ?? '').trim());

            return (
              <Card key={s.id}>
                <div
                  onClick={() => { setOpen(isOpen ? null : s.id); setDraft(isOpen ? {} : s); }}
                  style={{ cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{s.client}</span>
                  <span style={{ fontSize: 15, color: C.dim }}>{s.title}</span>
                  <Pill tone={s.status === 'published' ? 'green' : s.status === 'ready' ? 'blue' : 'neutral'}>
                    {s.status}
                  </Pill>
                  {gaps.length > 0 && (
                    <span style={{ fontSize: 12.5, color: C.amber }}>
                      {gaps.length} section{gaps.length === 1 ? '' : 's'} empty
                    </span>
                  )}
                  <span style={{ fontSize: 12.5, color: C.faint, marginLeft: 'auto' }}>
                    {(s.roles ?? []).join(' · ')}
                  </span>
                </div>

                {!isOpen && s.summary && (
                  <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.6, margin: '10px 0 0', maxWidth: 680 }}>
                    {s.summary}
                  </p>
                )}

                {isOpen && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                      <Field label="Client">
                        <input
                          value={draft.client ?? ''}
                          onChange={(e) => setDraft({ ...draft, client: e.target.value })}
                          style={inputStyle}
                        />
                      </Field>
                      <Field label="Title">
                        <input
                          value={draft.title ?? ''}
                          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                          style={inputStyle}
                        />
                      </Field>
                      <Field label="Sector">
                        <input
                          value={draft.sector ?? ''}
                          onChange={(e) => setDraft({ ...draft, sector: e.target.value })}
                          style={inputStyle}
                        />
                      </Field>
                      <Field label="Year">
                        <input
                          value={draft.year ?? ''}
                          onChange={(e) => setDraft({ ...draft, year: e.target.value })}
                          placeholder="2019"
                          style={inputStyle}
                        />
                      </Field>
                    </div>

                    <Field label="One line">
                      <input
                        value={draft.summary ?? ''}
                        onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                        style={inputStyle}
                      />
                    </Field>

                    {MOVEMENTS.map((m) => (
                      <Field key={m.key} label={m.label}>
                        <textarea
                          value={(draft[m.key] as string | null) ?? ''}
                          onChange={(e) => setDraft({ ...draft, [m.key]: e.target.value })}
                          rows={4}
                          placeholder={m.ask}
                          style={{ ...inputStyle, lineHeight: 1.65, resize: 'vertical' }}
                        />
                      </Field>
                    ))}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                      <Button onClick={() => save(s.id)} disabled={busy}>
                        {busy ? 'Saving…' : 'Save'}
                      </Button>
                      {(['draft', 'ready', 'published'] as const).map((st) => (
                        <Button
                          key={st}
                          variant="ghost"
                          onClick={() => setStatus(s, st)}
                          disabled={busy || s.status === st}
                        >
                          Mark {st}
                        </Button>
                      ))}
                    </div>

                    {s.status === 'published' && s.public_token && (
                      <div style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>
                        Live at{' '}
                        <code style={{ fontFamily: 'ui-monospace, monospace' }}>
                          /s/{s.public_token}
                        </code>
                        . Unpublishing revokes the link rather than hiding the page.
                      </div>
                    )}

                    {/* --- claims --- */}
                    <SectionLabel>Claims ({mine.length})</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      {mine.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            border: `1px solid ${c.status === 'sourced' ? C.border : `${C.amber}55`}`,
                            background: c.status === 'sourced' ? 'transparent' : C.amberSoft,
                            borderRadius: 8,
                            padding: '11px 13px',
                          }}
                        >
                          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <Pill tone={CLAIM_TONE[c.status]}>{c.status}</Pill>
                            <span style={{ fontSize: 14, color: C.text, flex: 1, minWidth: 200 }}>
                              {c.claim}
                            </span>
                          </div>
                          <input
                            defaultValue={c.source ?? ''}
                            onBlur={(e) => sourceClaim(c, e.target.value)}
                            placeholder="Where did this come from? Leave blank if you cannot say."
                            style={{ ...inputStyle, fontSize: 13, padding: '6px 9px', marginTop: 8 }}
                          />
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        value={newClaim}
                        onChange={(e) => setNewClaim(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addClaim(s); }}
                        placeholder="Add a claim this story makes"
                        style={{ ...inputStyle, flex: '1 1 260px' }}
                      />
                      <Button variant="ghost" onClick={() => addClaim(s)} disabled={!newClaim.trim()}>
                        Add
                      </Button>
                    </div>
                  </div>
                )}

                {error && isOpen && (
                  <div style={{ fontSize: 13, color: C.red, marginTop: 10 }}>{error}</div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
