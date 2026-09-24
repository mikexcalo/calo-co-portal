'use client';

/**
 * How a client is starting, as one choice.
 *
 * Marcie is looking on her husband's behalf. Mark is a real client using one
 * narrow slice on purpose. John is being built end to end. All three used to
 * get the full module list for their kind of business, because the only way
 * to tailor a workspace was to open What You See and flip fourteen switches
 * correctly, from memory, per client — and then remember what you did.
 *
 * Everything underneath already existed: orgs.modules holds a state per
 * module, three business kinds carry their own defaults, and What You See
 * edits the lot. This is the missing field and the map from it.
 *
 * It only ever turns things off, so it can never hand somebody a module their
 * kind of business has no use for. And switching path clears the last path's
 * overrides rather than stacking them, which is the difference between
 * changing your mind and slowly turning everything off forever.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { save as saveOrFail } from '@/lib/spine/save';
import {
  ONBOARDING_PATHS,
  modulesForPath,
  type OnboardingPath,
} from '@/lib/spine/modules';
import { C, SectionLabel, radius } from './ui';

export function HowTheyStart({
  orgId,
  clientName,
}: {
  /** The client's own workspace. Null when they have no sign-in yet. */
  orgId: string | null;
  clientName: string;
}) {
  const [path, setPath] = useState<OnboardingPath | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<OnboardingPath | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) { setLoaded(true); return; }
    const res = await supabase
      .from('orgs')
      .select('onboarding_path')
      .eq('id', orgId)
      .maybeSingle();
    setPath(((res.data as { onboarding_path?: OnboardingPath } | null)?.onboarding_path) ?? null);
    setLoaded(true);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const choose = async (next: OnboardingPath) => {
    if (!orgId || busy) return;
    setBusy(next);

    /* Read the current modules first: anything a path does not name is
       somebody's deliberate choice and is not this control's to undo. */
    const cur = await supabase.from('orgs').select('modules').eq('id', orgId).maybeSingle();
    const merged = modulesForPath(
      next,
      ((cur.data as { modules?: Record<string, unknown> } | null)?.modules) ?? {}
    );

    const res = await saveOrFail(
      supabase.from('orgs').update({ onboarding_path: next, modules: merged }).eq('id', orgId)
    );
    setBusy(null);
    if (!res.error) {
      setPath(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2600);
    }
  };

  /* No workspace, no modules to set. Saying so beats a dead control. */
  if (!loaded || !orgId) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <SectionLabel>How they&apos;re starting</SectionLabel>
        {saved && <span style={{ fontSize: 12.5, color: C.green }}>Saved</span>}
      </div>
      <div style={{ fontSize: 12.5, color: C.faint, margin: '-4px 0 10px', lineHeight: 1.55 }}>
        Sets what {clientName} sees when they sign in. Change it any time, and
        tune the detail in What You See.
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 10,
        }}
      >
        {ONBOARDING_PATHS.map((p) => {
          const on = path === p.id;
          return (
            <button
              key={p.id}
              onClick={() => choose(p.id)}
              disabled={busy !== null}
              style={{
                textAlign: 'left',
                padding: '14px 15px 15px',
                borderRadius: radius.md,
                border: `1.5px solid ${on ? C.accent : C.border}`,
                background: on ? C.accentSoft : C.panel,
                cursor: busy ? 'default' : 'pointer',
                fontFamily: 'inherit',
                opacity: busy && busy !== p.id ? 0.55 : 1,
                transition: 'border-color .15s ease, background .15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span
                  aria-hidden
                  style={{
                    width: 15, height: 15, borderRadius: 5, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1.5px solid ${on ? C.accent : C.borderStrong}`,
                    background: on ? C.accent : 'transparent',
                    color: '#fff', fontSize: 9, lineHeight: 1,
                  }}
                >
                  {on ? '✓' : ''}
                </span>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>
                  {busy === p.id ? 'Applying…' : p.label}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>
                {p.blurb}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
