'use client';

/**
 * THE MESSAGING FRAMEWORK.
 *
 * One shape, used for every brand — yours and every client's. It replaces six
 * free-text boxes that lived on your org record and nowhere else, so the part
 * of the work every pitch, proposal and homepage is written out of simply did
 * not exist for the three clients on file.
 *
 * The framework narrows: a promise you could put on a wall, then a positioning
 * statement, then who it is for, then why the business exists, then how it
 * sounds, then the whole thing said once. After that, three pillars — each a
 * claim, its headline, and the proof that pays it off. Three is the
 * convention, not a rule, so pillars are a list you can add to.
 *
 * Every field is editable and everything saves together. The order on screen
 * is the order you fill it in, because each answer is easier once the one
 * above it exists.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { save as saveOrFail } from '@/lib/spine/save';
import { Button, C, Card, SectionLabel, inputStyle } from './ui';

export interface Pillar {
  name: string;
  headline: string;
  support: string[];
}

export interface Message {
  promise: string;
  positioning: string;
  audience: string;
  mission: string;
  tone: string;
  elevator: string;
  pillars: Pillar[];
}

const EMPTY: Message = {
  promise: '', positioning: '', audience: '',
  mission: '', tone: '', elevator: '', pillars: [],
};

/**
 * The ask is the question you would be asked in the room, not a definition.
 * "Positioning statement" tells somebody nothing; "category, who it is for,
 * and what makes it different" tells them what to type.
 */
const FIELDS: Array<{
  key: keyof Omit<Message, 'pillars'>;
  label: string;
  ask: string;
  rows: number;
}> = [
  {
    key: 'promise',
    label: 'Brand promise',
    ask: 'The shortest true thing. What somebody gets, in a line you could put on a wall.',
    rows: 2,
  },
  {
    key: 'positioning',
    label: 'Positioning statement',
    ask: 'What category it is in, who it is for, and what makes it different from the obvious alternative.',
    rows: 4,
  },
  {
    key: 'audience',
    label: 'Target audience',
    ask: 'Specific enough that somebody could be excluded by it. Name the buyer and the champion if they are different people.',
    rows: 3,
  },
  {
    key: 'mission',
    label: 'Mission',
    ask: 'Why the business exists, beyond making money doing it.',
    rows: 3,
  },
  {
    key: 'tone',
    label: 'Tone of voice',
    ask: 'How it sounds out loud. A person it sounds like beats three adjectives.',
    rows: 3,
  },
  {
    key: 'elevator',
    label: 'Elevator pitch',
    ask: 'The whole answer, said once, to somebody who has never heard of it.',
    rows: 6,
  },
];

const area = (rows: number) => ({
  ...inputStyle,
  minHeight: rows * 22 + 16,
  lineHeight: 1.6,
  resize: 'vertical' as const,
  fontFamily: 'inherit',
});

