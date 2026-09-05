'use client';

/**
 * Where this one stands.
 *
 * The first version put the whole prospect lane on every record, including
 * clients, and it cost real data within a day: Colette and Mammoth were both
 * clients of two years and both ended up at Noticed, because the leftmost
 * button of a five-step bar sitting at the top of their record does exactly
 * that in one click, silently, with no confirmation and no undo. They then
 * vanished from the client list, which is correct behaviour for a stage nobody
 * meant to set.
 *
 * Two rules came out of that.
 *
 * A CLIENT IS NOT A PROSPECT AT A LATER STAGE
 *
 * Showing Noticed, Reached, Talking and Proposed to somebody who has been a
 * client for two years is not just noise, it is four buttons whose only
 * possible effect is damage. The lane is for records still being chased. A
 * client gets a line of text saying they are a client.
 *
 * MOVING BACKWARDS IS A DECISION, NOT A CLICK
 *
 * Forward through the lane is cheap and reversible. Taking somebody out of the
 * client list is neither, so it asks first.
 */

import { useState } from 'react';
import { CLOSED, LANE, STAGE, isClient, type Stage } from '@/lib/spine/stage';
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
  const [confirming, setConfirming] = useState<Stage | null>(null);
  const here = LANE.findIndex((s) => s.id === stage);
  const closed = CLOSED.find((s) => s.id === stage);

  const color = (tone: string) =>
    tone === 'green' ? C.green : tone === 'amber' ? C.amber : C.accent;

  const quiet: React.CSSProperties = {
    background: 'transparent', border: 'none', padding: 0,
    color: C.blue, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
  };

  /* ------------------------------------------------------------------ won */

  if (isClient(stage)) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              border: `1px solid ${stage === 'won' ? `${C.green}55` : C.border}`,
              background: stage === 'won' ? C.greenSoft : C.panelAlt,
              color: stage === 'won' ? C.green : C.faint,
              borderRadius: 999, padding: '4px 14px', fontSize: 13, fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: stage === 'won' ? C.green : C.faint,
              }}
            />
            {stage === 'won' ? 'A client' : 'A past client'}
          </span>

          <span style={{ fontSize: 12.5, color: C.faint, flex: 1, minWidth: 120 }}>
            {stage === 'won' ? 'Working with you now.' : 'Worked with you before.'}
          </span>

          {confirming ? (
            <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: C.amber }}>
                {confirming === 'past'
                  ? 'Mark them past? They stay in your list, greyed.'
                  : 'Put them back in the pipeline? They leave your client list.'}
              </span>
              <button
                onClick={() => { onChange(confirming); setConfirming(null); }}
                disabled={busy}
                style={{ ...quiet, color: C.amber }}
              >
                Yes
              </button>
              <button onClick={() => setConfirming(null)} style={{ ...quiet, color: C.faint }}>
                Cancel
              </button>
            </span>
          ) : (
            <>
              {stage === 'won' && (
                <button onClick={() => setConfirming('past')} disabled={busy} style={quiet}>
                  No longer a client
                </button>
              )}
              <button onClick={() => setConfirming('talking')} disabled={busy} style={quiet}>
                Back to pipeline
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------- still chasing */

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {LANE.map((s, i) => {
          const behind = here >= 0 && i < here;
          const on = s.id === stage;
          const tint = color(s.tone);
          /**
           * Marking somebody won from here is fine; it only adds them to a
           * list. Everything else in the lane is a step you can take back.
           */
          return (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              disabled={busy}
              title={s.means}
              style={{
                flex: '1 1 92px',
                minWidth: 84,
                padding: '7px 12px',
                border: `1px solid ${on ? tint : C.border}`,
                borderRadius: 999,
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

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        {closed ? (
          <>
            <span style={{ fontSize: 12.5, color: C.faint }}>{closed.label}. {closed.means}</span>
            <button onClick={() => onChange('talking')} disabled={busy} style={quiet}>Reopen</button>
          </>
        ) : (
          <button
            onClick={() => onChange('cold')}
            disabled={busy}
            style={{ ...quiet, color: C.faint }}
          >
            Gone cold
          </button>
        )}

        <span style={{ flex: 1 }} />
        {why && <span style={{ fontSize: 12, color: C.faint, textAlign: 'right' }}>{why}</span>}
      </div>

      {!closed && here >= 0 && (
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 6, lineHeight: 1.5 }}>
          {STAGE[stage].means}
        </div>
      )}
    </div>
  );
}
