'use client';

/**
 * Where you are going, and how to get there.
 *
 * The phone home screen is opened standing beside a truck with the engine
 * running, so the first thing on it is the next job and the two things you do
 * about a job before you arrive: drive to it, or ring the person expecting
 * you. Everything else on Home is desk work and moves below.
 *
 * ONLY WHAT THE DATABASE CAN ANSWER
 *
 * The approved design shows a start time and a crew name on this card. There
 * is no time-of-day column on `jobs` and no crew table anywhere, so neither is
 * drawn. A 7:30 invented from a date is the sort of detail somebody sets an
 * alarm by.
 *
 * Directions and Call follow the same rule one level down: the address and the
 * phone number are real columns that are frequently empty, and a Call button
 * that dials nothing is worse than a card with one button on it.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/spine/org';
import {
  callHref,
  directionsHref,
  loadToday,
  longDay,
  weekday,
  type Today as TodayData,
} from '@/lib/spine/today';
import { C, radius, SectionLabel } from './ui';

const DISPLAY = {
  fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
  fontWeight: 700,
  letterSpacing: '-0.5px',
  color: C.text,
} as const;

export function useToday(): TodayData | null {
  const { org } = useOrg();
  const [data, setData] = useState<TodayData | null>(null);

  const load = useCallback(async () => {
    if (!org?.id) { setData(null); return; }
    setData(await loadToday(org.id));
  }, [org?.id]);

  useEffect(() => { load(); }, [load]);
  return data;
}

/** The card at the top of Today. Renders nothing when nothing is booked. */
export function NextJob({ data }: { data: TodayData | null }) {
  const router = useRouter();
  const { vocab } = useOrg();
  const next = data?.next;

  if (!data) return null;

  if (!next) {
    /*
      A statement of fact with the next step in it, which is the house rule
      for empty states. Nothing is scheduled is a real answer - most days for
      a small business genuinely have nothing booked - so it says so and
      points at the one screen where that changes.
    */
    return (
      <div
        style={{
          border: `1px solid ${C.border}`, borderRadius: radius.lg, background: C.panel,
          padding: '18px 16px', marginBottom: 22,
        }}
      >
        <div style={{ ...DISPLAY, fontSize: 19, marginBottom: 4 }}>Nothing scheduled</div>
        <div style={{ fontSize: 14, color: C.faint, lineHeight: 1.5 }}>
          Put a date on a {vocab.job.toLowerCase()} and it shows up here.
        </div>
        <button
          onClick={() => router.push('/jobs')}
          style={{
            marginTop: 12, minHeight: 48, padding: '0 18px', borderRadius: 999,
            border: `1px solid ${C.border}`, background: 'transparent', color: C.text,
            fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Open {vocab.jobPlural.toLowerCase()}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 14, color: C.faint, marginBottom: 2 }}>
        {longDay(next.scheduledStart)}
      </div>
      <div style={{ ...DISPLAY, fontSize: 27, marginBottom: 12 }}>
        Next: {next.customerName ?? next.name}
      </div>

      <div
        style={{
          border: `1px solid ${C.border}`, borderRadius: radius.lg, background: C.panel,
          padding: '16px 16px 14px',
        }}
      >
        <div style={{ ...DISPLAY, fontSize: 19, marginBottom: 3 }}>{next.name}</div>
        {/* The address, where there is one. No placeholder standing in for a
            field nobody filled in. */}
        {next.address && (
          <div style={{ fontSize: 14, color: C.faint, marginBottom: 12 }}>{next.address}</div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: next.address ? 0 : 12 }}>
          {next.address && (
            <a
              href={directionsHref(next.address)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...action,
                background: C.text, color: C.panel, border: `1px solid ${C.text}`,
              }}
            >
              Directions
            </a>
          )}
          {next.phone && (
            <a href={callHref(next.phone)} style={action}>
              Call
            </a>
          )}
          <button
            onClick={() => router.push(`/jobs/${next.id}`)}
            style={{ ...action, cursor: 'pointer' }}
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}

const action: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  // 48px, the floor for anything touched on this screen.
  minHeight: 48,
  padding: '0 20px',
  borderRadius: 999,
  border: `1px solid ${C.border}`,
  background: 'transparent',
  color: C.text,
  fontSize: 15,
  fontWeight: 500,
  textDecoration: 'none',
  fontFamily: 'inherit',
};

/** The rest of the week under Needs you. Nothing when there is nothing. */
export function LaterThisWeek({ data }: { data: TodayData | null }) {
  const router = useRouter();
  if (!data?.later.length) return null;

  return (
    <div style={{ marginBottom: 26 }}>
      <SectionLabel>Later this week</SectionLabel>
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        {data.later.map((j) => (
          <button
            key={j.id}
            onClick={() => router.push(`/jobs/${j.id}`)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              width: '100%', minHeight: 56, padding: '10px 2px', textAlign: 'left',
              background: 'transparent', border: 'none',
              borderBottom: `1px solid ${C.border}`, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 15.5, color: C.text, minWidth: 0 }}>
              {weekday(j.scheduledStart)} · {j.name}
            </span>
            <span style={{ fontSize: 14, color: C.faint, flexShrink: 0 }}>
              {j.customerName ?? ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
