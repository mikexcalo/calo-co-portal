'use client';

/**
 * Quotes that went quiet and invoices that went past due.
 *
 * Both were already visible somewhere, and both were being missed, because a
 * screen only helps somebody who opens it. This puts them on the one screen
 * everybody opens, with the send attached.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { planAllows } from '@/lib/spine/modules';
import { Button, C, Card, SectionLabel, money } from './ui';

interface Row {
  kind: 'estimate' | 'invoice';
  id: string;
  customer_name: string | null;
  job_name: string | null;
  amount: number;
  days: number;
}

export function FollowUps() {
  const { org } = useOrg();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await supabase.from('follow_ups').select('*');
    if (!res.error) setRows((res.data ?? []) as Row[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!planAllows(org, 'follow_ups') || rows.length === 0) return null;

  const send = async (id?: string) => {
    setBusy(true);
    const res = await fetch('/api/followups/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id } : {}),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setNote(data.message ?? data.error ?? null);
    load();
  };

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <SectionLabel>Worth a nudge ({rows.length})</SectionLabel>
        <Button variant="ghost" onClick={() => send()} disabled={busy}>
          {busy ? 'Sending…' : 'Send them all'}
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((r) => (
          <Card key={r.id}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 170 }}>
                <div style={{ fontSize: 14.5, color: C.text }}>
                  {r.customer_name ?? r.job_name}
                </div>
                <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>
                  {r.kind === 'estimate'
                    ? `Quote sent ${r.days} days ago, no answer`
                    : `Invoice ${r.days} days past due`}
                </div>
              </div>
              <span
                style={{
                  fontSize: 14,
                  color: r.kind === 'invoice' ? C.amber : C.dim,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {money(Number(r.amount))}
              </span>
              <Button variant="ghost" onClick={() => send(r.id)} disabled={busy}>Nudge</Button>
            </div>
          </Card>
        ))}
      </div>

      {note && <div style={{ fontSize: 12.5, color: C.faint, marginTop: 8 }}>{note}</div>}
    </div>
  );
}
