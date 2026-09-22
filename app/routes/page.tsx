'use client';

/**
 * The order to drive today in.
 *
 * Picks up every job with an address that is scheduled for the chosen day —
 * or, if nothing is scheduled, every open job with an address, because a
 * landscaper's week is often a list in his head rather than dates in a system.
 *
 * Nothing here is stored. Coordinates are looked up once per address and kept
 * in the browser, the order is worked out each time, and the result is a list
 * and a maps link. That means it works before any database change, and it is
 * honest about what it knows: straight lines, not traffic.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { human } from '@/lib/spine/errors';
import {
  geocode, order, summarise, metres, driveMinutes, mapsLink, type Stop,
} from '@/lib/spine/route';
import { Button, C, Card, Empty, Page, SectionLabel } from '@/components/spine/ui';

interface JobRow {
  id: string;
  name: string;
  address: string | null;
  status: string;
  scheduled_start: string | null;
  customers: { name: string } | { name: string }[] | null;
}

const today = () => new Date().toISOString().slice(0, 10);
const custName = (j: JobRow) =>
  (Array.isArray(j.customers) ? j.customers[0]?.name : j.customers?.name) ?? '';

export default function RoutesPage() {
  const { org, vocab } = useOrg();
  const [day, setDay] = useState(today());
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [noPin, setNoPin] = useState<JobRow[]>([]);
  const [start, setStart] = useState<{ lat: number; lng: number } | undefined>();
  const [yard, setYard] = useState('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true); setError('');
    const res = await supabase
      .from('jobs')
      .select('id, name, address, status, scheduled_start, customers(name)')
      .eq('org_id', org.id)
      .not('address', 'is', null)
      .order('scheduled_start', { ascending: true })
      .limit(200);
    if (res.error) setError(human(res.error));
    setJobs((res.data ?? []) as unknown as JobRow[]);
    setLoading(false);
  }, [org?.id]);

  useEffect(() => { load(); }, [load]);

  /** Scheduled for the chosen day, or everything open if nothing is. */
  const forDay = useMemo(() => {
    const scheduled = jobs.filter((j) => (j.scheduled_start ?? '').slice(0, 10) === day);
    if (scheduled.length) return scheduled;
    return jobs.filter((j) => !['done', 'lost', 'void', 'complete'].includes(j.status));
  }, [jobs, day]);

  const anyScheduled = useMemo(
    () => jobs.some((j) => (j.scheduled_start ?? '').slice(0, 10) === day),
    [jobs, day]
  );

  /* Coordinates. One lookup per address, ever — the cache is checked first. */
  const place = useCallback(async () => {
    setPlacing(true); setError('');
    const found: Stop[] = [];
    const missing: JobRow[] = [];

    const origin = yard.trim() ? await geocode(yard) : null;
    setStart(origin ?? undefined);

    for (const j of forDay) {
      const hit = await geocode(j.address as string);
      if (hit) found.push({ id: j.id, name: j.name, address: j.address as string, ...hit, minutes: 45 });
      else missing.push(j);
      // OpenStreetMap asks for no more than one lookup a second.
      await new Promise((r) => setTimeout(r, 1100));
    }

    setStops(order(found, origin ?? undefined));
    setNoPin(missing);
    setPlacing(false);
  }, [forDay, yard]);

  const sum = useMemo(() => summarise(stops, start), [stops, start]);

  return (
    <Page
      title="Route"
      subtitle="The order to drive today in."
      action={
        <Button onClick={place} disabled={placing || !forDay.length}>
          {placing ? 'Working it out…' : stops.length ? 'Work it out again' : 'Work out the route'}
        </Button>
      }
    >
      <div style={{ display: 'grid', gap: 16, maxWidth: 860 }}>
        <Card>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: 12.5, color: C.faint }}>
              Day{' '}
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                style={{ fontFamily: 'inherit', fontSize: 13, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 7, marginLeft: 6 }}
              />
            </label>
            <input
              value={yard}
              onChange={(e) => setYard(e.target.value)}
              placeholder="Start from (the yard, or your house)"
              style={{ flex: 1, minWidth: 220, fontFamily: 'inherit', fontSize: 13, padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 7 }}
            />
          </div>
          <p style={{ fontSize: 12.5, color: C.faint, margin: '10px 0 0' }}>
            {anyScheduled
              ? `${forDay.length} scheduled for this day.`
              : `Nothing scheduled, so this is every open ${vocab.job.toLowerCase()} with an address.`}
          </p>
          {error && <p style={{ fontSize: 12.5, color: C.red, margin: '8px 0 0' }}>{error}</p>}
        </Card>

        {loading ? (
          <Empty>Loading…</Empty>
        ) : !forDay.length ? (
          <Card>
            <Empty hero>
              Nothing with an address to drive to. Put an address on a {vocab.job.toLowerCase()} and it
              shows up here.
            </Empty>
          </Card>
        ) : stops.length ? (
          <>
            <Card>
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <Stat label="Stops" value={String(stops.length)} />
                <Stat label="Driving" value={`${sum.driveMinutes} min`} />
                <Stat label="On site" value={`${Math.round(sum.onSiteMinutes / 60)} hr`} />
                <Stat label="Distance" value={`${(sum.metres / 1609).toFixed(1)} mi`} />
                <span style={{ flex: 1 }} />
                <a
                  href={mapsLink(stops, start)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: C.blue, textDecoration: 'none' }}
                >
                  Open in Maps →
                </a>
              </div>
              <p style={{ fontSize: 12, color: C.faint, margin: '12px 0 0' }}>
                Straight-line distances, so treat the driving time as a floor. On site is a 45 minute
                guess per stop.
              </p>
            </Card>

            <Card>
              <SectionLabel>In this order</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
                {stops.map((s, i) => {
                  const prev = i === 0 ? start : stops[i - 1];
                  const leg = prev ? driveMinutes(metres(prev, s)) : null;
                  const job = jobs.find((j) => j.id === s.id);
                  return (
                    <div key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                      <span style={{ flex: '0 0 auto', width: 22, height: 22, borderRadius: 999, background: C.ink, color: '#fff', fontSize: 11.5, display: 'grid', placeItems: 'center', marginTop: 1 }}>
                        {i + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{s.name}</div>
                        <div style={{ fontSize: 12.5, color: C.faint }}>
                          {job && custName(job) ? `${custName(job)} · ` : ''}{s.address}
                        </div>
                      </div>
                      {leg !== null && (
                        <span style={{ fontSize: 12.5, color: C.faint, whiteSpace: 'nowrap' }}>
                          {leg} min drive
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {noPin.length > 0 && (
              <Card>
                <SectionLabel>Could not be placed ({noPin.length})</SectionLabel>
                <p style={{ fontSize: 12.5, color: C.faint, margin: '6px 0 10px' }}>
                  The address could not be found on a map. Usually a missing town or zip.
                </p>
                {noPin.map((j) => (
                  <div key={j.id} style={{ fontSize: 13, color: C.dim, padding: '4px 0' }}>
                    {j.name}, {j.address}
                  </div>
                ))}
              </Card>
            )}
          </>
        ) : (
          <Card>
            <Empty hero>
              {forDay.length} {forDay.length === 1 ? 'stop' : 'stops'} ready. Hit “Work out the route”.
            </Empty>
          </Card>
        )}
      </div>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: C.faint }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 600, color: C.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}
