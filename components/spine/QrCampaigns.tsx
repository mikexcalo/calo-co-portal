'use client';

/**
 * Telling one printed code from another.
 *
 * A QR code on a yard sign and the same code on a postcard are
 * indistinguishable once they are out in the world. Both send people to the
 * website, and afterwards nobody can say which one paid for itself.
 *
 * A tracked code points at a short address here, which counts the scan and
 * forwards on. The count sits in the same app as the invoices, next to the
 * question it answers, instead of in an analytics dashboard nobody opens.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import {
  Button,
  C,
  Card,
  Empty,
  Field,
  Pill,
  SectionLabel,
  inputStyle,
  shortDate,
} from './ui';

export interface Campaign {
  id: string;
  code: string;
  label: string;
  destination: string;
  medium: string | null;
  scans: number;
  last_scan_at: string | null;
}

/**
 * Where it was printed.
 *
 * A fixed list rather than a free-text box, because the value of this is
 * comparing like with like — and "Yard sign", "yard signs" and "YardSign"
 * typed across three months compare with nothing.
 */
const MEDIUMS = [
  'Yard sign',
  'Direct mail',
  'Business card',
  'Vehicle',
  'Flyer',
  'Email signature',
  'Trade show',
  'Other',
];

/**
 * Short, unambiguous codes.
 *
 * No 0/O/1/I — these get read back off a printed sign by a person trying to
 * work out which campaign they are holding. Eight characters is far more than
 * enough to be unguessable at this scale, and short keeps the printed pattern
 * coarse enough to scan from a moving car.
 */
function makeCode(): string {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
  let out = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function QrCampaigns({
  orgId,
  defaultDestination,
  onSelect,
  selectedCode,
}: {
  orgId: string;
  defaultDestination: string;
  onSelect: (url: string, campaign: Campaign | null) => void;
  selectedCode: string | null;
}) {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [origin, setOrigin] = useState('');
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [medium, setMedium] = useState(MEDIUMS[0]);
  const [destination, setDestination] = useState(defaultDestination);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => setDestination(defaultDestination), [defaultDestination]);

  const load = useCallback(async () => {
    const res = await supabase
      .from('qr_campaigns')
      .select('id, code, label, destination, medium, scans, last_scan_at')
      .eq('org_id', orgId)
      .eq('archived', false)
      .order('created_at', { ascending: false });
    if (!res.error) setRows((res.data ?? []) as Campaign[]);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!label.trim()) return;
    setBusy(true);
    setError(null);
    const dest = /^https?:\/\//i.test(destination.trim())
      ? destination.trim()
      : `https://${destination.trim()}`;
    try {
      new URL(dest);
    } catch {
      setError("That destination doesn't look like a web address.");
      setBusy(false);
      return;
    }

    const code = makeCode();
    const res = await supabase
      .from('qr_campaigns')
      .insert({ org_id: orgId, code, label: label.trim(), medium, destination: dest })
      .select()
      .single();
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }

    setLabel('');
    setAdding(false);
    await load();
    onSelect(`${origin}/q/${code}`, res.data as Campaign);
  };

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <SectionLabel>Tracked codes</SectionLabel>
        <Button variant="ghost" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : 'New tracked code'}
        </Button>
      </div>

      <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.65, margin: '4px 0 12px', maxWidth: 560 }}>
        Make one code per place you print it. Each counts its own scans, so you find out whether
        the yard signs or the postcards brought the calls.
      </p>

      {adding && (
        <Card style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 200px' }}>
              <Field label="What to call it">
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Spring yard signs"
                  autoFocus
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <Field label="Where it's printed">
                <select value={medium} onChange={(e) => setMedium(e.target.value)} style={inputStyle}>
                  {MEDIUMS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <Field label="Where it sends people">
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              style={inputStyle}
            />
          </Field>
          {error && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{error}</div>}
          <Button onClick={create} disabled={busy || !label.trim()}>
            {busy ? 'Creating…' : 'Create and use it'}
          </Button>
        </Card>
      )}

      {rows.length === 0 ? (
        !adding && (
          <Card>
            <Empty>
              No tracked codes yet. The plain code above works fine; a tracked one also tells you
              how often it was scanned.
            </Empty>
          </Card>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((r) => {
            const on = selectedCode === r.code;
            return (
              <div
                key={r.id}
                onClick={() => onSelect(`${origin}/q/${r.code}`, r)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  border: `1px solid ${on ? C.blue : C.border}`,
                  background: on ? C.blueSoft : C.panel,
                  borderRadius: 8,
                  padding: '11px 13px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{r.label}</div>
                  <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>
                    {r.medium ? `${r.medium} · ` : ''}
                    {r.last_scan_at ? `last scanned ${shortDate(r.last_scan_at)}` : 'not scanned yet'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: r.scans > 0 ? C.text : C.faint,
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1.1,
                    }}
                  >
                    {r.scans}
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {r.scans === 1 ? 'scan' : 'scans'}
                  </div>
                </div>
                {on && <Pill tone="blue">Showing</Pill>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
