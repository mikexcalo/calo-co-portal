'use client';

/**
 * "Showing only this client", said out loud.
 *
 * The client record is full of tiles reading Engagements 1, Owed to you
 * $6,800, Pitches 2. Every one of them is a promise that clicking shows you
 * that client's version of the thing. Six of them landed on the unfiltered
 * global screen instead, so pressing Engagements on Global Seafood dropped you
 * into every engagement you have, with nothing on the page saying why the
 * count no longer matched.
 *
 * Two rules this exists to enforce. A filtered screen must say it is filtered,
 * because a list that quietly hides rows is worse than one that shows too
 * many. And getting out has to be one click, because the most common thing
 * after arriving here is wanting the whole picture after all.
 */

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { C } from './ui';

/** The client id in the URL, or null. The single reader of this parameter. */
export function useClientScope(): string | null {
  const params = useSearchParams();
  return params.get('client');
}

export function ClientScope({ name, count }: { name: string | null; count: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const clientId = useClientScope();

  if (!clientId) return null;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        marginBottom: 14, padding: '8px 12px', borderRadius: 7,
        background: C.accentSoft, border: `1px solid ${C.accent}33`,
      }}
    >
      <span style={{ fontSize: 13, color: C.text }}>
        {/* The name, not the id. Arriving to "filtered by
            a3f9-…" tells you a filter exists and not which one. */}
        {name ? `Only ${name}` : 'Only one client'}
      </span>
      <span style={{ fontSize: 12.5, color: C.faint }}>
        {count} {count === 1 ? 'row' : 'rows'}
      </span>
      <button
        onClick={() => router.push(pathname)}
        style={{
          marginLeft: 'auto', background: 'transparent', border: 'none', padding: 0,
          color: C.accent, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Show everything
      </button>
    </div>
  );
}
