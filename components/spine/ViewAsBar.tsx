'use client';

/**
 * A standing reminder that you are not looking at your own screen.
 *
 * Pinned to the top and impossible to miss, because the failure mode of a
 * preview mode is forgetting you are in one. Somebody reporting that a button
 * has vanished, when they turned it off themselves an hour ago, is a bug
 * report that costs an afternoon.
 */

import { useViewAs } from '@/lib/spine/viewas';
import { C } from './ui';

export function ViewAsBar() {
  const { viewAs, setViewAs } = useViewAs();
  if (!viewAs) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 130,
        background: C.text, color: C.panel,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '7px 16px', fontSize: 12.5,
      }}
    >
      <span style={{ fontWeight: 600 }}>Seeing this as {viewAs.label}</span>
      <span style={{ opacity: 0.7, flex: 1, minWidth: 200 }}>
        What they would be shown. Your own access is unchanged, so this is not a test of what they
        can reach.
      </span>
      <button
        onClick={() => setViewAs(null)}
        style={{
          background: 'transparent', border: `1px solid rgba(255,255,255,.4)`,
          color: C.panel, borderRadius: 999, padding: '3px 13px',
          fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}
      >
        Back to my view
      </button>
    </div>
  );
}
