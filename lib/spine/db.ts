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
 * The org you're currently looking at. Reads active_org_id, which the
 * database only honours when a matching membership exists — so this can
 * never return an org you don't belong to.
 */
export async function getCurrentOrg(): Promise<Org | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const profile = await supabase
    .from('profiles')
    .select('active_org_id')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profile.error) throw new Error(profile.error.message);
  const orgId = profile.data?.active_org_id;
  if (!orgId) return null;

  const org = await supabase.from('orgs').select('*').eq('id', orgId).maybeSingle();
  if (org.error) throw new Error(org.error.message);
  return org.data as Org | null;
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
    await supabase.from('customers').select('*').order('name', { ascending: true })
  ) as Customer[];
}

export async function createCustomer(
  orgId: string,
  input: Partial<Customer> & { name: string }
): Promise<Customer> {
  return unwrap(
    await supabase
      .from('customers')
      .insert({ ...input, org_id: orgId })
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
  const rows = unwrap(await supabase.from('job_ledger').select('*')) as JobLedger[];
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
  lines: Array<Omit<EstimateLine, 'id' | 'estimate_id' | 'created_at'>>
): Promise<Estimate> {
  const existing = await listEstimates(jobId);
  const version = existing.length ? Math.max(...existing.map((e) => e.version)) + 1 : 1;
  const total = lines.reduce((sum, l) => sum + num(l.total), 0);

  const estimate = unwrap(
    await supabase
      .from('estimates')
      .insert({ org_id: orgId, job_id: jobId, version, total })
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
    await supabase
      .from('estimates')
      .update({ status: 'superseded' })
      .eq('job_id', jobId)
      .neq('id', estimate.id)
      .in('status', ['draft', 'sent']);
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

export async function createTimeEntry(
  orgId: string,
  jobId: string,
  input: { worked_on: string; hours: number; rate: number; worker_name?: string; description?: string }
): Promise<TimeEntry> {
  return unwrap(
    await supabase
      .from('time_entries')
      .insert({ ...input, org_id: orgId, job_id: jobId })
      .select()
      .single()
  ) as TimeEntry;
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const res = await supabase.from('time_entries').delete().eq('id', id);
  if (res.error) throw new Error(res.error.message);
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
  return unwrap(
    await supabase
      .from('costs')
      .insert({ ...input, org_id: orgId, job_id: jobId })
      .select()
      .single()
  ) as Cost;
}

export async function deleteCost(id: string): Promise<void> {
  const res = await supabase.from('costs').delete().eq('id', id);
  if (res.error) throw new Error(res.error.message);
}

// ---------------------------------------------------------------------------
// Documents — the shoebox
// ---------------------------------------------------------------------------

export async function listDocuments(opts?: {
  jobId?: string;
  unfiledOnly?: boolean;
  status?: DocumentStatus[];
}): Promise<DocumentRecord[]> {
  let q = supabase.from('documents').select('*').order('created_at', { ascending: false });

  if (opts?.jobId) q = q.eq('job_id', opts.jobId);
  if (opts?.unfiledOnly) q = q.is('job_id', null);
  if (opts?.status?.length) q = q.in('status', opts.status);

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
  if (doc.storage_path && !doc.storage_path.startsWith('pending/')) {
    await supabase.storage.from(BUCKET).remove([doc.storage_path]).catch(() => {});
  }
  const res = await supabase.from('documents').delete().eq('id', doc.id);
  if (res.error) throw new Error(res.error.message);
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

/** Next invoice number for the org, as INV-0001. */
async function nextInvoiceNumber(orgId: string): Promise<string> {
  const rows = unwrap(
    await supabase
      .from('job_invoices')
      .select('number')
      .eq('org_id', orgId)
      .order('number', { ascending: false })
      .limit(1)
  ) as Array<{ number: string }>;

  const last = rows[0]?.number ?? '';
  const n = parseInt(last.replace(/\D/g, ''), 10);
  return `INV-${String(Number.isFinite(n) ? n + 1 : 1).padStart(4, '0')}`;
}

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
  const [entries, costs, job] = await Promise.all([
    listTimeEntries(jobId),
    listCosts(jobId),
    getJob(jobId),
  ]);

  const unbilledTime = entries.filter((e) => e.billable && !e.invoiced_on);
  const unbilledCosts = costs.filter((c) => c.billable && !c.invoiced_on);
  if (!unbilledTime.length && !unbilledCosts.length) return null;

  type Draft = Omit<JobInvoiceLine, 'id' | 'invoice_id' | 'created_at'>;
  const lines: Draft[] = [];

  // Labor: one line per day worked, so the customer sees the shape of the work.
  for (const e of unbilledTime) {
    lines.push({
      kind: 'labor',
      description:
        e.description || `Labor${e.worker_name ? ` — ${e.worker_name}` : ''} (${e.worked_on})`,
      qty: e.hours,
      unit: 'hr',
      unit_price: e.rate,
      total: round2(e.hours * e.rate),
      position: lines.length,
      source_time_entry_id: e.id,
      source_cost_id: null,
    });
  }

  // Materials: cost plus whatever markup applies.
  for (const c of unbilledCosts) {
    const markup = c.markup_pct ?? job?.material_markup_pct ?? 0;
    const billed = round2(c.amount * (1 + markup / 100));
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

  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const taxRate = opts?.taxRate ?? 0;
  const taxAmount = round2(subtotal * (taxRate / 100));

  const periods = [
    ...unbilledTime.map((e) => e.worked_on),
    ...unbilledCosts.map((c) => c.purchased_on),
  ].sort();

  const dueInDays = opts?.dueInDays ?? 30;
  const due = new Date();
  due.setDate(due.getDate() + dueInDays);

  const invoice = unwrap(
    await supabase
      .from('job_invoices')
      .insert({
        org_id: orgId,
        job_id: jobId,
        number: await nextInvoiceNumber(orgId),
        status: 'draft',
        period_start: periods[0] ?? null,
        period_end: periods[periods.length - 1] ?? null,
        issued_on: new Date().toISOString().slice(0, 10),
        due_on: due.toISOString().slice(0, 10),
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total: round2(subtotal + taxAmount),
      })
      .select()
      .single()
  ) as JobInvoice;

  const linesRes = await supabase
    .from('job_invoice_lines')
    .insert(lines.map((l) => ({ ...l, invoice_id: invoice.id })));
  if (linesRes.error) throw new Error(linesRes.error.message);

  // Mark the sources as billed so they can't land on a second invoice.
  if (unbilledTime.length) {
    const res = await supabase
      .from('time_entries')
      .update({ invoiced_on: invoice.id })
      .in('id', unbilledTime.map((e) => e.id));
    if (res.error) throw new Error(res.error.message);
  }
  if (unbilledCosts.length) {
    const res = await supabase
      .from('costs')
      .update({ invoiced_on: invoice.id })
      .in('id', unbilledCosts.map((c) => c.id));
    if (res.error) throw new Error(res.error.message);
  }

  return invoice;
}

/**
 * Invoice a fixed-price job from its accepted estimate.
 *
 * The actuals sweep does not apply here: on a fixed-price job the customer
 * agreed a number, and what it actually cost is the contractor's margin, not
 * the customer's bill. Without this, a fixed-price job could not be invoiced
 * at all — which is exactly where Turks Cap sat.
 *
 * Construction bills in draws, so `percent` invoices a slice of the contract.
 * Anything already invoiced is deducted, so repeated draws cannot overrun the
 * agreed total — billing a customer more than they signed for is the one
 * mistake you cannot apologise your way out of.
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
    throw new Error(
      'No accepted estimate on this job. Send the estimate and get it accepted first.'
    );
  }

  const contract = num(accepted.total);
  const alreadyInvoiced = existing
    .filter((i) => i.status !== 'void')
    .reduce((sum, i) => sum + num(i.subtotal), 0);

  const remaining = round2(contract - alreadyInvoiced);
  if (remaining <= 0) {
    throw new Error(
      `The full contract of ${contract.toFixed(2)} has already been invoiced.`
    );
  }

  const pct = opts?.percent;
  const requested =
    pct != null ? round2(contract * (Math.min(100, Math.max(0, pct)) / 100)) : remaining;

  // Never let a draw take the total past the agreed contract.
  const amount = Math.min(requested, remaining);

  const lines =
    pct != null && amount < remaining
      ? [
          {
            kind: 'other' as LineKind,
            description:
              opts?.description ??
              `${pct}% progress draw — ${job?.name ?? 'contract'}`,
            qty: 1,
            unit: null,
            unit_price: amount,
            total: amount,
            position: 0,
            source_time_entry_id: null,
            source_cost_id: null,
          },
        ]
      : // Final or only invoice: itemize it, so the customer sees what they
        // agreed to rather than one opaque number.
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

  // If earlier draws were taken, the itemized final has to be reduced by them.
  const lineSum = round2(lines.reduce((sum, l) => sum + l.total, 0));
  if (alreadyInvoiced > 0 && lineSum > amount) {
    lines.push({
      kind: 'other' as LineKind,
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
        number: await nextInvoiceNumber(orgId),
        status: 'draft',
        issued_on: new Date().toISOString().slice(0, 10),
        due_on: due.toISOString().slice(0, 10),
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total: round2(subtotal + taxAmount),
        notes:
          pct != null && amount < remaining
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
  return Math.round(n * 100) / 100;
}
