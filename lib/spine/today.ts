'use client';

/**
 * What is happening today, and what is happening after it.
 *
 * The phone home screen is the one somebody opens standing beside a truck, so
 * it answers one question - where am I going and can I get there - and then
 * gets out of the way.
 *
 * NOTHING IS INFERRED
 *
 * The approved design shows a start time and a crew name. Neither exists:
 * `jobs` carries `scheduled_start` and `scheduled_end` as dates, and there is
 * no time-of-day column and no crew anywhere in the schema. So they are not
 * rendered. A 7:30 AM invented from a date is the kind of detail somebody
 * plans a morning around, and being wrong about it once costs more than never
 * having shown it.
 *
 * Directions and Call are the same rule: the address and the phone number are
 * real columns, they are often empty, and a button that opens an empty map is
 * worse than no button.
 */

import supabase from '@/lib/supabase';

export interface ScheduledJob {
  id: string;
  name: string;
  /** The job's own address. Null where nobody filled it in. */
  address: string | null;
  scheduledStart: string;
  customerId: string | null;
  customerName: string | null;
  /** The customer's number, for the Call button. Null where there is none. */
  phone: string | null;
}

export interface Today {
  /** The soonest job scheduled today or later. Null when nothing is booked. */
  next: ScheduledJob | null;
  /** Everything else inside the next seven days, soonest first. */
  later: ScheduledJob[];
}

/** Local date, not UTC: "today" is where the phone is, not where the server is. */
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DONE = ['complete', 'lost', 'cancelled'];

export async function loadToday(orgId: string): Promise<Today> {
  const from = localDay();
  const to = localDay(new Date(Date.now() + 7 * 86400000));

  const res = await supabase
    .from('jobs')
    .select('id, name, address, scheduled_start, customer_id, status')
    .eq('org_id', orgId)
    .not('scheduled_start', 'is', null)
    .gte('scheduled_start', from)
    .lte('scheduled_start', to)
    .order('scheduled_start', { ascending: true });

  const rows = ((res.data ?? []) as Array<Record<string, unknown>>).filter(
    (r) => !DONE.includes(String(r.status))
  );
  if (!rows.length) return { next: null, later: [] };

  /* One query for the customers on those jobs rather than one each: the
     phone number is the only reason we want them, and there are never many. */
  const ids = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
  const people = new Map<string, { name: string; phone: string | null }>();
  if (ids.length) {
    const cust = await supabase.from('customers').select('id, name, phone').in('id', ids);
    for (const c of (cust.data ?? []) as Array<Record<string, unknown>>) {
      people.set(String(c.id), {
        name: String(c.name),
        phone: (c.phone as string | null) || null,
      });
    }
  }

  const shape = (r: Record<string, unknown>): ScheduledJob => {
    const customerId = r.customer_id ? String(r.customer_id) : null;
    const who = customerId ? people.get(customerId) : undefined;
    return {
      id: String(r.id),
      name: String(r.name),
      address: (r.address as string | null) || null,
      scheduledStart: String(r.scheduled_start),
      customerId,
      customerName: who?.name ?? null,
      phone: who?.phone ?? null,
    };
  };

  return { next: shape(rows[0]), later: rows.slice(1).map(shape) };
}

/**
 * A maps link that works on whatever they are holding.
 *
 * The `?q=` form of Google Maps is handled by iOS, Android and every desktop
 * browser, and on a phone with the app installed it opens the app. Building
 * a platform-specific `maps://` URL means sniffing the user agent and getting
 * it wrong for somebody.
 */
export const directionsHref = (address: string): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

/** Digits only: a href with spaces and brackets in it does not dial. */
export const callHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** "Mon" / "Wed", for the week list. Parsed as local, not UTC. */
export function weekday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
}

/** "Monday, Sep 28", for the line above the next job. */
export function longDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
