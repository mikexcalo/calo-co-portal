'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PATHS, useTutorial } from '@/lib/spine/tutorial';
import { ANSWERS, search } from '@/lib/spine/answers';
import { C, SERIF, radius, useIsPhone } from './ui';
import { PRODUCT } from '@/lib/brand';

/**
 * The guided-path drawer. Slides in from the right, stays out of the way,
 * and links to the real screens rather than faking them.
 */
export function TutorialPanel() {
  const router = useRouter();
  const phone = useIsPhone();
  const {
    open,
    closePanel,
    activePath,
    startPath,
    exitPath,
    completed,
    toggleStep,
    progressFor,
    resetPath,
  } = useTutorial();

  if (!open) return null;

  return (
    <>
      <div
        onClick={closePanel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,.28)', zIndex: 60 }}
      />
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: phone ? '100%' : 420,
          background: C.panel,
          borderLeft: `1px solid ${C.border}`,
          zIndex: 61,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0,0,0,.08)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 22px',
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 20 }}>
              {activePath ? activePath.name : `Learn ${PRODUCT}`}
            </div>
            {activePath && (
              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>
                {progressFor(activePath.id).done} of {progressFor(activePath.id).total} done
              </div>
            )}
          </div>
          <button
            onClick={closePanel}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 20,
              color: C.faint,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          {!activePath ? (
            <>
              <AskBox />

              <div style={{
                fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.09em',
                color: C.faint, fontWeight: 600, margin: '26px 0 10px',
              }}>
                Or walk a whole process
              </div>
              <p style={{ fontSize: 14, color: C.dim, marginTop: 0, lineHeight: 1.55 }}>
                Each path runs end to end on your real data. Not a tour with tooltips.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                {PATHS.map((p) => {
                  const { done, total } = progressFor(p.id);
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => startPath(p.id)}
                      style={{
                        textAlign: 'left',
                        background: C.panel,
                        border: `1px solid ${done === total && total ? C.green : C.border}`,
                        borderRadius: 999,
                        padding: 16,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: 10,
                        }}
                      >
                        <span style={{ fontFamily: SERIF, fontSize: 18, color: C.text }}>
                          {p.name}
                        </span>
                        <span style={{ fontSize: 12, color: C.faint, whiteSpace: 'nowrap' }}>
                          {p.minutes} min
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: 13.5,
                          color: C.dim,
                          margin: '7px 0 12px',
                          lineHeight: 1.5,
                        }}
                      >
                        {p.blurb}
                      </p>
                      <div
                        style={{
                          height: 3,
                          background: C.panelAlt,
                          borderRadius: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: done === total && total ? C.green : C.accent,
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6 }}>
                        {done}/{total} steps
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, color: C.dim, marginTop: 0, lineHeight: 1.55 }}>
                {activePath.blurb}
              </p>

              <ol style={{ listStyle: 'none', padding: 0, margin: '18px 0 0' }}>
                {activePath.steps.map((step, i) => {
                  const key = `${activePath.id}:${step.id}`;
                  const isDone = !!completed[key];
                  return (
                    <li
                      key={step.id}
                      style={{
                        display: 'flex',
                        gap: 12,
                        paddingBottom: 18,
                        marginBottom: 18,
                        borderBottom:
                          i < activePath.steps.length - 1 ? `1px solid ${C.border}` : 'none',
                      }}
                    >
                      <button
                        onClick={() => toggleStep(activePath.id, step.id)}
                        aria-label={isDone ? 'Mark not done' : 'Mark done'}
                        style={{
                          flexShrink: 0,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          border: `1.5px solid ${isDone ? C.green : C.borderStrong}`,
                          background: isDone ? C.green : 'transparent',
                          color: '#fff',
                          fontSize: 13,
                          lineHeight: 1,
                          cursor: 'pointer',
                          marginTop: 1,
                        }}
                      >
                        {isDone ? '✓' : ''}
                      </button>

                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 500,
                            color: isDone ? C.faint : C.text,
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}
                        >
                          {step.title}
                        </div>
                        <p
                          style={{
                            fontSize: 13.5,
                            color: C.dim,
                            margin: '6px 0 0',
                            lineHeight: 1.55,
                          }}
                        >
                          {step.body}
                        </p>

                        {step.done && (
                          <div
                            style={{
                              fontSize: 12.5,
                              color: C.green,
                              marginTop: 8,
                              background: C.greenSoft,
                              padding: '5px 9px',
                              borderRadius: radius.sm,
                              display: 'inline-block',
                            }}
                          >
                            Done when: {step.done}
                          </div>
                        )}

                        {step.href && (
                          <div style={{ marginTop: 10 }}>
                            <button
                              onClick={() => {
                                closePanel();
                                router.push(step.href!);
                              }}
                              style={{
                                background: 'transparent',
                                border: `1px solid ${C.borderStrong}`,
                                borderRadius: 999,
                                padding: '6px 12px',
                                fontSize: 13,
                                color: C.text,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                              }}
                            >
                              Take me there →
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        {activePath && (
          <footer
            style={{
              display: 'flex',
              gap: 8,
              padding: '14px 22px',
              borderTop: `1px solid ${C.border}`,
            }}
          >
            <button
              onClick={exitPath}
              style={{
                background: 'transparent',
                border: `1px solid ${C.borderStrong}`,
                borderRadius: 999,
                padding: '8px 14px',
                fontSize: 13.5,
                color: C.text,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ← All paths
            </button>
            <button
              onClick={() => resetPath(activePath.id)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: 13.5,
                color: C.faint,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Reset progress
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}

/**
 * Ask a question — answered from a local index, never a model call.
 *
 * It only knows what's written in lib/spine/answers.ts. When nothing matches
 * it says so instead of inventing something, which is the whole reason this
 * is a keyword index and not a chatbot: it costs nothing per question and it
 * cannot make things up.
 */
function AskBox() {
  const router = useRouter();
  const { closePanel } = useTutorial();
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const matches = useMemo(() => search(q), [q]);
  const asking = q.trim().length > 1;

  // Before typing, show the questions people actually ask most.
  const shown = asking ? matches.map((m) => m.answer) : ANSWERS.slice(0, 5);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpenId(null);
        }}
        placeholder="Ask a question, like how do I add receipts?"
        style={{
          width: '100%',
          background: C.panelAlt,
          border: `1px solid ${C.border}`,
          borderRadius: radius.md,
          padding: '11px 13px',
          color: C.text,
          fontSize: 14.5,
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />

      <div style={{ fontSize: 12, color: C.faint, margin: '7px 2px 0' }}>
        Answered from a built-in guide. Free, instant, and it never makes anything up.
      </div>

      {asking && matches.length === 0 ? (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: radius.md,
            background: C.panelAlt,
            fontSize: 13.5,
            color: C.dim,
            lineHeight: 1.55,
          }}
        >
          Nothing in the guide covers that yet. Rather than guess at an answer, it&apos;s
          saying so. Tell us what you were looking for and we&apos;ll add it.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
          {!asking && (
            <div
              style={{
                fontSize: 10.5,
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                color: C.faint,
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              Common questions
            </div>
          )}
          {shown.map((a) => {
            const isOpen = openId === a.id;
            return (
              <div
                key={a.id}
                style={{
                  border: `1px solid ${isOpen ? C.borderStrong : C.border}`,
                  borderRadius: radius.md,
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : a.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '11px 13px',
                    background: 'transparent',
                    border: 'none',
                    color: C.text,
                    fontSize: 14,
                    fontWeight: isOpen ? 500 : 400,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {a.question}
                </button>

                {isOpen && (
                  <div style={{ padding: '0 13px 13px' }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        color: C.dim,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {a.body}
                    </div>
                    {a.href && (
                      <button
                        onClick={() => {
                          closePanel();
                          router.push(a.href!);
                        }}
                        style={{
                          marginTop: 11,
                          background: 'transparent',
                          border: `1px solid ${C.borderStrong}`,
                          borderRadius: 999,
                          padding: '6px 12px',
                          fontSize: 13,
                          color: C.text,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {a.hrefLabel ?? 'Take me there'} →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
