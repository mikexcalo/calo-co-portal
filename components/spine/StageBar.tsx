'use client';

/**
 * Where this one stands, as a bar you can click.
 *
 * The stage was a dropdown in an edit panel, which means it was invisible until
 * you went looking and changed only when somebody remembered. A pipeline that
 * has to be remembered is a pipeline that is out of date by the second week.
 *
 * Drawn as a run of steps because the shape carries the meaning: everything
 * behind you is filled, the one you are on is solid, ahead is empty. You read
 * it without reading it, and moving is one click on the step you mean rather
 * than opening a menu and finding the word.
 *
 * WHY THE REASON IS SHOWN
 *
 * Most moves happen on their own, from a note going out or a reply coming in.
 * Something that moves by itself and does not say why is something people stop
 * believing, so the line underneath names what moved it and the undo is next to
 * it. That sentence is the whole difference between help and interference.
 */

import { CLOSED, LANE, STAGE, type Stage } from '@/lib/spine/stage';
import { C } from './ui';

export function StageBar({
  stage,
  why,
  onChange,
  busy,
}: {
  stage: Stage;
  why?: string | null;
  onChange: (next: Stage) => void;
  busy?: boolean;
}) {
  const here = LANE.findIndex((s) => s.id === stage);
  const closed = CLOSED.find((s) => s.id === stage);

  const color = (tone: string) =>
    tone === 'green' ? C.green : tone === 'amber' ? C.amber : C.accent;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {LANE.map((s, i) => {
          // Behind you, on it, or ahead. Three states and nothing else, so the
          // bar is legible at a glance rather than parsed.
          const behind = here >= 0 && i < here;
          const on = s.id === stage;
          const tint = color(s.tone);
          return (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              disabled={busy}
              title={s.means}
              style={{
                flex: '1 1 96px',
                minWidth: 88,
                padding: '9px 10px',
                border: `1px solid ${on ? tint : C.border}`,
                borderRadius: 7,
                background: on ? tint : behind ? C.panelAlt : 'transparent',
                color: on ? '#fff' : behind ? C.dim : C.faint,
                fontSize: 12.5,
                fontWeight: on ? 600 : 400,
                fontFamily: 'inherit',
                cursor: busy ? 'default' : 'pointer',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* The two ways out, set apart. Neither is further along than won, and
          drawing them as steps six and seven would say a lost deal is an
          advanced one. */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        {closed ? (
          <>
            <span style={{ fontSize: 12.5, color: C.faint }}>
              {closed.label}. {closed.means}
            </span>
            <button
              onClick={() => onChange('talking')}
              disabled={busy}
              style={{
                background: 'transparent', border: 'none', padding: 0,
                color: C.blue, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Reopen
            </button>
          </>
        ) : (
          CLOSED.map((s) => (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              disabled={busy}
              title={s.means}
              style={{
                border: `1px solid ${C.border}`, background: 'transparent',
                color: C.faint, borderRadius: 6, padding: '3px 10px',
                fontSize: 11.5, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {s.label}
            </button>
          ))
        )}

        <span style={{ flex: 1 }} />

        {why && (
          <span style={{ fontSize: 12, color: C.faint, textAlign: 'right' }}>
            {why}
          </span>
        )}
      </div>

      {!closed && here >= 0 && (
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 6, lineHeight: 1.5 }}>
          {STAGE[stage].means}
        </div>
      )}
    </div>
  );
}
