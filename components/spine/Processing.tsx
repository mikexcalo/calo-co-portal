'use client';

/**
 * What happens between dropping a file and seeing the result.
 *
 * Reading a receipt takes a few seconds, and a few seconds of nothing is where
 * people click the button again, refresh, or decide it's broken. The old
 * feedback was the word "Reading…" and a dimmed box, which does not say
 * whether anything is actually happening.
 *
 * Two deliberate choices:
 *
 * NO PERCENTAGE. We genuinely do not know how long a model will take on a
 * given file. A bar that races to 90% and sits there is a lie people learn to
 * distrust, and once they distrust it they stop believing the finished state
 * too. Indeterminate motion says "working" without claiming to know more than
 * we do.
 *
 * NAMED STAGES. The reassurance is not the animation, it is knowing which part
 * is slow. "Uploading" failing is a connection problem; "Reading" failing is a
 * file problem. Someone watching the stage change learns that without being
 * told.
 */

import { C, radius } from './ui';

export type Stage = 'uploading' | 'reading' | 'saving';

const COPY: Record<Stage, { label: string; detail: string }> = {
  uploading: { label: 'Uploading', detail: 'Sending the file across.' },
  reading: { label: 'Reading it', detail: 'Pulling out the details. This is the slow part.' },
  saving: { label: 'Saving', detail: 'Almost there.' },
};

const ORDER: Stage[] = ['uploading', 'reading', 'saving'];

export function Processing({
  stage = 'reading',
  fileName,
  count,
  /** Skip stages that don't apply. Photos upload but are never read. */
  stages = ORDER,
}: {
  stage?: Stage;
  fileName?: string;
  count?: number;
  stages?: Stage[];
}) {
  const current = stages.indexOf(stage);
  const copy = COPY[stage];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: radius.lg,
        background: C.panel,
        padding: '18px 20px',
        display: 'flex',
        gap: 16,
        alignItems: 'center',
      }}
    >
      {/* A page with a sweep across it, rather than a spinner. A spinner is
          the same shape everywhere and says only "wait"; this says "a file". */}
      <div
        aria-hidden
        style={{
          width: 38,
          height: 46,
          flexShrink: 0,
          borderRadius: 5,
          border: `1.5px solid ${C.borderStrong}`,
          background: C.panelAlt,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: '9px 7px auto 7px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ height: 2, borderRadius: 1, background: C.border }} />
          <span style={{ height: 2, borderRadius: 1, background: C.border, width: '78%' }} />
          <span style={{ height: 2, borderRadius: 1, background: C.border, width: '88%' }} />
          <span style={{ height: 2, borderRadius: 1, background: C.border, width: '60%' }} />
        </div>
        <div className="scanSweep" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {copy.label}
            {count && count > 1 ? ` ${count} files` : ''}
          </span>
          {fileName && (
            <span
              style={{
                fontSize: 12,
                color: C.faint,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 240,
              }}
            >
              {fileName}
            </span>
          )}
        </div>

        <div style={{ fontSize: 12.5, color: C.dim, marginTop: 2 }}>{copy.detail}</div>

        {/* One segment per stage, so the position in the sequence is visible
            rather than implied. */}
        <div style={{ display: 'flex', gap: 4, marginTop: 11 }}>
          {stages.map((s, i) => (
            <div
              key={s}
              className={i === current ? 'stageBarActive' : undefined}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: i < current ? C.accent : C.border,
                overflow: 'hidden',
                position: 'relative',
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scanDown {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(1000%); }
        }
        @keyframes stageSlide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .scanSweep {
          position: absolute;
          left: 0; right: 0; top: 0;
          height: 8px;
          background: linear-gradient(180deg, transparent, ${C.accent}55, transparent);
          animation: scanDown 1.6s linear infinite;
        }
        .stageBarActive::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, ${C.accent}, transparent);
          animation: stageSlide 1.15s ease-in-out infinite;
        }
        /* Somebody who asked their system to stop animating meant it. The
           stage labels still change, so nothing is lost but the movement. */
        @media (prefers-reduced-motion: reduce) {
          .scanSweep { animation: none; opacity: .35; }
          .stageBarActive::after { animation: none; background: ${C.accent}; }
        }
      `}</style>
    </div>
  );
}
