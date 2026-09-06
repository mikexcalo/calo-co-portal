'use client';

/**
 * A walkthrough that runs inside the product.
 *
 * A recorded demo is out of date the day after it is made, cannot be followed
 * at somebody else's pace, and shows a person data that is not theirs. This
 * uses their workspace, their clients and their numbers, and it stays true
 * because it points at real screens rather than pictures of them.
 *
 * A dock along the bottom rather than a modal, because the whole point is that
 * you can use the screen you are being shown. A modal would put a sheet of
 * glass between the explanation and the thing being explained.
 *
 * The clock is not decoration. The question after building onboarding is always
 * "how long does this take", and guessing is how a twenty minute walkthrough
 * gets sold as five.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { tourById, type Tour } from '@/lib/spine/tours';
import { C } from './ui';

const KEY = 'calo.tour';

interface State { id: string; step: number; startedAt: number }

/** Read once so a refresh mid-tour does not lose your place. */
function read(): State | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as State) : null;
  } catch {
    return null;
  }
}

export function startTour(id: string) {
  const state: State = { id, step: 0, startedAt: Date.now() };
  window.localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new Event('calo.tour.changed'));
}

export function TourRunner() {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState<{ steps: number; seconds: number } | null>(null);
  const navigated = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => setState(read());
    sync();
    window.addEventListener('calo.tour.changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('calo.tour.changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // One tick a second, only while a tour is running.
  useEffect(() => {
    if (!state) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state]);

  const tour: Tour | null = state ? tourById(state.id) : null;
  const step = tour && state ? tour.steps[state.step] : null;

  /**
   * Take them to the screen the step is about.
   *
   * Guarded, because pushing a route the browser is already on causes a
   * re-render that would push again. Nobody enjoys a tour that fights the
   * back button.
   */
  useEffect(() => {
    if (!step) return;
    const target = step.href;
    if (pathname !== target && navigated.current !== `${state?.step}:${target}`) {
      navigated.current = `${state?.step}:${target}`;
      router.push(target);
    }
  }, [step, pathname, router, state?.step]);

  const write = useCallback((next: State | null) => {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
    setState(next);
  }, []);

  if (!tour || !state || !step) {
    if (!done) return null;
    return (
      <Dock>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={S.title}>Finished</div>
          <div style={S.body}>
            {done.steps} steps in {fmt(done.seconds)}. That is how long this takes to walk somebody
            through.
          </div>
        </div>
        <button onClick={() => setDone(null)} style={S.ghost}>Close</button>
      </Dock>
    );
  }

  const elapsed = Math.max(0, Math.round((now - state.startedAt) / 1000));
  const last = state.step === tour.steps.length - 1;

  const next = () => {
    if (last) {
      setDone({ steps: tour.steps.length, seconds: elapsed });
      write(null);
      return;
    }
    write({ ...state, step: state.step + 1 });
  };

  return (
    <Dock>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 240 }}>
        <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={S.title}>{step.title}</span>
          <span style={S.meta}>
            {state.step + 1} of {tour.steps.length}
          </span>
          <span style={S.meta}>{fmt(elapsed)}</span>
        </div>
        <div style={S.body}>{step.body}</div>
        {step.todo && <div style={S.todo}>Try it: {step.todo}</div>}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        {state.step > 0 && (
          <button onClick={() => write({ ...state, step: state.step - 1 })} style={S.ghost}>Back</button>
        )}
        <button onClick={() => write(null)} style={S.ghost}>Stop</button>
        <button onClick={next} style={S.primary}>{last ? 'Finish' : 'Next'}</button>
      </div>

      {/* Progress as a hairline along the top of the dock rather than a widget:
          it is a fact about where you are, not a thing to look at. */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, height: 2,
          width: `${((state.step + 1) / tour.steps.length) * 100}%`,
          background: C.accent, borderRadius: 999,
          transition: 'width .25s',
        }}
      />
    </Dock>
  );
}

function Dock({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed', left: '50%', bottom: 18, transform: 'translateX(-50%)',
        zIndex: 120, width: 'min(760px, calc(100vw - 28px))',
        display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
        background: C.panel, border: `1px solid ${C.borderStrong}`,
        borderRadius: 14, padding: '14px 16px',
        boxShadow: '0 10px 34px rgba(0,0,0,.14)',
      }}
    >
      {children}
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const S: Record<string, React.CSSProperties> = {
  title: {
    fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
    fontSize: 14.5, fontWeight: 600, color: C.text,
  },
  meta: { fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' },
  body: { fontSize: 13, color: C.dim, lineHeight: 1.55, maxWidth: '72ch' },
  todo: { fontSize: 12.5, color: C.green, lineHeight: 1.5, marginTop: 2 },
  primary: {
    background: C.accent, color: '#fff', border: 'none',
    borderRadius: 999, padding: '7px 18px', fontSize: 13.5,
    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
  },
  ghost: {
    background: 'transparent', border: 'none', padding: 0,
    color: C.faint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
};
