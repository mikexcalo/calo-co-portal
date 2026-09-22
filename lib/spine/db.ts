/**
 * Nautilus spine — data access.
 *
 * Deliberately NOT lib/database.ts. No global mutable cache, no singleton to
 * keep in sync, no hardcoded company. Every function is a plain query that
 * returns what it read. Components own their own state.
 *
 * The one rule: never loop queries over a list. If a page needs totals across
 * many jobs, read the job_ledger view — the database does the aggregation in
 * a single round trip.
 */

import supabase from '@/lib/supabase';
import type {
  BillableJob,
  Cost,
  CostKind,
  DocumentRecord,
  DocumentStatus,
  Estimate,
  EstimateLine,
  Job,
  JobInvoice,
  JobInvoiceLine,
  JobLedger,
  JobStatus,
  JobWithCustomer,
  Customer,
  LineKind,
  Org,
  TimeEntry,
} from './types';

/** Supabase returns numerics as strings in some drivers. Normalize once. */
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error('No data returned');
  return res.data;
}

// ---------------------------------------------------------------------------
// Org + identity
// ---------------------------------------------------------------------------

/**
 * The workspace you are standing in, as an id.
 *
 * Every screen already trusted the row filter to do this, and the row filter
 * answers a different question: it returns every business you belong to, not
 * the one you switched to. For somebody in one workspace those are the same
 * set and nothing looked wrong. For the person running the agency they are
 * not, and Jobs, Customers, the week ahead and the home screen were all
 * quietly showing four clients' work stacked on top of each other.
 *
 * Returns null when there is no active workspace, which filters to nothing —
 * an empty screen is the right way to be wrong here.
 */
let known: { user: string; org: string | null } | null = null;
/** One lookup shared by everything that asks while it is in flight. */
let asking: Promise<string | null> | null = null;

export async function orgNow(): Promise<string | null> {
  if (known) return known.org;
  if (asking) return asking;
  asking = (async () => {
    /*
      getSession, not getUser.

      getUser revalidates the token against the auth server — a network round
      trip, every call. Twenty-eight reads were made workspace-aware in one go
      and every one of them started with that round trip, so a screen with six
      queries grew six extra hops before any of them ran. That is the whole of
      why the app got slow this afternoon.

      getSession reads the token already in the browser. It is not a weaker
      check: nothing here is a permission decision. The row filter is what
      keeps a workspace private, and it is enforced in the database against the
      real token no matter what this returns.
    */
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) { asking = null; return null; }
    const profile = await supabase
      .from('profiles')
      .select('active_org_id')
      .eq('id', uid)
      .maybeSingle();
    known = { user: uid, org: (profile.data?.active_org_id as string | undefined) ?? null };
    asking = null;
    return known.org;
  })();
  return asking;
}

/** Called by the switcher. Without this the old workspace stays cached. */
export function forgetOrg(): void {
  known = null;
  asking = null;
  fullOrg = null;
  fullAsking = null;
}

/**
 * The org you're currently looking at. Reads active_org_id, which the
 * database only honors when a matching membership exists — so this can
 * never return an org you don't belong to.
 */
/*
  Three round trips, on eleven screens, on every load.

  This asked the auth server to revalidate the token, then read the profile to
  find the active workspace, then read the workspace — in series, because each
  answer is the next question's input. Eleven pages call it while they load,
  and none of them needed it: orgNow() already holds the id and OrgProvider
  already holds the row.

  So it is cached exactly like orgNow, shares that function's in-flight
  promise, and is cleared by the same forgetOrg() that runs on a switch. The
  auth hop is gone entirely — the id comes from orgNow, which reads the session
  out of memory.

  This is the same lesson as the note on orgNow above, which calls the auth
  round trip the whole reason the app got slow one afternoon. It was fixed
  there and left standing here.
*/
let fullOrg: Org | null = null;
let fullAsking: Promise<Org | null> | null = null;

export async function getCurrentOrg(): Promise<Org | null> {
  if (fullOrg) return fullOrg;
  if (fullAsking) return fullAsking;

  fullAsking = (async () => {
    const orgId = await orgNow();
    if (!orgId) return null;

    const org = await supabase.from('orgs').select('*').eq('id', orgId).maybeSingle();
    if (org.error) throw new Error(org.error.message);
    fullOrg = (org.data as Org | null) ?? null;
    return fullOrg;
  })();

  try {
    return await fullAsking;
  } finally {
    fullAsking = null;
  }
}

/**
 * The brand for the current business.
 *
 * Read this anywhere the app renders something a client sees — invoices,
 * estimates, emails. A brand kit that only lives on its own page is a
 * scrapbook; the point is that everything downstream picks it up.
 */
export interface Brand {
  colors: Array<{ name: string; hex: string; role?: string }>;
  fontHeading: string;
  fontBody: string;
  logoLight: string;
  logoDark: string;
  logos: string[];
  voice: string;
}

export const EMPTY_BRAND: Brand = {
  colors: [], fontHeading: '', fontBody: '',
  logoLight: '', logoDark: '', logos: [], voice: '',
};

export function brandOf(org: Org | null): Brand {
  const raw = (org?.settings as Record<string, unknown> | undefined)?.brand;
  return { ...EMPTY_BRAND, ...((raw as Partial<Brand>) ?? {}) };
}

