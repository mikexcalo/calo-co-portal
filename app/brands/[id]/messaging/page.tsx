'use client';

/**
 * The brand and messaging platform, per brand.
 *
 * Ten modules in the order the decisions have to be made, because each is an
 * input to the next. Positioning cannot be written before the audience is
 * defined; identity cannot start before the pillars are locked.
 *
 * Two things here are enforced rather than described, and they are the reason
 * this is data and not a document:
 *
 *   Proof carries a status, and nothing tagged placeholder or gap is safe to
 *   publish. A placeholder is dangerous precisely because it reads well.
 *
 *   Guardrails carry reasons and can be run against real copy. A working name
 *   reached this client's live homepage once already, and the framework is
 *   right that a check finds that where a reviewer does not.
 *
 * Everything else is judgement, and judgement stays with the person writing.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { checkCopy, shortSentencePairs, type Violation } from '@/lib/spine/guardrails';
import { reconcile, type BrandModule } from '@/lib/spine/framework';
import {
  Button,
  C,
  Card,
  Empty,
  Page,
  Pill,
  SectionLabel,
  inputStyle,
  brandTabs,
} from '@/components/spine/ui';

interface Proof {
  id: string;
  kind: string;
  body: string;
  attribution: string | null;
  source: string | null;
  status: 'real' | 'placeholder' | 'gap';
  permission_on_file: boolean;
}

interface Brand {
  id: string;
  name: string;
  messaging: BrandModule[];
  guardrails: { say?: string[]; never?: Array<{ term: string; reason?: string }> };
}

const STATE_TONE = { locked: 'green', testing: 'amber', open: 'neutral' } as const;
const PROOF_TONE = { real: 'green', placeholder: 'amber', gap: 'red' } as const;
const PROOF_MEANS = {
  real: 'Verified, permissioned, safe to publish',
  placeholder: 'Written by us to show the shape. Never ships',
  gap: 'We want this and do not have it yet',
};

export default function MessagingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [proof, setProof] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [checkText, setCheckText] = useState('');
  const [violations, setViolations] = useState<Violation[] | null>(null);
  const [rhythm, setRhythm] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [b, p] = await Promise.all([
      supabase.from('brands').select('id, name, messaging, guardrails').eq('id', params.id).maybeSingle(),
      supabase.from('brand_proof').select('*').eq('brand_id', params.id).order('status'),
    ]);
    if (b.data) {
      const row = b.data as unknown as Brand;
      // Brought up to the current framework on read. Written content always
      // wins, so improving the standard never overwrites a decision.
      setBrand({ ...row, messaging: reconcile(row.messaging ?? []) });
    }
    if (p.data) setProof(p.data as Proof[]);
    setLoading(false);
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const saveModule = async (id: string, content: string, state?: BrandModule['state']) => {
    if (!brand) return;
    setBusy(true);
    const next = brand.messaging.map((m) => {
      if (m.id !== id) return m;
      /**
       * Touching the words makes it yours.
       *
       * A proposal you have read, edited and saved is no longer a proposal,
       * and leaving the label on would train people to ignore it. The label
       * only means something while it still marks unchecked work.
       */
      const stillProposed = m.source && content.trim() === m.content?.trim();
      return {
        ...m,
        content,
        state: state ?? m.state,
        source: stillProposed ? m.source : undefined,
      };
    });
    const res = await supabase.from('brands').update({ messaging: next }).eq('id', brand.id);
    setBusy(false);
    if (!res.error) {
      setBrand({ ...brand, messaging: next });
      setOpen(null);
    }
  };

  const run = () => {
    const rules = brand?.guardrails?.never ?? [];
    setViolations(checkCopy(checkText, rules, ['em_dash', 'unsourced_number', 'weasel']));
    setRhythm(shortSentencePairs(checkText));
  };

  const tabs = brandTabs(params.id);

  if (loading) return <Page title="Framework" tabs={tabs}><Card><Empty>Loading…</Empty></Card></Page>;
  if (!brand) return <Page title="Framework" tabs={tabs}><Card><Empty>Not found.</Empty></Card></Page>;

  const modules = brand.messaging ?? [];
  const locked = modules.filter((m) => m.state === 'locked').length;
  const notCleared = proof.filter((p) => p.status !== 'real').length;

  return (
    <Page
      back={{ label: brand.name, href: `/brands/${brand.id}` }}
      title="Brand and messaging"
      subtitle="Ten modules, in the order the decisions have to be made. Each one is an input to the next."
      tabs={tabs}
      action={
        <>
          <Button onClick={() => router.push(`/brands/${brand.id}/intel`)}>Drop intel</Button>
          <Button variant="ghost" onClick={() => router.push(`/brands/${brand.id}`)}>Brand kit</Button>
        </>
      }
    >
      {/* The two things the framework can actually enforce, stated up front. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 26,
        }}
      >
        <Card>
          <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.08em', color: C.faint, fontWeight: 600 }}>
            Locked
          </div>
          <div style={{ fontSize: 21, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {locked} <span style={{ fontSize: 14, color: C.faint }}>of {modules.length}</span>
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.08em', color: C.faint, fontWeight: 600 }}>
            Proof not cleared
          </div>
          <div style={{ fontSize: 21, marginTop: 4, color: notCleared ? C.red : C.text, fontVariantNumeric: 'tabular-nums' }}>
            {notCleared}
          </div>
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>Cannot go in front of a customer</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.08em', color: C.faint, fontWeight: 600 }}>
            Banned terms
          </div>
          <div style={{ fontSize: 21, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {(brand.guardrails?.never ?? []).length}
          </div>
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>Checked below, not memorized</div>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div style={{ marginBottom: 30 }}>
        <SectionLabel>Check some copy</SectionLabel>
        <Card>
          <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.65, margin: '0 0 12px', maxWidth: 620 }}>
            Paste a headline, a paragraph, or a whole page. It runs against this brand&apos;s own
            banned list. Free and instant, so it can run on every draft rather than the ones
            somebody remembers to check.
          </p>
          <textarea
            value={checkText}
            onChange={(e) => setCheckText(e.target.value)}
            rows={5}
            placeholder="Paste the copy here."
            style={{ ...inputStyle, lineHeight: 1.6, resize: 'vertical', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button onClick={run} disabled={checkText.trim().length < 3}>Check it</Button>
            {violations !== null && (
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: violations.length ? C.red : C.green,
                }}
              >
                {violations.length === 0
                  ? 'Clean against every rule'
                  : `${violations.length} ${violations.length === 1 ? 'problem' : 'problems'}`}
              </span>
            )}
          </div>

          {violations && violations.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
              {violations.map((v, i) => (
                <div
                  key={i}
                  style={{
                    border: `1px solid ${C.red}33`,
                    background: C.redSoft,
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.red }}>{v.term}</div>
                  {v.reason && (
                    <div style={{ fontSize: 13.5, color: C.dim, marginTop: 2 }}>{v.reason}</div>
                  )}
                  <div
                    style={{
                      fontSize: 13,
                      color: C.faint,
                      marginTop: 6,
                      fontFamily: 'ui-monospace, monospace',
                    }}
                  >
                    {v.context}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* A judgement call, reported as one. */}
          {rhythm.length > 0 && (
            <div
              style={{
                marginTop: 12,
                border: `1px solid ${C.amber}44`,
                background: C.amberSoft,
                borderRadius: 8,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>
                Two short sentences back to back, {rhythm.length}×
              </div>
              <div style={{ fontSize: 13, color: C.dim, marginTop: 4, lineHeight: 1.6 }}>
                {rhythm.slice(0, 3).map((r, i) => <div key={i}>{r}</div>)}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      <SectionLabel>The ten modules</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 30 }}>
        {modules.map((m, i) => {
          const isOpen = open === m.id;
          return (
            <Card key={m.id}>
              <div
                onClick={() => {
                  setOpen(isOpen ? null : m.id);
                  setDraft(m.content);
                }}
                style={{ cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}
              >
                <span
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 12.5,
                    color: C.faint,
                    letterSpacing: '.08em',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 16.5, fontWeight: 600, color: C.text }}>{m.name}</span>
                <Pill tone={STATE_TONE[m.state]}>{m.state}</Pill>
                {m.source && <Pill tone="blue">proposed</Pill>}
                <span style={{ fontSize: 12.5, color: C.faint, marginLeft: 'auto' }}>{m.note}</span>
              </div>

              {!isOpen && m.content && (
                <p
                  style={{
                    fontSize: 14.5,
                    color: C.dim,
                    lineHeight: 1.6,
                    margin: '10px 0 0',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.content.split('\n')[0]}
                </p>
              )}

              {isOpen && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.65, marginBottom: 12 }}>
                    <strong style={{ color: C.text }}>What it does. </strong>{m.job}
                  </div>

                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={7}
                    style={{ ...inputStyle, lineHeight: 1.65, resize: 'vertical', marginBottom: 10 }}
                  />

                  {m.source && (
                    <div style={{ fontSize: 13, color: C.blue, marginBottom: 10, lineHeight: 1.55 }}>
                      {m.source}. Nobody has checked it against what was actually said yet.
                    </div>
                  )}

                  {m.state === 'locked' && (
                    <div style={{ fontSize: 13, color: C.amber, marginBottom: 10, lineHeight: 1.55 }}>
                      This module is locked. Most drift comes from quietly rewriting a locked line
                      while editing something else, so changing it is a decision rather than an edit.
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    <Button onClick={() => saveModule(m.id, draft)} disabled={busy}>
                      {busy ? 'Saving…' : 'Save'}
                    </Button>
                    {(['locked', 'testing', 'open'] as const).map((st) => (
                      <Button
                        key={st}
                        variant="ghost"
                        onClick={() => saveModule(m.id, draft, st)}
                        disabled={busy || m.state === st}
                      >
                        Mark {st}
                      </Button>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: 14,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, color: C.faint, marginBottom: 6 }}>
                        How to write it
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 17, fontSize: 13.5, color: C.dim, lineHeight: 1.6 }}>
                        {m.how.map((h, j) => <li key={j} style={{ marginBottom: 4 }}>{h}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, color: C.red, marginBottom: 6 }}>
                        Common failures
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 17, fontSize: 13.5, color: C.dim, lineHeight: 1.6 }}>
                        {m.failures.map((f, j) => <li key={j} style={{ marginBottom: 4 }}>{f}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* ---------------------------------------------------------------- */}
      <SectionLabel>Proof ({proof.length})</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 30 }}>
        {proof.length === 0 ? (
          <Card><Empty>Nothing recorded yet.</Empty></Card>
        ) : (
          proof.map((p) => (
            <Card key={p.id}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
                <Pill tone={PROOF_TONE[p.status]}>{p.status}</Pill>
                <span style={{ fontSize: 12.5, color: C.faint, textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  {p.kind}
                </span>
                <span style={{ fontSize: 12.5, color: C.faint, marginLeft: 'auto' }}>
                  {PROOF_MEANS[p.status]}
                </span>
              </div>
              <div style={{ fontSize: 15, color: C.text, lineHeight: 1.6 }}>{p.body}</div>
              {(p.attribution || p.source) && (
                <div style={{ fontSize: 13, color: C.faint, marginTop: 5, lineHeight: 1.55 }}>
                  {[p.attribution, p.source].filter(Boolean).join(' · ')}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {(brand.guardrails?.never ?? []).length > 0 && (
        <>
          <SectionLabel>Never say</SectionLabel>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(brand.guardrails.never ?? []).map((r) => (
                <div key={r.term} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: C.red,
                      background: C.redSoft,
                      padding: '3px 9px',
                      borderRadius: 6,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.term}
                  </span>
                  <span style={{ fontSize: 13.5, color: C.dim, flex: 1, minWidth: 200 }}>
                    {r.reason}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12.5, color: C.faint, marginTop: 14, lineHeight: 1.6 }}>
              Every rule carries its reason. Rules with reasons survive; rules without them get
              relitigated every quarter by whoever is loudest.
            </p>
          </Card>
        </>
      )}
    </Page>
  );
}
