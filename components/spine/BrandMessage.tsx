'use client';

/**
 * What you say, before anyone asks what you charge.
 *
 * The kit held colors, type, logos and a box for voice. Voice is how you
 * sound; it is not what you claim. Nothing in here said who this is for, what
 * it does, or why somebody would pick it, which is the part every pitch,
 * proposal, home page and cold email is written out of. It was being
 * reinvented from memory each time, slightly differently.
 *
 * WHY THESE SIX
 *
 * They are the questions a stranger actually asks, in the order they ask them,
 * and each one is answerable in a sentence. A longer template gets abandoned
 * halfway, and a positioning doc nobody finished is worth less than six honest
 * lines.
 *
 * "What you will not do" earns its place because it is the one people skip and
 * the one that does the most work. A brand with no edges reads as a brand that
 * will take anything, which is what a low price signals.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, SectionLabel, inputStyle } from './ui';

interface Field {
  key: string;
  label: string;
  ask: string;
  placeholder: string;
  rows?: number;
}

const FIELDS: Field[] = [
  {
    key: 'line',
    label: 'The one line',
    ask: 'What you say when somebody asks what you do.',
    placeholder: 'One sentence. No adjectives you would not say out loud.',
  },
  {
    key: 'who',
    label: 'Who it is for',
    ask: 'Specific enough that somebody could be excluded by it.',
    placeholder: 'Founders and small businesses whose brand is holding the work back.',
  },
  {
    key: 'does',
    label: 'What you actually do',
    ask: 'The work, not the outcome.',
    placeholder: 'Brand, messaging, the site, and the system that runs it after.',
  },
  {
    key: 'why',
    label: 'Why you and not them',
    ask: 'True, checkable, and not available to your competitors.',
    placeholder: 'What is different, said plainly.',
  },
  {
    key: 'wont',
    label: 'What you will not do',
    ask: 'The edges. A brand with none reads as one that takes anything.',
    placeholder: 'The work you turn down, and why.',
  },
  {
    key: 'proof',
    label: 'Proof',
    ask: 'Names and numbers, or it is a claim.',
    placeholder: 'Who you have done this for, and what changed.',
  },
];

/**
 * A first draft, from what is already on the record.
 *
 * An empty form with six boxes is a form nobody fills in. This is assembled
 * from the site's own headline and the three clients on file, offered as
 * something to argue with rather than something to author from nothing.
 * Marked as a draft until it is saved, because a guess presented as settled is
 * worse than a blank.
 */
const DRAFT: Record<string, string> = {
  line: 'We chart the course, you make waves.',
  who:
    'Founders and small businesses good at the work and losing to businesses that are better at looking like they are.',
  does:
    'Brand, messaging and the website, then the platform that runs the business behind it: clients, pipeline, invoices and the reference you keep reaching for.',
  why:
    'The strategy and the system come from the same place. Most agencies hand over a logo and leave; the thing built here keeps working on a Tuesday six months later.',
  wont:
    'No retainers for activity nobody can point at. No rebuilding a brand that is already working. No taking on the tenth client of a kind we have never served.',
  proof:
    'Colette Intelligence, brand and messaging through to a launched site. Mammoth Construction, a whole operation moved off paper. Global Seafood Partners, a business stood up from a plan.',
};

export function BrandMessage({ orgId, orgName }: { orgId: string | null; orgName: string }) {
  const [value, setValue] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDraft, setShowDraft] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    const res = await supabase.from('orgs').select('settings').eq('id', orgId).maybeSingle();
    if (res.error) setError(res.error.message);
    else {
      const s = (res.data?.settings ?? {}) as { message?: Record<string, string> };
      setValue(s.message ?? {});
    }
    setLoaded(true);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!orgId) return;
    setBusy(true);
    setError(null);
    const cur = await supabase.from('orgs').select('settings').eq('id', orgId).maybeSingle();
    const settings = { ...((cur.data?.settings ?? {}) as Record<string, unknown>), message: value };
    const res = await supabase.from('orgs').update({ settings }).eq('id', orgId);
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const written = FIELDS.filter((f) => (value[f.key] ?? '').trim().length > 0).length;
  if (!loaded) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <SectionLabel>What {orgName} says ({written} of {FIELDS.length})</SectionLabel>
        {written === 0 && (
          <button
            onClick={() => { setValue(DRAFT); setShowDraft(true); }}
            style={{
              background: 'transparent', border: 'none', padding: 0,
              color: C.blue, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Start from a draft
          </button>
        )}
      </div>

      {showDraft && (
        <div
          style={{
            fontSize: 12.5, color: C.amber, lineHeight: 1.6, marginBottom: 12,
            padding: '8px 11px', borderRadius: 8,
            background: C.amberSoft, border: `1px solid ${C.amber}44`,
          }}
        >
          A draft, assembled from your own headline and the three clients on file. It is meant to be
          argued with. Nothing is saved until you press save.
        </div>
      )}

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {FIELDS.map((f) => (
            <div key={f.key}>
              <div
                style={{
                  fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
                  fontSize: 13.5, fontWeight: 600, color: C.text,
                }}
              >
                {f.label}
              </div>
              <div style={{ fontSize: 12.5, color: C.faint, margin: '1px 0 6px', lineHeight: 1.5 }}>
                {f.ask}
              </div>
              <textarea
                value={value[f.key] ?? ''}
                onChange={(e) => setValue({ ...value, [f.key]: e.target.value })}
                rows={f.rows ?? 2}
                placeholder={f.placeholder}
                style={{ ...inputStyle, lineHeight: 1.6, resize: 'vertical' }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
          <Button onClick={save} disabled={busy || !orgId}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          {saved && <span style={{ fontSize: 12.5, color: C.green }}>Saved</span>}
          {error && <span style={{ fontSize: 12.5, color: C.red }}>{error}</span>}
        </div>
      </Card>

      <div style={{ fontSize: 12.5, color: C.faint, marginTop: 10, lineHeight: 1.6, maxWidth: '66ch' }}>
        This is what every pitch, proposal and home page gets written out of. Filling it in once is
        the difference between saying the same thing everywhere and reinventing it each time,
        slightly differently.
      </div>
    </div>
  );
}