export function Messaging({
  orgId,
  brandId = null,
  name,
}: {
  orgId: string | null;
  /** null is your own brand. */
  brandId?: string | null;
  name: string;
}) {
  const [m, setM] = useState<Message>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    let q = supabase
      .from('brand_message')
      .select('promise, positioning, audience, mission, tone, elevator, pillars')
      .eq('org_id', orgId);
    q = brandId ? q.eq('brand_id', brandId) : q.is('brand_id', null);
    const res = await q.maybeSingle();
    if (res.data) {
      const d = res.data as Partial<Message>;
      setM({
        promise: d.promise ?? '',
        positioning: d.positioning ?? '',
        audience: d.audience ?? '',
        mission: d.mission ?? '',
        tone: d.tone ?? '',
        elevator: d.elevator ?? '',
        pillars: Array.isArray(d.pillars) ? (d.pillars as Pillar[]) : [],
      });
    }
    setLoaded(true);
  }, [orgId, brandId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!orgId) return;
    setBusy(true);
    /* Typing a payoff leaves empty lines behind. They are not data. */
    const clean: Message = {
      ...m,
      pillars: m.pillars.map((p) => ({ ...p, support: p.support.filter((x) => x.trim()) })),
    };
    const res = await saveOrFail(
      supabase.from('brand_message').upsert(
        { org_id: orgId, brand_id: brandId, ...clean, updated_at: new Date().toISOString() },
        { onConflict: 'org_id,brand_id' }
      )
    );
    if (!res.error) setM(clean);
    setBusy(false);
    if (!res.error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    }
  };

  const setPillar = (i: number, patch: Partial<Pillar>) =>
    setM((v) => ({
      ...v,
      pillars: v.pillars.map((p, n) => (n === i ? { ...p, ...patch } : p)),
    }));

  const written =
    FIELDS.filter((f) => (m[f.key] ?? '').trim()).length + (m.pillars.length ? 1 : 0);

  if (!loaded) return <Card><div style={{ color: C.faint, fontSize: 14 }}>Loading…</div></Card>;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 780 }}>
      <SectionLabel>What {name} says ({written} of {FIELDS.length + 1})</SectionLabel>

      {FIELDS.map((f) => (
        <Card key={f.key}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{f.label}</div>
          <div style={{ fontSize: 12.5, color: C.faint, margin: '3px 0 9px', lineHeight: 1.55 }}>
            {f.ask}
          </div>
          <textarea
            value={m[f.key]}
            onChange={(e) => setM({ ...m, [f.key]: e.target.value })}
            rows={f.rows}
            style={area(f.rows)}
          />
        </Card>
      ))}

      {/*
        Pillars are the part the framework exists for.

        The six above are one voice talking. A pillar is a claim you are
        prepared to defend, and the support underneath it is what stops the
        claim being an adjective. Three is the convention because three is what
        somebody remembers, but the list is open.
      */}
      <div>
        <SectionLabel>Brand pillars ({m.pillars.length})</SectionLabel>
        <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 10, lineHeight: 1.55 }}>
          Each one is a claim, the headline that carries it, and the proof underneath.
          A pillar with no proof is an adjective.
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {m.pillars.map((p, i) => (
            <Card key={i}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 10 }}>
                <span
                  style={{
                    fontSize: 11, color: C.faint, fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0, paddingTop: 2,
                  }}
                >
                  {i + 1}
                </span>
                <input
                  value={p.name}
                  onChange={(e) => setPillar(i, { name: e.target.value })}
                  placeholder="The pillar, in a few words"
                  style={{ ...inputStyle, fontWeight: 600, flex: 1 }}
                />
                <button
                  onClick={() => setM((v) => ({ ...v, pillars: v.pillars.filter((_, n) => n !== i) }))}
                  className="rowBtn"
                  title="Remove this pillar"
                >
                  Remove
                </button>
              </div>

              <div style={{ fontSize: 12, color: C.faint, marginBottom: 5 }}>Headline value prop</div>
              <textarea
                value={p.headline}
                onChange={(e) => setPillar(i, { headline: e.target.value })}
                rows={2}
                placeholder="The one line a customer would repeat."
                style={{ ...area(2), marginBottom: 12 }}
              />

              <div style={{ fontSize: 12, color: C.faint, marginBottom: 5 }}>
                Payoff, one per line
              </div>
              <textarea
                value={p.support.join('\n')}
                onChange={(e) =>
                  setPillar(i, { support: e.target.value.split('\n') })
                }
                rows={4}
                placeholder={'What proves it.\nOne per line.'}
                style={area(4)}
              />
            </Card>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <Button
            variant="ghost"
            onClick={() =>
              setM((v) => ({ ...v, pillars: [...v.pillars, { name: '', headline: '', support: [] }] }))
            }
          >
            Add a pillar
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 4 }}>
        <Button onClick={save} disabled={busy || !orgId}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span style={{ fontSize: 13, color: C.green }}>Saved</span>}
        <span style={{ fontSize: 12.5, color: C.faint }}>
          Blank lines in a payoff are dropped when it saves.
        </span>
      </div>
    </div>
  );
}
