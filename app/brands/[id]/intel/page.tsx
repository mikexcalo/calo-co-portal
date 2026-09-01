'use client';

/**
 * Drop what you know. Get a framework back.
 *
 * The slow part of this work has never been the thinking, it is the first
 * pass: turning two hours of somebody talking into ten fields with a shape.
 * You paste the call, a reader proposes content for whatever the material
 * actually supports, and you spend your time editing rather than transcribing.
 *
 * NOTHING IS SAVED WITHOUT YOU ACCEPTING IT. Every proposal arrives marked
 * with how sure the reader was and the line it rests on, and you take them one
 * at a time. This is not politeness. A fluent paragraph about a company's
 * positioning is the most plausible-sounding wrong thing this could produce,
 * and the framework's own argument is that what reads well is what ships by
 * accident.
 *
 * The raw drop is kept either way. When somebody asks in a year why the
 * positioning says what it says, the answer should be a dated call where the
 * founder said it, not whoever remembers hardest.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { reconcile, type BrandModule } from '@/lib/spine/framework';
import { buildDrops, readImage, sortFiles, type DropFile } from '@/lib/spine/intel';
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

interface Intel {
  id: string;
  kind: string;
  title: string | null;
  body: string;
  source: string | null;
  image_path: string | null;
  read_at: string | null;
  cost_cents: number | null;
  created_at: string;
}

interface Proposal {
  id: string;
  content: string;
  confidence: 'stated' | 'implied' | 'inferred';
  basis: string;
}

interface Read {
  modules: Proposal[];
  proof: Array<{ kind: string; body: string; attribution?: string | null; source?: string | null }>;
  banned: Array<{ term: string; reason: string }>;
  voice: string[];
  missing: string[];
  costCents?: number;
}

const CONF_TONE = { stated: 'green', implied: 'amber', inferred: 'red' } as const;
const CONF_MEANS = {
  stated: 'They said this in as many words',
  implied: 'Follows closely from what they said',
  inferred: 'Read between the lines. Check this one first',
};

const KINDS = [
  { id: 'transcript', label: 'Call transcript' },
  { id: 'note', label: 'Notes' },
  { id: 'email', label: 'Email' },
  { id: 'site', label: 'Their website copy' },
  { id: 'doc', label: 'Document' },
];

export default function IntelPage({ params }: { params: { id: string } }) {
  const [brand, setBrand] = useState<{ id: string; name: string; messaging: BrandModule[] } | null>(null);
  const [drops, setDrops] = useState<Intel[]>([]);
  const [loading, setLoading] = useState(true);

  const [body, setBody] = useState('');
  const [source, setSource] = useState('');
  const [kind, setKind] = useState('transcript');
  const [files, setFiles] = useState<DropFile[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [reading, setReading] = useState<string | null>(null);
  const [result, setResult] = useState<Read | null>(null);
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [b, i] = await Promise.all([
      supabase.from('brands').select('id, name, messaging').eq('id', params.id).maybeSingle(),
      supabase.from('brand_intel').select('*').eq('brand_id', params.id).order('created_at', { ascending: false }),
    ]);
    if (b.data) {
      // Reconcile on read, so a brand created before a module existed still
      // shows the current framework without anybody migrating anything.
      setBrand({
        id: b.data.id,
        name: b.data.name,
        messaging: reconcile((b.data.messaging ?? []) as BrandModule[]),
      });
    }
    if (i.data) setDrops(i.data as Intel[]);
    setLoading(false);
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!brand) return;
    if (body.trim().length < 40 && files.length === 0) return;
    setSaving(true);
    setError(null);
    setRejected([]);

    const org = await supabase.rpc('current_org_id');
    const { drops, failed } = await buildDrops(supabase, brand.id, {
      text: body,
      kind,
      source,
      files,
    });

    if (drops.length) {
      const res = await supabase
        .from('brand_intel')
        .insert(drops.map((d) => ({ ...d, org_id: org.data, brand_id: brand.id })));
      if (res.error) { setError(res.error.message); setSaving(false); return; }
    }

    setSaving(false);
    if (failed.length) setRejected(failed);
    setBody('');
    setSource('');
    setFiles([]);
    load();
  };

  const read = async (drop: Intel) => {
    if (!brand) return;
    setReading(drop.id);
    setResult(null);
    setTaken(new Set());
    setError(null);
    try {
      /**
       * A photographed drop is fetched back out of private storage and sent
       * as an image. Signed for this request only, never a stored URL.
       */
      let images: Array<{ media_type: string; data: string }> = [];
      if (drop.image_path) {
        const signed = await supabase.storage
          .from('client-assets')
          .createSignedUrl(drop.image_path, 120);
        if (!signed.data?.signedUrl) {
          setError('Could not open that file.');
          setReading(null);
          return;
        }
        const blob = await (await fetch(signed.data.signedUrl)).blob();
        images = [await readImage(new File([blob], 'page', { type: blob.type }))];
      }

      const res = await fetch('/api/brands/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: drop.body,
          images,
          brand: brand.name,
          existing: brand.messaging
            .filter((m) => m.content?.trim())
            .map((m) => ({ id: m.id, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not read that.'); setReading(null); return; }
      setResult(data as Read);
      await supabase
        .from('brand_intel')
        .update({ read_at: new Date().toISOString(), cost_cents: data.costCents ?? null })
        .eq('id', drop.id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
    setReading(null);
  };

  /**
   * Accepting writes the content and marks where it came from, but never sets
   * the state past open. A proposal you have read once is not a decision, and
   * locking is the moment somebody commits.
   */
  const accept = async (p: Proposal) => {
    if (!brand) return;
    const next = brand.messaging.map((m) =>
      m.id === p.id ? { ...m, content: p.content, source: `Read from intel · ${p.confidence}` } : m
    );
    const res = await supabase.from('brands').update({ messaging: next }).eq('id', brand.id);
    if (!res.error) {
      setBrand({ ...brand, messaging: next });
      setTaken((t) => new Set(t).add(p.id));
    }
  };

  const acceptProof = async (item: Read['proof'][number], key: string) => {
    if (!brand) return;
    const org = await supabase.rpc('current_org_id');
    const res = await supabase.from('brand_proof').insert({
      org_id: org.data,
      brand_id: brand.id,
      kind: item.kind,
      body: item.body,
      attribution: item.attribution ?? null,
      source: item.source ?? null,
      // Never real on arrival. Real needs written permission on file, and the
      // database will refuse it anyway.
      status: 'placeholder',
    });
    if (!res.error) setTaken((t) => new Set(t).add(key));
  };

  const acceptBanned = async (r: { term: string; reason: string }, key: string) => {
    if (!brand) return;
    const cur = await supabase.from('brands').select('guardrails').eq('id', brand.id).single();
    const g = (cur.data?.guardrails ?? { say: [], never: [] }) as { say?: string[]; never?: Array<{ term: string; reason?: string }> };
    if ((g.never ?? []).some((x) => x.term.toLowerCase() === r.term.toLowerCase())) {
      setTaken((t) => new Set(t).add(key));
      return;
    }
    const res = await supabase
      .from('brands')
      .update({ guardrails: { ...g, never: [...(g.never ?? []), r] } })
      .eq('id', brand.id);
    if (!res.error) setTaken((t) => new Set(t).add(key));
  };

  const tabs = [
    { label: 'Framework', href: `/brands/${params.id}/messaging` },
    { label: 'Intel', href: `/brands/${params.id}/intel` },
  ];

  if (loading) return <Page title="Intel" tabs={tabs}><Card><Empty>Loading…</Empty></Card></Page>;
  if (!brand) return <Page title="Intel" tabs={tabs}><Card><Empty>Not found.</Empty></Card></Page>;

  const nameOf = (id: string) => brand.messaging.find((m) => m.id === id)?.name ?? id;

  return (
    <Page
      back={{ label: brand.name, href: `/brands/${brand.id}` }}
      title="Intel"
      subtitle="Drop what you learn. A reader proposes the framework from it. You decide what sticks."
      tabs={tabs}
    >
      {/* The drop box, first. This is what the page is for. */}
      <Card>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Paste a call transcript, your notes, an email they sent, or the copy off their current site."
          style={{ ...inputStyle, lineHeight: 1.6, resize: 'vertical', marginBottom: 12 }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          <Field label="What is it">
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
              {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </Field>
          <Field label="Where it came from">
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Frank, kickoff call"
              style={inputStyle}
            />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <label
            style={{
              fontSize: 12.5,
              color: C.blue,
              cursor: 'pointer',
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '7px 12px',
            }}
          >
            Add photos or files
            <input
              type="file"
              multiple
              accept="image/*,text/*,.md,.vtt,.srt,.csv"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                const { usable, rejected: no } = sortFiles(picked);
                setFiles((f) => [...f, ...usable]);
                setRejected(no);
              }}
              style={{ display: 'none' }}
            />
          </label>
          <span style={{ fontSize: 12, color: C.faint }}>
            Photograph a page of handwriting or a whiteboard. It reads them.
          </span>
        </div>

        {files.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
            {files.map((f, i) => (
              <span
                key={`${f.file.name}-${i}`}
                style={{
                  fontSize: 11.5,
                  color: C.dim,
                  background: C.panelAlt,
                  borderRadius: 6,
                  padding: '4px 9px',
                }}
              >
                {f.file.name}
                <button
                  onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: C.faint,
                    cursor: 'pointer',
                    marginLeft: 6,
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                  aria-label={`Remove ${f.file.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button onClick={save} disabled={saving || (body.trim().length < 40 && files.length === 0)}>
            {saving ? 'Saving…' : 'Keep it'}
          </Button>
          <span style={{ fontSize: 12, color: C.faint }}>
            Kept as dropped. Reading it is the next step, and a separate one.
          </span>
        </div>
        {rejected.map((r) => (
          <div key={r} style={{ fontSize: 12.5, color: C.amber, marginTop: 8 }}>{r}</div>
        ))}
        {error && <div style={{ fontSize: 12.5, color: C.red, marginTop: 10 }}>{error}</div>}
      </Card>

      {/* ---------------------------------------------------------------- */}
      {result && (
        <div style={{ marginTop: 26 }}>
          <SectionLabel>
            Proposed ({result.modules.length} modules, {result.proof.length} proof, {result.banned.length} rules)
          </SectionLabel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.modules.map((p) => {
              const done = taken.has(p.id);
              return (
                <Card key={p.id}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{nameOf(p.id)}</span>
                    <Pill tone={CONF_TONE[p.confidence]}>{p.confidence}</Pill>
                    <span style={{ fontSize: 11.5, color: C.faint }}>{CONF_MEANS[p.confidence]}</span>
                  </div>

                  <div style={{ fontSize: 14, color: C.text, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {p.content}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: C.faint,
                      marginTop: 10,
                      paddingLeft: 11,
                      borderLeft: `2px solid ${C.border}`,
                      lineHeight: 1.55,
                    }}
                  >
                    {p.basis}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <Button onClick={() => accept(p)} disabled={done} variant={done ? 'ghost' : 'primary'}>
                      {done ? 'Added' : 'Use this'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {result.missing.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <SectionLabel>Ask them next</SectionLabel>
              <Card>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: C.dim, lineHeight: 1.75 }}>
                  {result.missing.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
                <p style={{ fontSize: 11.5, color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
                  What this material does not answer. This is the agenda for the next call, and it
                  is usually worth more than the modules above.
                </p>
              </Card>
            </div>
          )}

          {result.proof.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <SectionLabel>Proof found</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.proof.map((p, i) => {
                  const key = `proof:${i}`;
                  const done = taken.has(key);
                  return (
                    <Card key={key}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>{p.body}</div>
                          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>
                            {[p.kind, p.attribution, p.source].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <Button onClick={() => acceptProof(p, key)} disabled={done} variant="ghost">
                          {done ? 'Added' : 'Keep as placeholder'}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
              <p style={{ fontSize: 11.5, color: C.faint, marginTop: 8, lineHeight: 1.6 }}>
                Everything found this way is a placeholder until somebody clears it. Real needs an
                attribution and written permission on file.
              </p>
            </div>
          )}

          {result.banned.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <SectionLabel>Rules they gave you</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.banned.map((r, i) => {
                  const key = `banned:${i}`;
                  const done = taken.has(key);
                  return (
                    <Card key={key}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 12.5, fontWeight: 600, color: C.red, background: C.redSoft,
                            padding: '3px 9px', borderRadius: 6, whiteSpace: 'nowrap',
                          }}
                        >
                          {r.term}
                        </span>
                        <span style={{ fontSize: 12.5, color: C.dim, flex: 1, minWidth: 180 }}>{r.reason}</span>
                        <Button onClick={() => acceptBanned(r, key)} disabled={done} variant="ghost">
                          {done ? 'Added' : 'Add to never list'}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {result.voice.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <SectionLabel>How they talk</SectionLabel>
              <Card>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {result.voice.map((v, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 12.5, color: C.dim, background: C.panelAlt,
                        padding: '4px 10px', borderRadius: 6,
                      }}
                    >
                      {v}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: 11.5, color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
                  Their own words, pulled straight through. Raw material for tone, which is worth
                  more than any description of a voice.
                </p>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      <div style={{ marginTop: 30 }}>
        <SectionLabel>Everything dropped ({drops.length})</SectionLabel>
        {drops.length === 0 ? (
          <Card><Empty>Nothing yet. Paste a call or a page of notes above.</Empty></Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {drops.map((d) => (
              <Card key={d.id}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>
                        {d.source || KINDS.find((k) => k.id === d.kind)?.label || d.kind}
                      </span>
                      {d.read_at ? <Pill tone="green">read</Pill> : <Pill>not read</Pill>}
                      <span style={{ fontSize: 11.5, color: C.faint }}>
                        {shortDate(d.created_at)} ·{' '}
                        {d.image_path
                          ? 'photograph'
                          : `${Math.round(d.body.length / 1000)}k characters`}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12.5, color: C.faint, marginTop: 6, lineHeight: 1.55,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {d.image_path
                        ? d.title ?? 'A photographed page. Read it to see what is on it.'
                        : d.body.slice(0, 300)}
                    </div>
                  </div>
                  <Button
                    onClick={() => read(d)}
                    disabled={reading !== null}
                    variant={d.read_at ? 'ghost' : 'primary'}
                  >
                    {reading === d.id ? 'Reading…' : d.read_at ? 'Read again' : 'Read it'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