/** The color to use for accents on client-facing documents. */
export function brandAccent(org: Org | null, fallback = '#111113'): string {
  const b = brandOf(org);
  return b.colors.find((c) => /primary/i.test(c.role ?? ''))?.hex
    ?? b.colors[0]?.hex
    ?? fallback;
}

/** Update the org's own settings — rates, markup, tax. */
export async function updateOrg(id: string, patch: Partial<Org>): Promise<Org> {
  return unwrap(
    await supabase.from('orgs').update(patch).eq('id', id).select().single()
  ) as Org;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function listCustomers(): Promise<Customer[]> {
  return unwrap(
    await supabase.from('customers').select('*').eq('org_id', await orgNow()).order('name', { ascending: true })
  ) as Customer[];
}

export async function createCustomer(
  orgId: string,
  input: Partial<Customer> & { name: string }
): Promise<Customer> {
  return unwrap(
    await supabase
      .from('customers')
      // stage first, so a caller that cares still wins. The column default is
      // a value its own constraint rejects; see 20261026.
      .insert({ stage: 'noticed', ...input, org_id: orgId })
      .select()
      .single()
  ) as Customer;
}

// ---------------------------------------------------------------------------
// Jobs — the spine
// ---------------------------------------------------------------------------

export async function listJobs(statuses?: JobStatus[]): Promise<JobWithCustomer[]> {
  let q = supabase
    .from('jobs')
    .select('*, customer:customers(id, name)')
    .eq('org_id', await orgNow())
    .order('updated_at', { ascending: false });

  if (statuses?.length) q = q.in('status', statuses);

  return unwrap(await q) as JobWithCustomer[];
}

export async function getJob(id: string): Promise<JobWithCustomer | null> {
  const res = await supabase
    .from('jobs')
    .select('*, customer:customers(id, name)')
    .eq('id', id)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data as JobWithCustomer | null;
}

export async function createJob(
  orgId: string,
  input: Partial<Job> & { name: string }
): Promise<Job> {
  return unwrap(
    await supabase
      .from('jobs')
      .insert({ ...input, org_id: orgId })
      .select()
      .single()
  ) as Job;
}

export async function updateJob(id: string, patch: Partial<Job>): Promise<Job> {
  return unwrap(
    await supabase.from('jobs').update(patch).eq('id', id).select().single()
  ) as Job;
}

/**
 * Money for every job in one query. This is what the old financials page
 * needed and instead did with a loop of one request per client.
 */
export async function listJobLedger(): Promise<JobLedger[]> {
  const rows = unwrap(await supabase.from('job_ledger').select('*').eq('org_id', await orgNow())) as JobLedger[];
  return rows.map((r) => ({
    ...r,
    hours_logged: num(r.hours_logged),
    labor_value: num(r.labor_value),
    unbilled_labor: num(r.unbilled_labor),
    cost_total: num(r.cost_total),
    unbilled_cost: num(r.unbilled_cost),
    invoiced_total: num(r.invoiced_total),
    collected: num(r.collected),
    estimate_total: num(r.estimate_total),
    margin_to_date: num(r.margin_to_date),
  }));
}

export async function getJobLedger(jobId: string): Promise<JobLedger | null> {
  const res = await supabase
    .from('job_ledger')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  if (!res.data) return null;
  const r = res.data as JobLedger;
  return {
    ...r,
    hours_logged: num(r.hours_logged),
    labor_value: num(r.labor_value),
    unbilled_labor: num(r.unbilled_labor),
    cost_total: num(r.cost_total),
    unbilled_cost: num(r.unbilled_cost),
    invoiced_total: num(r.invoiced_total),
    collected: num(r.collected),
    estimate_total: num(r.estimate_total),
    margin_to_date: num(r.margin_to_date),
  };
}

// ---------------------------------------------------------------------------
// Estimates
// ---------------------------------------------------------------------------

export async function listEstimates(jobId: string): Promise<Estimate[]> {
  return unwrap(
    await supabase
      .from('estimates')
      .select('*')
      .eq('job_id', jobId)
      .order('version', { ascending: false })
  ) as Estimate[];
}

export async function getEstimateLines(estimateId: string): Promise<EstimateLine[]> {
  return unwrap(
    await supabase
      .from('estimate_lines')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('position', { ascending: true })
  ) as EstimateLine[];
}

export async function createEstimate(
  orgId: string,
  jobId: string,
  lines: Array<Omit<EstimateLine, 'id' | 'estimate_id' | 'created_at' | 'selected'>>,
  /**
   * What the price covers, what it does not, and anything else the client
   * should read. Optional so existing callers are unaffected, but this is the
   * part that settles the week six argument, not the number.
   */
  terms?: { notes?: string; scopeIn?: string[]; scopeOut?: string[] }
): Promise<Estimate> {
  const existing = await listEstimates(jobId);
  const version = existing.length ? Math.max(...existing.map((e) => e.version)) + 1 : 1;
  const total = lines.reduce((sum, l) => sum + num(l.total), 0);

  const estimate = unwrap(
    await supabase
      .from('estimates')
      .insert({
        org_id: orgId,
        job_id: jobId,
        version,
        total,
        notes: terms?.notes?.trim() || null,
        scope_in: terms?.scopeIn ?? [],
        scope_out: terms?.scopeOut ?? [],
      })
      .select()
      .single()
  ) as Estimate;

  if (lines.length) {
    const res = await supabase
      .from('estimate_lines')
      .insert(lines.map((l, i) => ({ ...l, estimate_id: estimate.id, position: i })));
    if (res.error) throw new Error(res.error.message);
  }

  // Any prior estimate is now history, not a competing number.
  if (existing.length) {
    /**
     * Checked, because the failure is invisible and expensive.
     *
     * If this does not land, the job keeps two estimates that both believe
     * they are current, and the next invoice is built from whichever one is
     * read first.
     */
    const superseded = await supabase
      .from('estimates')
      .update({ status: 'superseded' })
      .eq('job_id', jobId)
      .neq('id', estimate.id)
      .in('status', ['draft', 'sent'])
    if (superseded.error) throw new Error(superseded.error.message);
  }

  return estimate;
}

export async function updateEstimate(
  id: string,
  patch: Partial<Estimate>
): Promise<Estimate> {
  return unwrap(
    await supabase.from('estimates').update(patch).eq('id', id).select().single()
  ) as Estimate;
}

/**
 * Accepting an estimate moves the job forward. For fixed-price this locks the
 * number that will be billed; for T&M it stays a forecast and actuals decide
 * the invoice.
 */
export async function acceptEstimate(estimate: Estimate): Promise<void> {
  const res = await Promise.all([
    supabase
      .from('estimates')
      .update({ status: 'accepted', decided_at: new Date().toISOString() })
      .eq('id', estimate.id),
    supabase.from('jobs').update({ status: 'won' }).eq('id', estimate.job_id),
  ]);
  const failed = res.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export async function declineEstimate(estimate: Estimate): Promise<void> {
  const res = await Promise.all([
    supabase
      .from('estimates')
      .update({ status: 'declined', decided_at: new Date().toISOString() })
      .eq('id', estimate.id),
    supabase.from('jobs').update({ status: 'lost' }).eq('id', estimate.job_id),
  ]);
  const failed = res.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export async function deleteEstimate(id: string): Promise<void> {
  const res = await supabase.from('estimates').delete().eq('id', id);
  if (res.error) throw new Error(res.error.message);
}

// ---------------------------------------------------------------------------
// Time entries — labor actuals
// ---------------------------------------------------------------------------

export async function listTimeEntries(jobId: string): Promise<TimeEntry[]> {
  const rows = unwrap(
    await supabase
      .from('time_entries')
      .select('*')
      .eq('job_id', jobId)
      .order('worked_on', { ascending: false })
  ) as TimeEntry[];
  return rows.map((r) => ({ ...r, hours: num(r.hours), rate: num(r.rate) }));
}

/**
 * A DRAFT ABSORBS NEW WORK.
 *
 * Logging an hour against a job that already has a draft used to do nothing
 * to that draft. The hour sat unbilled, the cron skipped the job because an
 * invoice already existed for the month, and the only way to get the work
 * onto the bill was to void the invoice and draft it again — which renumbers
 * it, so a document somebody may already have looked at changes its name.
 *
 * Four steps ending in a voided invoice, for the single most ordinary thing
 * an agency does: bill another hour.
 *
 * A draft has not been sent. Nobody has seen it and nobody owes anything on
 * it, so there is no reason it cannot simply be right. It rebuilds from the
 * actuals every time they change, keeps its number, and stops the moment it
 * is approved or sent.
 *
 * Lines with no source are left alone. The monthly run writes the recurring
 * fees with their own period naming and pro-rating, and rebuilding those from
 * terms here would quietly overwrite arithmetic that was correct. This owns
 * the lines that came from hours and receipts. Nothing else.
 *
 * Returns the updated invoice, or null when the job has no open draft — in
 * which case the work is unbilled and the next run will pick it up, which is
 * also correct.
 */
/**
 * Everywhere an hour could go, with what it would do to the bill.
 *
 * Logging time meant navigating to a client, into a job, finding the hours
 * panel and filling in a rate — four screens deep, for the thing an agency
 * does more often than anything else. This is the list behind a logger that
 * lives in the top bar instead: every open job, who it belongs to, the rate
 * already agreed, and the draft it would land on.
 *
 * The rate is read, never guessed. What the client agreed beats what the job
 * was set up with, which beats the workspace default. If all three are unset
 * it comes back zero and the logger says so rather than inventing a number.
 */
export async function listBillableJobs(orgId: string): Promise<BillableJob[]> {
  const [jobRes, custRes, termRes, invRes] = await Promise.all([
    supabase.from('jobs').select('id, name, customer_id, labor_rate, updated_at')
      .eq('org_id', orgId).in('status', ['lead', 'estimating', 'won', 'active'])
      .order('updated_at', { ascending: false }),
    supabase.from('customers').select('id, name').eq('org_id', orgId),
    supabase.from('customer_terms').select('customer_id, hourly_rate').eq('org_id', orgId),
    supabase.from('job_invoices').select('job_id, number, total').eq('org_id', orgId).eq('status', 'draft'),
  ]);
  for (const r of [jobRes, custRes, termRes, invRes]) if (r.error) throw new Error(r.error.message);

  const org = (await supabase.from('orgs').select('default_labor_rate').eq('id', orgId).maybeSingle()).data as
    { default_labor_rate: number | null } | null;
  const fallback = num(org?.default_labor_rate);

  const names = new Map((custRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
  const agreed = new Map(
    (termRes.data ?? []).map((t: { customer_id: string; hourly_rate: number | null }) => [t.customer_id, num(t.hourly_rate)])
  );
  const drafts = new Map(
    (invRes.data ?? []).map((i: { job_id: string; number: string; total: number }) => [i.job_id, i])
  );

  return (jobRes.data ?? []).map((j: Record<string, unknown>) => {
    const customerId = j.customer_id ? String(j.customer_id) : null;
    const draft = drafts.get(String(j.id));
    return {
      id: String(j.id),
      name: String(j.name),
      customer_id: customerId,
      customer_name: customerId ? names.get(customerId) ?? null : null,
      rate: (customerId ? agreed.get(customerId) : 0) || num(j.labor_rate) || fallback,
      draft_number: draft ? String(draft.number) : null,
      draft_total: draft ? num(draft.total) : null,
    };
  });
}

export async function syncOpenDraft(orgId: string, jobId: string): Promise<JobInvoice | null> {
  const draft = (
    await supabase
      .from('job_invoices')
      .select('*')
      .eq('org_id', orgId)
      .eq('job_id', jobId)
      .eq('status', 'draft')
      .order('issued_on', { ascending: false })
      .limit(1)
      .maybeSingle()
  ).data as JobInvoice | null;
  if (!draft) return null;

  // Claim anything still unbilled. Same conditional update the original draft
  // uses, so two of these racing cannot both claim the same hour.
  const claim = await Promise.all([
    supabase.from('time_entries').update({ invoiced_on: draft.id })
      .eq('job_id', jobId).eq('billable', true).is('invoiced_on', null),
    supabase.from('costs').update({ invoiced_on: draft.id })
      .eq('job_id', jobId).eq('billable', true).is('invoiced_on', null),
  ]);
  for (const r of claim) if (r.error) throw new Error(r.error.message);

  // Everything this invoice now holds, including whatever it already had.
  const [timeRes, costRes, lineRes] = await Promise.all([
    supabase.from('time_entries').select('*').eq('invoiced_on', draft.id).order('worked_on'),
    supabase.from('costs').select('*').eq('invoiced_on', draft.id).order('purchased_on'),
    supabase.from('job_invoice_lines').select('*').eq('invoice_id', draft.id).order('position'),
  ]);
  for (const r of [timeRes, costRes, lineRes]) if (r.error) throw new Error(r.error.message);

  const time = (timeRes.data ?? []) as TimeEntry[];
  const costs = (costRes.data ?? []) as Cost[];
  const existing = (lineRes.data ?? []) as JobInvoiceLine[];

  /* The fees and anything typed by hand. Not ours to rewrite. */
  const kept = existing.filter((l) => !l.source_time_entry_id && !l.source_cost_id);
  const job = await getJob(jobId);

  const rebuilt = [
    ...time.map((e) => ({
      kind: 'labor',
      description: e.description || `Labor${e.worker_name ? ` (${e.worker_name})` : ''} (${e.worked_on})`,
      qty: num(e.hours),
      unit: 'hr',
      unit_price: num(e.rate),
      total: round2(num(e.hours) * num(e.rate)),
      source_time_entry_id: e.id,
      source_cost_id: null,
    })),
    ...costs.map((c) => {
      const markup = num(c.markup_pct ?? job?.material_markup_pct ?? 0);
      const billed = round2(num(c.amount) * (1 + markup / 100));
      return {
        kind: c.kind === 'subcontractor' ? 'subcontractor' : 'material',
        description: c.description || c.vendor || 'Materials',
        qty: 1,
        unit: null,
        unit_price: billed,
        total: billed,
        source_time_entry_id: null,
        source_cost_id: c.id,
      };
    }),
  ];

  const sourced = existing.filter((l) => l.source_time_entry_id || l.source_cost_id);
  if (sourced.length) {
    const del = await supabase.from('job_invoice_lines').delete()
      .in('id', sourced.map((l) => l.id));
    if (del.error) throw new Error(del.error.message);
  }

  if (rebuilt.length) {
    const ins = await supabase.from('job_invoice_lines').insert(
      rebuilt.map((l, i) => ({ ...l, invoice_id: draft.id, position: kept.length + i }))
    );
    if (ins.error) throw new Error(ins.error.message);
  }

  const subtotal = round2(
    kept.reduce((s, l) => s + num(l.total), 0) + rebuilt.reduce((s, l) => s + l.total, 0)
  );
  const taxAmount = round2(subtotal * (num(draft.tax_rate) / 100));
  const dates = [...time.map((e) => e.worked_on), ...costs.map((c) => c.purchased_on)].sort();

  return unwrap(
    await supabase
      .from('job_invoices')
      .update({
        subtotal,
        tax_amount: taxAmount,
        total: round2(subtotal + taxAmount),
        period_start: dates[0] ?? draft.period_start,
        period_end: dates[dates.length - 1] ?? draft.period_end,
      })
      .eq('id', draft.id)
      .select()
      .single()
  ) as JobInvoice;
}

export async function createTimeEntry(
  orgId: string,
  jobId: string,
  input: { worked_on: string; hours: number; rate: number; worker_name?: string; description?: string }
): Promise<TimeEntry> {
  const row = unwrap(
    await supabase
      .from('time_entries')
      .insert({ ...input, org_id: orgId, job_id: jobId })
      .select()
      .single()
  ) as TimeEntry;
  // Onto the open draft, if there is one. See syncOpenDraft.
  await syncOpenDraft(orgId, jobId);
  return row;
}

export async function deleteTimeEntry(id: string): Promise<void> {
  /* Read it first: once it is gone there is no way to know which job's draft
     needs rebuilding, and a deleted hour that stays on the invoice is worse
     than one that was never logged. */
  const row = (
    await supabase.from('time_entries').select('org_id, job_id').eq('id', id).maybeSingle()
  ).data as { org_id: string; job_id: string } | null;
  const res = await supabase.from('time_entries').delete().eq('id', id);
  if (res.error) throw new Error(res.error.message);
  if (row) await syncOpenDraft(row.org_id, row.job_id);
}

// ---------------------------------------------------------------------------
// Costs — material actuals, usually born from a receipt
// ---------------------------------------------------------------------------

export async function listCosts(jobId: string): Promise<Cost[]> {
  const rows = unwrap(
    await supabase
      .from('costs')
      .select('*')
      .eq('job_id', jobId)
      .order('purchased_on', { ascending: false })
  ) as Cost[];
  return rows.map((r) => ({ ...r, amount: num(r.amount) }));
}

export async function createCost(
  orgId: string,
  jobId: string,
  input: {
    amount: number;
    purchased_on: string;
    kind?: CostKind;
    vendor?: string;
    description?: string;
    document_id?: string;
    markup_pct?: number;
  }
): Promise<Cost> {
  const row = unwrap(
    await supabase
      .from('costs')
      .insert({ ...input, org_id: orgId, job_id: jobId })
      .select()
      .single()  ) as Cost;
  await syncOpenDraft(orgId, jobId);
  return row;
}

export async function deleteCost(id: string): Promise<void> {
  /* Same as deleting an hour: read the job first, or the draft keeps a line
     for a receipt that no longer exists. */
  const row = (
    await supabase.from('costs').select('org_id, job_id').eq('id', id).maybeSingle()
  ).data as { org_id: string; job_id: string } | null;
  const res = await supabase.from('costs').delete().eq('id', id);
  if (res.error) throw new Error(res.error.message);
  if (row) await syncOpenDraft(row.org_id, row.job_id);
}


// ---------------------------------------------------------------------------
// Documents — the shoebox
// ---------------------------------------------------------------------------

export async function listDocuments(opts?: {
  jobId?: string;
  unfiledOnly?: boolean;
  status?: DocumentStatus[];
  /** Photos are excluded unless asked for. See below. */
  kind?: string;
}): Promise<DocumentRecord[]> {
  let q = supabase.from('documents').select('*').eq('org_id', await orgNow()).order('created_at', { ascending: false });

  if (opts?.jobId) q = q.eq('job_id', opts.jobId);
  if (opts?.unfiledOnly) q = q.is('job_id', null);
  if (opts?.status?.length) q = q.in('status', opts.status);

  if (opts?.kind) {
    q = q.eq('kind', opts.kind);
  } else {
    /**
     * Photos share this table but not this pipeline.
     *
     * A receipt is unfiled until it is attached to a job, and the app chases
     * you about it. A photo of a finished bathroom belongs to a customer and
     * is never going to be attached to anything — so without this it would
     * sit in the Receipts inbox forever, and appear on Today as work you had
     * failed to deal with. Eight holiday snaps of a kitchen would read as
     * eight unbilled expenses.
     */
    q = q.neq('kind', 'photo');
  }

  return unwrap(await q) as DocumentRecord[];
}

export async function createDocument(
  orgId: string,
  input: {
    storage_path: string;
    file_name: string;
    mime_type?: string;
    size_bytes?: number;
    job_id?: string | null;
  }
): Promise<DocumentRecord> {
  return unwrap(
    await supabase
      .from('documents')
      .insert({ ...input, org_id: orgId })
      .select()
      .single()
  ) as DocumentRecord;
}

export async function updateDocument(
  id: string,
  patch: Partial<DocumentRecord>
): Promise<DocumentRecord> {
  return unwrap(
    await supabase.from('documents').update(patch).eq('id', id).select().single()
  ) as DocumentRecord;
}

const BUCKET = 'documents';

/**
 * Upload the real file, then create its row.
 *
 * Path is `{org_id}/{uuid}.{ext}` — storage policies read that first segment
 * to wall files by business, exactly like the table policies do.
 *
 * The file is kept, not just the numbers read off it: a contractor needs the
 * actual receipt for taxes and for when a customer disputes a charge.
 */
export async function uploadDocument(
  orgId: string,
  file: File
): Promise<DocumentRecord> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${orgId}/${crypto.randomUUID()}.${ext}`;

  const up = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (up.error) throw new Error(`Upload failed: ${up.error.message}`);

  try {
    return await createDocument(orgId, {
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });
  } catch (e) {
    // Don't leave an orphaned file behind if the row fails to insert.
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw e;
  }
}

/**
 * Short-lived link to view a stored document. The bucket is private, so
 * there's no permanent public URL by design.
 */
export async function getDocumentUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!storagePath || storagePath.startsWith('pending/')) return null;
  const res = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (res.error) return null;
  return res.data?.signedUrl ?? null;
}

export async function deleteDocument(doc: DocumentRecord): Promise<void> {
  // Row first. The other order leaves a record pointing at a file that no
  // longer exists if the row delete fails — a document you can see and cannot
  // open, which is worse than an unreferenced file nobody knows about.
  const res = await supabase.from('documents').delete().eq('id', doc.id);
  if (res.error) throw new Error(res.error.message);

  if (doc.storage_path && !doc.storage_path.startsWith('pending/')) {
    await supabase.storage.from(BUCKET).remove([doc.storage_path]).catch(() => {});
  }
}

/**
 * What the extraction has cost, ever. Surfaced in the UI on purpose: this is
 * a one-time-per-document cost and seeing the real number is the point.
 */
export async function getExtractionSpend(): Promise<{ cents: number; documents: number }> {
  const rows = unwrap(
    await supabase
      .from('documents')
      .select('extraction_cost_cents')
      .eq('org_id', await orgNow())
      .not('extraction_cost_cents', 'is', null)
  ) as Array<{ extraction_cost_cents: number }>;

  return {
    cents: rows.reduce((sum, r) => sum + num(r.extraction_cost_cents), 0),
    documents: rows.length,
  };
}

// ---------------------------------------------------------------------------
// Invoices — assembled from actuals
// ---------------------------------------------------------------------------

export async function listInvoices(jobId?: string): Promise<JobInvoice[]> {
  let q = supabase
    .from('job_invoices')
    .select('*')
    .eq('org_id', await orgNow())
    .order('created_at', { ascending: false });
  if (jobId) q = q.eq('job_id', jobId);

  const rows = unwrap(await q) as JobInvoice[];
  return rows.map((r) => ({
    ...r,
    subtotal: num(r.subtotal),
    tax_rate: num(r.tax_rate),
    tax_amount: num(r.tax_amount),
    total: num(r.total),
    amount_paid: num(r.amount_paid),
  }));
}

export async function getInvoiceLines(invoiceId: string): Promise<JobInvoiceLine[]> {
  return unwrap(
    await supabase
      .from('job_invoice_lines')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('position', { ascending: true })
  ) as JobInvoiceLine[];
}

/**
 * Invoice numbers are assigned by a database trigger, not here.
 *
 * The client used to read the highest existing number and add one, which
 * races: two invoices raised at the same moment both read the same value.
 * Assigning it inside the insert closes that gap, and it also fixes the sort,
 * which was text-based and would have restarted numbering at INV-10000.
 */

/**
 * THE CORE MOVE — draft an invoice from everything unbilled on a job.
 *
 * Unbilled hours become labor lines, unbilled costs become material lines
 * (with markup), and each line keeps a pointer back to the time entry or
 * receipt it came from. Nobody types an invoice; they approve one.
 *
 * Returns null when there is nothing unbilled.
 */
export async function draftInvoiceFromActuals(
  orgId: string,
  jobId: string,
  opts?: { taxRate?: number; dueInDays?: number }
): Promise<JobInvoice | null> {
  const job = await getJob(jobId);

  // Create the invoice FIRST, then claim work onto it. The obvious order —
  // read what's unbilled, build the invoice, then mark it billed — has a gap
  // between the read and the mark. Two people hitting the button at once both
  // read the same unbilled work and both bill it. Claiming with a conditional
  // update means the second claim finds nothing and gets an empty invoice
  // rather than a duplicate one.
  const due = new Date();
  due.setDate(due.getDate() + (opts?.dueInDays ?? 30));

  const invoice = unwrap(
    await supabase
      .from('job_invoices')
      .insert({
        org_id: orgId,
        job_id: jobId,
        status: 'draft',
        issued_on: new Date().toISOString().slice(0, 10),
        due_on: due.toISOString().slice(0, 10),
        subtotal: 0,
        tax_rate: opts?.taxRate ?? 0,
        tax_amount: 0,
        total: 0,
      })
      .select()
      .single()
  ) as JobInvoice;

  const cleanup = async () => {
    // Rollback. If even this fails there is nothing useful left to do — the
    // caller is already handling the original failure — but an empty invoice
    // left behind is worth knowing about.
    const res = await supabase.from('job_invoices').delete().eq('id', invoice.id);
    if (res.error) console.error('Could not roll back empty invoice', invoice.id, res.error.message);
  };

  try {
    // `.is('invoiced_on', null)` is the lock. Only rows still unclaimed at
    // this instant come back.
    const [timeRes, costRes] = await Promise.all([
      supabase
        .from('time_entries')
        .update({ invoiced_on: invoice.id })
        .eq('job_id', jobId)
        .eq('billable', true)
        .is('invoiced_on', null)
        .select(),
      supabase
        .from('costs')
        .update({ invoiced_on: invoice.id })
        .eq('job_id', jobId)
        .eq('billable', true)
        .is('invoiced_on', null)
        .select(),
    ]);

    if (timeRes.error) throw new Error(timeRes.error.message);
    if (costRes.error) throw new Error(costRes.error.message);

    const claimedTime = (timeRes.data ?? []) as TimeEntry[];
    const claimedCosts = (costRes.data ?? []) as Cost[];

    /*
      The recurring fee, which was never being billed at all.

      This drafted an invoice from time entries and costs and nothing else, so
      the $40 a month somebody agreed to — the platform fee and the hosting,
      sitting in customer_terms since the day the terms were written — went on
      no invoice, ever. The hours were billed and the subscription was free.

      It is read from the agreed terms rather than typed, so it cannot drift
      from what the proposal said, and it lands on the invoice for the month
      being billed whether or not anybody logged an hour. That is what a
      retainer is: it runs whether the phone rings or not.
    */
    const terms = job?.customer_id
      ? (await supabase
          .from('customer_terms')
          .select('monthly_fee, monthly_fee_for, platform_fee')
          .eq('org_id', orgId)
          .eq('customer_id', job.customer_id)
          .maybeSingle()).data
      : null;

    const recurring: Array<{ label: string; amount: number }> = [];
    if (terms) {
      const platform = num(terms.platform_fee);
      const monthly = num(terms.monthly_fee);
      if (platform > 0) recurring.push({ label: 'Platform access', amount: platform });
      if (monthly > 0) {
        recurring.push({ label: terms.monthly_fee_for || 'Monthly fee', amount: monthly });
      }
    }

    if (!claimedTime.length && !claimedCosts.length && !recurring.length) {
      await cleanup();
      return null;
    }

    type Draft = Omit<JobInvoiceLine, 'id' | 'invoice_id' | 'created_at'>;
    const lines: Draft[] = [];

    // The fixed part first: it is the same every month and is what somebody
    // scanning the invoice expects to recognise before the variable work.
    for (const r of recurring) {
      lines.push({
        kind: 'other',
        description: r.label,
        qty: 1,
        unit: 'month',
        unit_price: r.amount,
        total: round2(r.amount),
        position: lines.length,
        source_time_entry_id: null,
        source_cost_id: null,
      });
    }

    // Labor: one line per day worked, so the customer sees the shape of it.
    for (const e of claimedTime) {
      const hours = num(e.hours);
      const rate = num(e.rate);
      lines.push({
        kind: 'labor',
        description:
          e.description || `Labor${e.worker_name ? ` — ${e.worker_name}` : ''} (${e.worked_on})`,
        qty: hours,
        unit: 'hr',
        unit_price: rate,
        total: round2(hours * rate),
        position: lines.length,
        source_time_entry_id: e.id,
        source_cost_id: null,
      });
    }

    // Materials: cost plus whatever markup applies.
    for (const c of claimedCosts) {
      const markup = c.markup_pct ?? job?.material_markup_pct ?? 0;
      const billed = round2(num(c.amount) * (1 + num(markup) / 100));
      lines.push({
        kind: c.kind === 'subcontractor' ? 'subcontractor' : 'material',
        description: c.description || c.vendor || 'Materials',
        qty: 1,
        unit: null,
        unit_price: billed,
        total: billed,
        position: lines.length,
        source_time_entry_id: null,
        source_cost_id: c.id,
      });
    }

    const linesRes = await supabase
      .from('job_invoice_lines')
      .insert(lines.map((l) => ({ ...l, invoice_id: invoice.id })));
    if (linesRes.error) throw new Error(linesRes.error.message);

    const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
    const taxRate = opts?.taxRate ?? 0;
    const taxAmount = round2(subtotal * (taxRate / 100));

    const periods = [
      ...claimedTime.map((e) => e.worked_on),
      ...claimedCosts.map((c) => c.purchased_on),
    ].sort();

    return unwrap(
      await supabase
        .from('job_invoices')
        .update({
          subtotal,
          tax_amount: taxAmount,
          total: round2(subtotal + taxAmount),
          period_start: periods[0] ?? null,
          period_end: periods[periods.length - 1] ?? null,
        })
        .eq('id', invoice.id)
        .select()
        .single()
    ) as JobInvoice;
  } catch (e) {
    // Release anything claimed so the work isn't stranded on a dead invoice.
    await supabase.from('time_entries').update({ invoiced_on: null }).eq('invoiced_on', invoice.id);
    await supabase.from('costs').update({ invoiced_on: null }).eq('invoiced_on', invoice.id);
    await cleanup();
    throw e;
  }
}

/**
 * Invoice a fixed-price job from its accepted estimate.
 *
 * The actuals sweep does not apply here: on a fixed-price job the customer
 * agreed a number, and what it actually cost is the contractor's margin, not
 * the customer's bill. Without this a fixed-price job could not be invoiced
 * at all — which is exactly where Turks Cap sat.
 *
 * Construction bills in draws, so `percent` invoices a slice. Anything
 * already invoiced is deducted so repeated draws cannot overrun the agreed
 * total: billing more than someone signed for is the one mistake you cannot
 * apologize your way out of.
 */
export async function invoiceFromEstimate(
  orgId: string,
  jobId: string,
  opts?: { percent?: number; taxRate?: number; dueInDays?: number; description?: string }
): Promise<JobInvoice> {
  const [estimates, existing, job] = await Promise.all([
    listEstimates(jobId),
    listInvoices(jobId),
    getJob(jobId),
  ]);

  const accepted = estimates.find((e) => e.status === 'accepted');
  if (!accepted) {
    throw new Error('No accepted estimate on this job. Send it and get it accepted first.');
  }

  const contract = num(accepted.total);
  const alreadyInvoiced = existing
    .filter((i) => i.status !== 'void')
    .reduce((sum, i) => sum + num(i.subtotal), 0);

  const remaining = round2(contract - alreadyInvoiced);
  if (remaining <= 0) {
    throw new Error(`The full contract of ${contract.toFixed(2)} has already been invoiced.`);
  }

  const pct = opts?.percent;
  const requested =
    pct != null ? round2(contract * (Math.min(100, Math.max(0, pct)) / 100)) : remaining;
  const amount = Math.min(requested, remaining);

  type Draft = Omit<JobInvoiceLine, 'id' | 'invoice_id' | 'created_at'>;
  const isDraw = pct != null && amount < remaining;

  const lines: Draft[] = isDraw
    ? [
        {
          kind: 'other',
          description: opts?.description ?? `${pct}% progress draw — ${job?.name ?? 'contract'}`,
          qty: 1,
          unit: null,
          unit_price: amount,
          total: amount,
          position: 0,
          source_time_entry_id: null,
          source_cost_id: null,
        },
      ]
    : // Final or only invoice: itemize, so the customer sees what they agreed
      // to rather than one opaque number.
      (await getEstimateLines(accepted.id)).map((l, i) => ({
        kind: l.kind,
        description: l.description,
        qty: num(l.qty),
        unit: l.unit,
        unit_price: num(l.unit_price),
        total: num(l.total),
        position: i,
        source_time_entry_id: null,
        source_cost_id: null,
      }));

  // If draws were already taken, the itemized final must deduct them.
  if (!isDraw && alreadyInvoiced > 0) {
    lines.push({
      kind: 'other',
      description: 'Less: previously invoiced',
      qty: 1,
      unit: null,
      unit_price: round2(-alreadyInvoiced),
      total: round2(-alreadyInvoiced),
      position: lines.length,
      source_time_entry_id: null,
      source_cost_id: null,
    });
  }

  const subtotal = round2(lines.reduce((sum, l) => sum + l.total, 0));
  const taxRate = opts?.taxRate ?? 0;
  const taxAmount = round2(subtotal * (taxRate / 100));

  const due = new Date();
  due.setDate(due.getDate() + (opts?.dueInDays ?? 30));

  const invoice = unwrap(
    await supabase
      .from('job_invoices')
      .insert({
        org_id: orgId,
        job_id: jobId,
        status: 'draft',
        issued_on: new Date().toISOString().slice(0, 10),
        due_on: due.toISOString().slice(0, 10),
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total: round2(subtotal + taxAmount),
        notes: isDraw
          ? `Progress draw against an agreed contract of $${contract.toFixed(2)}.`
          : null,
      })
      .select()
      .single()
  ) as JobInvoice;

  const res = await supabase
    .from('job_invoice_lines')
    .insert(lines.map((l) => ({ ...l, invoice_id: invoice.id })));
  if (res.error) throw new Error(res.error.message);

  return invoice;
}

/** Every estimate across every job — the proposals overview. */
export async function listAllEstimates(): Promise<
  Array<Estimate & { job: { id: string; name: string; customer: { name: string } | null } | null }>
> {
  return unwrap(
    await supabase
      .from('estimates')
      .select('*, job:jobs(id, name, customer:customers(name))')
      .eq('org_id', await orgNow())
      .order('created_at', { ascending: false })
  ) as Array<Estimate & { job: { id: string; name: string; customer: { name: string } | null } | null }>;
}

export async function updateInvoice(
  id: string,
  patch: Partial<JobInvoice>
): Promise<JobInvoice> {
  return unwrap(
    await supabase.from('job_invoices').update(patch).eq('id', id).select().single()
  ) as JobInvoice;
}

/**
 * Voiding releases the underlying hours and costs back to unbilled so they
 * can be re-invoiced. Without this, a mistake silently eats revenue.
 */
export async function voidInvoice(id: string): Promise<void> {
  const release = await Promise.all([
    supabase.from('time_entries').update({ invoiced_on: null }).eq('invoiced_on', id),
    supabase.from('costs').update({ invoiced_on: null }).eq('invoiced_on', id),
    supabase.from('job_invoices').update({ status: 'void' }).eq('id', id),
  ]);
  const failed = release.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

function round2(n: number): number {
  /**
   * Money, rounded the way a person expects.
   *
   * `Math.round(n * 100) / 100` is the obvious version and it is wrong on
   * exactly the values that matter. A 15% markup on $432.10 is $496.915, which
   * multiplies to 49691.499999999993 in binary floating point and rounds DOWN
   * to $496.91 — a cent short, silently, on a real invoice. $1.005 becomes
   * $1.00 for the same reason.
   *
   * Shifting the decimal through the number's string form sidesteps the
   * multiplication that introduces the error, so 0.5 rounds up like everyone
   * was taught.
   *
   * A cent is not worth much. Being a cent out on a document someone is
   * checking against their own arithmetic is worth a great deal.
   */
  if (!Number.isFinite(n)) return 0;
  const shifted = Math.round(Number(`${n}e2`));
  return Number(`${shifted}e-2`);
}


/**
 * A stored brand asset, as something an img tag can use.
 *
 * The database answers with a storage path rather than a URL, because the URL
 * contains the project host and that does not belong in a view: the same row
 * has to survive a restore into a different project. This is the one place
 * that turns a path into an address.
 *
 * Passes an absolute URL straight through, so an explicit logo_url pointing at
 * somebody else's site works exactly as well as one held in the bucket.
 */
export function brandAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/brand-assets/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}
