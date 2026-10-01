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
import { READ_FAILED, human } from '@/lib/spine/errors';
import { Button, C, Card, SectionLabel, Skeleton, inputStyle } from './ui';

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
  resolved = false,
}: {
  orgId: string | null;
  /** null is your own brand. */
  brandId?: string | null;
  name: string;
  /*
    Ask the server whose messaging this is, instead of querying directly.

    A workspace looking at its own Brand screen cannot know whether its
    messaging is its own or its studio's: the studio's row is stored under the
    STUDIO's org id and is unreachable from here. `/api/brand/messaging` walks
    the same `customers.linked_org_id` link the brand kit does and says which
    it found and whether it may be changed.

    The two studio-side screens - a customer's record and a brand's page - pass
    the ids they already hold and keep the direct path, because there the
    answer is not in question: it is the studio's own row, and the studio is
    the author.
  */
  resolved?: boolean;
}) {
  const [m, setM] = useState<Message>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  /* Whose it is, once the server has said. Null until then, and always null on
     the direct path, where the caller is the author by construction. */
  const [keptBy, setKeptBy] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;

    const shape = (d: Partial<Message>) => ({
      promise: d.promise ?? '',
      positioning: d.positioning ?? '',
      audience: d.audience ?? '',
      mission: d.mission ?? '',
      tone: d.tone ?? '',
      elevator: d.elevator ?? '',
      pillars: Array.isArray(d.pillars) ? (d.pillars as Pillar[]) : [],
    });

    if (resolved) {
      try {
        const r = await fetch('/api/brand/messaging', { cache: 'no-store' });
        const j = (await r.json()) as {
          message?: Partial<Message> | null; editable?: boolean; keptBy?: string | null;
          error?: string;
        };
        /*
          A read that fails is not an empty workspace.

          Both look like blank fields, and only one of them is safe to type
          into: if this workspace's messaging belongs to its studio and the
          lookup simply did not answer, an editable form invites somebody to
          write a second copy of something they cannot see. So a failure says
          so and offers nothing.
        */
        if (!r.ok) {
          setFailed(j.error?.trim() || READ_FAILED);
        } else {
          if (j.message) setM(shape(j.message));
          setReadOnly(j.editable === false);
          setKeptBy(j.keptBy ?? null);
        }
      } catch (e) {
        setFailed(human(e, READ_FAILED));
      }
      setLoaded(true);
      return;
    }

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
  }, [orgId, brandId, resolved]);

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

  if (!loaded) {
    return (
      <Card>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <Skeleton w={104} h={10} style={{ marginBottom: 7 }} />
            <Skeleton w="100%" h={30} r={8} />
          </div>
        ))}
      </Card>
    );
  }

  if (failed) {
    return (
      <Card>
        <div style={{ fontSize: 14.5, color: C.text, marginBottom: 6 }}>
          This could not be read
        </div>
        <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>{failed}</div>
      </Card>
    );
  }

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
            readOnly={readOnly}
            style={{ ...area(f.rows), ...(readOnly ? { background: C.panelAlt, color: C.dim } : {}) }}
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
                  readOnly={readOnly}
                  style={{
                    ...inputStyle, fontWeight: 600, flex: 1,
                    ...(readOnly ? { background: C.panelAlt, color: C.dim } : {}),
                  }}
                />
                {!readOnly && (
                  <button
                    onClick={() => setM((v) => ({ ...v, pillars: v.pillars.filter((_, n) => n !== i) }))}
                    className="rowBtn rowBtnWide"
                    title="Remove this pillar"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div style={{ fontSize: 12, color: C.faint, marginBottom: 5 }}>Headline value prop</div>
              <textarea
                value={p.headline}
                onChange={(e) => setPillar(i, { headline: e.target.value })}
                rows={2}
                placeholder="The one line a customer would repeat."
                readOnly={readOnly}
                style={{
                  ...area(2), marginBottom: 12,
                  ...(readOnly ? { background: C.panelAlt, color: C.dim } : {}),
                }}
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
                readOnly={readOnly}
                style={{ ...area(4), ...(readOnly ? { background: C.panelAlt, color: C.dim } : {}) }}
              />
            </Card>
          ))}
        </div>

        {!readOnly && (
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
        )}
      </div>

      {readOnly ? (
        /*
          Said at the foot rather than left for a refused save to explain.

          The row belongs to the studio that wrote it. A Save here would write
          a second row under this workspace's own org id, which nothing reads
          while the studio's exists, so the edit would look accepted and vanish
          on the next load.
        */
        <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.55, paddingTop: 4 }}>
          {keptBy
            ? `Written and kept by ${keptBy}. Ask them for a change.`
            : 'Written and kept by the studio that set this workspace up. Ask them for a change.'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 4 }}>
          <Button onClick={save} disabled={busy || !orgId}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          {saved && <span style={{ fontSize: 13, color: C.green }}>Saved</span>}
          <span style={{ fontSize: 12.5, color: C.faint }}>
            Blank lines in a payoff are dropped when it saves.
          </span>
        </div>
      )}
    </div>
  );
}
