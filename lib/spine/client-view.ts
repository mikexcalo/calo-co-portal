'use client';

/**
 * What the studio knows about a client that the client does not see.
 *
 * Three questions, and a rule that matters more than any of them: every line
 * here is derived from a column that exists and is filled in. Where it cannot
 * be worked out, the line does not appear. Nothing is estimated, rounded up,
 * or phrased so that an absence reads like a zero.
 *
 * The reason is not tidiness. This panel exists so the studio owner can pick
 * up the phone and say something true. A sentence that turns out to have been
 * generated from nothing costs more than the silence it replaced, and it costs
 * it in front of a client.
 */

import supabase from '@/lib/supabase';
import { MODULE_LABEL, ROUTE_MODULE, moduleState, modulesFor } from './modules';
import type { ModuleId } from './modules';
import type { Org } from './types';

/* ---------------------------------------------------------------- who they are */

export interface ClientOwner {
  name: string;
  firstName: string;
  role: string;
}

/** One lookup shared by the three things that ask at the same moment. */
let askingOwner: { org: string; p: Promise<ClientOwner | null> } | null = null;

/**
 * The person whose screen this is.
 *
 * The bar says "exactly as Dana sees it", which is only sayable when there is
 * a Dana. Prefers somebody who is not you, because in a workspace the studio
 * set up and has not handed over yet, the only member IS you, and "exactly as
 * Mike sees it" is not a sentence worth printing. Returns null in that case and
 * every caller drops the name rather than inventing a stand-in.
 *
 * The bar, the sidebar tile and the panel all want it and all mount in the same
 * tick, so callers arriving together share one query. Not cached beyond that:
 * somebody who fixes their own name in settings should see it fixed next time.
 */
export function clientOwner(orgId: string, meId: string | null): Promise<ClientOwner | null> {
  if (askingOwner?.org === orgId) return askingOwner.p;
  const p = resolveOwner(orgId, meId);
  askingOwner = { org: orgId, p };
  return p.finally(() => {
    if (askingOwner?.p === p) askingOwner = null;
  });
}

async function resolveOwner(orgId: string, meId: string | null): Promise<ClientOwner | null> {
  const res = await supabase
    .from('memberships')
    .select('user_id, role, profiles(full_name)')
    .eq('org_id', orgId)
    .in('role', ['owner', 'admin']);

  if (res.error) return null;

  const rows = (res.data ?? []) as Array<{
    user_id: string;
    role: string;
    profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  }>;

  const named = rows
    .map((r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return { userId: r.user_id, role: r.role, name: (p?.full_name ?? '').trim() };
    })
    .filter((r) => r.name.length > 0);

  const them = named.find((r) => r.userId !== meId);
  if (!them) return null;

  return {
    name: them.name,
    firstName: them.name.split(/\s+/)[0],
    role: them.role === 'admin' ? 'Admin' : 'Owner',
  };
}

/* -------------------------------------------------------- are they using it */

export interface Usage {
  lastAt: string | null;
  usedThisWeek: ModuleId[];
  neverOpened: ModuleId[];
}

/** The module a path belongs to, by the same table the nav and the guard use. */
function moduleForPath(section: string): ModuleId | null {
  const path = `/${section}`;
  const hit = ROUTE_MODULE.find(([prefix]) => prefix === path);
  return hit ? hit[1] : null;
}

/**
 * When they were last in, and which parts they have opened.
 *
 * Reads client_usage, which is the only way to see this: access_events is
 * scoped to `user_id = auth.uid()`, so a plain select returns your own page
 * loads and nothing else. The function answers only for a workspace your
 * studio set up, and returns null for anything else — a workspace you merely
 * belong to gives nothing, and the card does not render.
 *
 * "Never opened" is only meaningful once there is something to compare
 * against. With no recorded visits at all, every module is technically
 * unopened, which would put a list of the client's whole product under a
 * heading implying they had ignored it. So it stays empty until they have been
 * seen at least once.
 */
export async function clientUsage(org: Org): Promise<Usage | null> {
  const res = await supabase.rpc('client_usage', { p_org: org.id });
  if (res.error || !res.data) return null;

  const data = res.data as {
    last_at: string | null;
    sections: Array<{ section: string; last_at: string }> | null;
  };

  const sections = data.sections ?? [];
  const seen = new Map<ModuleId, string>();
  for (const s of sections) {
    const id = moduleForPath(s.section);
    if (!id) continue;
    const prev = seen.get(id);
    if (!prev || prev < s.last_at) seen.set(id, s.last_at);
  }

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const live = modulesFor(org);

  const usedThisWeek = [...seen.entries()]
    .filter(([id, at]) => at >= weekAgo && live.has(id))
    .map(([id]) => id);

  const neverOpened = seen.size === 0 ? [] : [...live].filter((id) => !seen.has(id));

  return { lastAt: data.last_at, usedThisWeek, neverOpened };
}

