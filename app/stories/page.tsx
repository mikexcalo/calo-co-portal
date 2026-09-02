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
  BRAND_TABS,
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

interface Draft {
  title: string;
  summary: string;
  sector?: string | null;
  roles: string[];
  situation: string;
  approach: string;
  execution: string;
  enablement: string;
  outcome: string;
  claims: Array<{ claim: string; where_from: string }>;
  missing: string[];
  client: string;
}

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [claims, setClaims] = useState<Record<string, Claim[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Story>>({});
  const [busy, setBusy] = useState(false);
  const [newClaim, setNewClaim] = useState('');
  const [sourceDefault, setSourceDefault] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Clients with enough on file to write about. */
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [drafting, setDrafting] = useState(false);
  const [proposed, setProposed] = useState<Draft | null>(null);

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
    const list = await supabase.from('customers').select('id, name').order('name');
    if (list.data) setClients(list.data as Array<{ id: string; name: string }>);

    setLoading(false);
  }, []);

  /**
   * Draft from what is already recorded.
   *
   * The framework, the discovery answers and the engagement all describe the
   * same piece of work from different angles. Writing a case study is mostly
   * assembling them, which is an afternoon nobody has, which is why agencies
   * with good work have thin portfolios.
   */
  const draftFrom = async (customerId: string) => {
    setDrafting(true);
    setError(null);
    setProposed(null);
    try {
      const res = await fetch('/api/stories/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
      const text = await res.text();
      let data: Draft & { error?: string } = {} as Draft;
      try { data = text ? JSON.parse(text) : ({} as Draft); } catch { /* handled below */ }
      if (!res.ok || !data.situation) setError(data.error ?? 'Could not draft that.');
      else setProposed(data);
    } catch (e) {
      setError((e as Error).message);
    }
    setDrafting(false);
  };

  /**
   * Saved as a draft, with every claim unsourced.
   *
   * The database refuses to publish an unsourced claim, so the worst outcome of
   * a generous draft is a case study that cannot reach a customer until
   * somebody stands behind the numbers. That is the right worst case.
   */
  const keepDraft = async (customerId: string) => {
    if (!proposed) return;
    setBusy(true);
    const org = await supabase.rpc('current_org_id');
    const cs = await supabase
      .from('case_studies')
      .insert({
        org_id: org.data,
        customer_id: customerId,
        client: proposed.client,
        title: proposed.title,
        summary: proposed.summary,
        sector: proposed.sector ?? null,
        roles: proposed.roles,
        situation: proposed.situation,
        approach: proposed.approach,
        execution: proposed.execution,
        enablement: proposed.enablement || null,
        outcome: proposed.outcome || null,
        status: 'draft',
      })
      .select('id')
      .single();

    if (!cs.error && proposed.claims.length) {
      await supabase.from('case_study_claims').insert(
        proposed.claims.map((c) => ({
          org_id: org.data,
          case_id: cs.data.id,
          claim: c.claim,
          status: 'unsourced',
          source: null,
        }))
      );
    }
    setBusy(false);
    setProposed(null);
    load();
  };

  useEffect(() => { load(); }, [load]);

  // Whoever is signed in is the default attribution on anything they add.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const p = await supabase.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle();
      setSourceDefault(p.data?.full_name || data.user.email || 'Recorded internally');
    });
  }, []);

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
      /**
       * You are the source until you say otherwise.
       *
       * Defaulting to unsourced treated your own numbers as suspect, which is
       * backwards: you ran the work. The field is still here for the cases
       * where a client or a report is the better attribution, and you can
       * overwrite it in place.
       */
      source: sourceDefault,
      status: 'sourced',
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
      tabs={BRAND_TABS}
      title="Case studies"
      subtitle="Your past work, written up once so you can reuse it in pitches and on the site."
    >
      {unsourcedCount > 0 && (
        <div style={{ fontSize: 13.5, color: C.dim, marginBottom: 18 }}>
          {unsourcedCount} {unsourcedCount === 1 ? 'claim needs' : 'claims need'} a source before
          {unsourcedCount === 1 ? ' it shows' : ' they show'} on a published page.
        </div>
      )}

      {/*
        Draft one from work already recorded.
        
        The framework, the discovery answers and the engagement describe the
        same work from three angles. Assembling them is the afternoon nobody
        has, which is why agencies with good work have thin portfolios.
      */}
      {clients.length > 0 && !proposed && (
        <Card style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 13.5, color: C.dim, marginBottom: 10, maxWidth: 620, lineHeight: 1.6 }}>
            Write one from what is already on file. It uses their framework, what they told you,
            and the engagement, and it will refuse if there is not enough to work from.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {clients.map((cl) => (
              <Button key={cl.id} variant="ghost" onClick={() => draftFrom(cl.id)} disabled={drafting}>
                {drafting ? 'Writing…' : cl.name}
              </Button>
            ))}
          </div>
          {error && <div style={{ fontSize: 13, color: C.red, marginTop: 10 }}>{error}</div>}
        </Card>
      )}

      {proposed && (
        <Card style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, color: C.faint }}>{proposed.client}</div>
          <div style={{ fontSize: 19, fontWeight: 600, color: C.text, marginTop: 2 }}>{proposed.title}</div>
          <p style={{ fontSize: 14.5, color: C.dim, lineHeight: 1.6, margin: '8px 0 16px', maxWidth: 660 }}>
            {proposed.summary}
          </p>

          {([
            ['The situation', proposed.situation],
            ['The approach', proposed.approach],
            ['What shipped', proposed.execution],
            ['What the team got', proposed.enablement],
            ['What happened', proposed.outcome],
          ] as const).map(([label, body]) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: C.faint, fontWeight: 600, marginBottom: 4 }}>
                {label}
              </div>
              {body?.trim() ? (
                <p style={{ fontSize: 14, color: C.text, lineHeight: 1.65, margin: 0, maxWidth: 680 }}>{body}</p>
              ) : (
                /* An empty movement is the honest answer more often than not,
                   and saying so beats filling it. */
                <p style={{ fontSize: 13.5, color: C.amber, margin: 0 }}>
                  Nothing on file for this. Left empty rather than invented.
                </p>
              )}
            </div>
          ))}

          {proposed.claims.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: C.faint, fontWeight: 600, marginBottom: 6 }}>
                Numbers it found
              </div>
              {proposed.claims.map((c, i) => (
                <div key={i} style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.6, marginBottom: 4 }}>
                  {c.claim} <span style={{ color: C.faint }}>({c.where_from})</span>
                </div>
              ))}
            </div>
          )}

          {proposed.missing.length > 0 && (
            <div style={{ fontSize: 13, color: C.amber, marginBottom: 14, lineHeight: 1.6, maxWidth: 640 }}>
              Before it can be published: {proposed.missing.join('. ')}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              onClick={() => {
                const match = clients.find((cl) => cl.name === proposed.client);
                if (match) keepDraft(match.id);
              }}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Keep it as a draft'}
            </Button>
            <Button variant="ghost" onClick={() => setProposed(null)}>Discard</Button>
            <span style={{ fontSize: 12.5, color: C.faint }}>
              Every number saves as unsourced, and unsourced cannot be published.
            </span>
          </div>
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
