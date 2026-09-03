/**
 * Calendar feed.
 *
 * A schedule that only exists inside Nautilus is a second place to look,
 * which means it's a place people stop looking. This publishes jobs as a feed
 * a phone calendar subscribes to, so scheduled work shows up in the calendar
 * someone already uses.
 *
 * One-way and read-only: Nautilus to the calendar, never back. That's the
 * whole reason it's cheap — no OAuth, no per-user setup, no reconciling edits
 * made in two places.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PRODUCT } from '@/lib/brand';

export const runtime = 'nodejs';

/** Escape per RFC 5545 — commas and semicolons are field separators. */
function esc(s: string): string {
  return (s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** All-day events use DATE values, and DTEND is exclusive. */
function dateOnly(d: string): string {
  return d.slice(0, 10).replace(/-/g, '');
}
function dayAfter(d: string): string {
  const dt = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Fold long lines at 75 octets, as the spec requires. */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 73) {
    parts.push(' ' + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  if (rest) parts.push(' ' + rest);
  return parts.join('\r\n');
}

/**
 * Wrapped, because a calendar app is not a person.
 *
 * This feed is polled every few minutes, forever, by software that shows a
 * failure as a permanently broken subscription with no explanation. An
 * unhandled throw here also serves a stack trace to whoever holds the link,
 * and the link is deliberately given to people with no account.
 */
export async function GET(req: NextRequest, ctx: { params: { token: string } }) {
  try {
    return await feed(ctx);
  } catch {
    return new NextResponse('Temporarily unavailable', { status: 503 });
  }
}

async function feed({ params }: { params: { token: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new NextResponse('Not configured', { status: 500 });

  const db = createClient(url, key, { auth: { persistSession: false } });

  // Strip any .ics a calendar client appends.
  const token = params.token.replace(/\.ics$/i, '');

  const { data: org } = await db
    .from('orgs')
    .select('id, name')
    .eq('calendar_token', token)
    .maybeSingle();

  if (!org) return new NextResponse('Not found', { status: 404 });

  const { data: jobs } = await db
    .from('jobs')
    .select('id, name, address, status, scheduled_start, scheduled_end, customer:customers(name)')
    .eq('org_id', org.id)
    .not('scheduled_start', 'is', null)
    .in('status', ['won', 'active', 'complete']);

  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${PRODUCT}//Jobs//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(org.name)} jobs`,
    'X-WR-TIMEZONE:America/Chicago',
    // Ask clients to re-poll hourly rather than once a day.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const j of jobs ?? []) {
    const start = j.scheduled_start as string;
    const end = (j.scheduled_end as string) || start;
    // Supabase types an embedded relation as an array; at runtime a
    // many-to-one comes back as a single object. Handle both.
    const rel = j.customer as unknown as { name: string } | { name: string }[] | null;
    const customer = Array.isArray(rel) ? rel[0]?.name : rel?.name;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${j.id}@nautilus`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dateOnly(start)}`,
      `DTEND;VALUE=DATE:${dayAfter(end)}`,
      fold(`SUMMARY:${esc(j.name as string)}`),
      ...(j.address ? [fold(`LOCATION:${esc(j.address as string)}`)] : []),
      ...(customer ? [fold(`DESCRIPTION:${esc(customer)}`)] : []),
      `STATUS:${j.status === 'complete' ? 'CONFIRMED' : 'CONFIRMED'}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');

  // Trailing CRLF matters: some parsers drop an unterminated final line.
  return new NextResponse(lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${org.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-jobs.ics"`,
      'Cache-Control': 'public, max-age=900',
    },
  });
}