/* ------------------------------------------------------------- worth a word */

/**
 * Things in their data that a person would want mentioning.
 *
 * Each one is a fact with a row behind it, phrased as what is true rather than
 * as advice. An empty list means there is nothing to say, which is a real
 * answer and better than a manufactured one.
 */
export async function worthAWord(org: Org): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10);
  const out: string[] = [];

  const [invoices, hours, jobs] = await Promise.all([
    /* Sent or already marked overdue, past its date, and nobody has nudged. */
    supabase
      .from('job_invoices')
      .select('number, due_on, status, nudged_at, total')
      .eq('org_id', org.id)
      .in('status', ['sent', 'overdue'])
      .is('nudged_at', null),
    /* Billable time that never made it onto an invoice. */
    supabase
      .from('time_entries')
      .select('hours, job_id')
      .eq('org_id', org.id)
      .eq('billable', true)
      .is('invoiced_on', null),
    /* Running work that is not on the calendar. */
    supabase
      .from('jobs')
      .select('name, status, scheduled_start')
      .eq('org_id', org.id)
      .eq('status', 'active')
      .is('scheduled_start', null),
  ]);

  const late = ((invoices.data ?? []) as Array<{
    number: string | null;
    due_on: string | null;
    total: number | null;
  }>).filter((r) => r.due_on && r.due_on < today);

  if (late.length) {
    const worst = late.reduce((a, b) => ((a.due_on ?? '') <= (b.due_on ?? '') ? a : b));
    const days = Math.floor((Date.parse(today) - Date.parse(worst.due_on as string)) / 86400000);
    const named = worst.number ? `${worst.number} is` : 'An invoice is';
    out.push(
      `${named} ${days} day${days === 1 ? '' : 's'} late. No reminder sent.` +
        (late.length > 1 ? ` ${late.length - 1} more like it.` : '')
    );
  }

  const entries = (hours.data ?? []) as Array<{ hours: number | null; job_id: string | null }>;
  const unbilled = entries.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  if (unbilled > 0) {
    const jobCount = new Set(entries.map((r) => r.job_id).filter(Boolean)).size;
    const tidy = Number.isInteger(unbilled) ? String(unbilled) : unbilled.toFixed(1);
    out.push(
      `${tidy} logged hour${unbilled === 1 ? '' : 's'} aren't on any invoice` +
        (jobCount > 1 ? `, across ${jobCount} jobs.` : '.')
    );
  }

  const loose = (jobs.data ?? []) as Array<{ name: string | null }>;
  if (loose.length === 1 && loose[0].name) {
    out.push(`${loose[0].name} is running with no date on the schedule.`);
  } else if (loose.length > 1) {
    out.push(`${loose.length} running jobs have no date on the schedule.`);
  }

  return out;
}

/* -------------------------------------------------------------- their setup */

export interface Setup {
  kind: string;
  live: number;
  /** A module their kind of business could have and does not. */
  nextToSell: string | null;
}

/**
 * What the studio has switched on for them, and the nearest thing left to sell.
 *
 * The count went wrong twice before it went right, and both wrong answers were
 * defensible, which is the interesting part.
 *
 * modulesFor() returns everything the workspace can reach, and for Harbor
 * Light that is 20: Home, Jobs, Customers, Invoices and the rest of a
 * contractor's furniture, which nobody sold and nobody switched on. Intersect
 * that with the studio's own modules and it drops to 4, which is worse — the
 * studio does not use SEO, Reviews or Traffic itself, it SELLS them, so its
 * own module set is the one list that is guaranteed not to contain the things
 * it puts on a client's invoice.
 *
 * What the studio means by "live" is the switch it set on the client-modules
 * screen. That is a state stored per module on the workspace, and counting the
 * ones set to `live` gives 8 for Harbor Light, which is the number the person
 * reading this card would count by hand. The link to that screen is printed
 * one line below, so any other answer is a disagreement in the space of a
 * sentence.
 *
 * "Next to sell" is a module explicitly set to `off`: something the studio
 * looked at and did not give them. A module nobody has ever considered is not
 * a prospect, it is an absence, so when nothing is switched off the line does
 * not appear.
 */
export function clientSetup(org: Org): Setup {
  const overrides = (org.modules ?? {}) as Record<string, unknown>;
  const states = Object.entries(overrides).map(([id, raw]) => [id as ModuleId, moduleState(raw)] as const);

  const live = states.filter(([, st]) => st === 'live');
  const denied = states.find(([, st]) => st === 'off');

  return {
    kind: org.kind === 'rep' ? 'Sales rep' : org.kind === 'agency' ? 'Studio' : 'Service business',
    live: live.length,
    nextToSell: denied ? MODULE_LABEL[denied[0]] ?? null : null,
  };
}

/** How long ago, in words, or null when there is no date to describe. */
export function sinceWords(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (!Number.isFinite(days) || days < 0) return null;
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}
