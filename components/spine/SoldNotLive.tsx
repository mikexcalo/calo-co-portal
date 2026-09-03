'use client';

/**
 * Sold and not delivered.
 *
 * The reason the module switchboard has a `sold` state at all. Agreeing to
 * build somebody's traffic dashboard is a promise with money against it, and
 * until now the only record of it was a state on a screen you have to go
 * looking for, which is the same as no record.
 *
 * Deliberately not an invoice and not a task. It is the gap between "they
 * paid" and "they can see it", and that gap is where an agency loses trust
 * fastest: the client remembers exactly what they bought.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { MODULE_LABEL, moduleState, type ModuleId } from '@/lib/spine/modules';
import { C, Card, SectionLabel } from './ui';

interface Row {
  id: string;
  name: string;
  modules: Record<string, unknown> | null;
}

interface Owed {
  customerId: string;
  client: string;
  module: string;
  state: 'sold' | 'building';
}

export function SoldNotLive() {
  const router = useRouter();
  const [owed, setOwed] = useState<Owed[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase.from('customers').select('id, name, modules');
    if (res.error) { setLoaded(true); return; }

    const out: Owed[] = [];
    ((res.data ?? []) as Row[]).forEach((c) => {
      Object.entries(c.modules ?? {}).forEach(([key, raw]) => {
        const st = moduleState(raw);
        if (st === 'sold' || st === 'building') {
          out.push({
            customerId: c.id,
            client: c.name,
            // Falls back to the raw key so an unrecognized module still shows.
            // Silently dropping one would hide a promise, which is the whole
            // thing this exists to prevent.
            module: MODULE_LABEL[key as ModuleId] ?? key,
            state: st,
          });
        }
      });
    });

    // Sold before building: nothing started is further from done.
    out.sort((a, b) =>
      a.state === b.state ? a.client.localeCompare(b.client) : a.state === 'sold' ? -1 : 1
    );
    setOwed(out);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!loaded || owed.length === 0) return null;

  return (
    <div style={{ marginBottom: 26 }}>
      <SectionLabel>Sold, not live ({owed.length})</SectionLabel>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {owed.map((o, i) => (
            <div
              key={`${o.customerId}-${o.module}`}
              onClick={() => router.push(`/customers/${o.customerId}?tab=work`)}
              style={{
                display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
                padding: '9px 0', cursor: 'pointer',
                borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.amber, flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: C.text }}>{o.module}</span>
              <span style={{ fontSize: 13, color: C.faint }}>{o.client}</span>
              <span style={{ fontSize: 12, color: C.amber, marginLeft: 'auto' }}>
                {o.state === 'sold' ? 'not started' : 'building'}
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 10, lineHeight: 1.55 }}>
          Paid for and not switched on yet. Set one live from the client&apos;s record once it has
          something in it.
        </div>
      </Card>
    </div>
  );
}
