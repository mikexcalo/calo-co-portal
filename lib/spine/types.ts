/**
 * Nautilus spine — types.
 *
 * These mirror supabase/migrations/20260820_nautilus_spine.sql exactly.
 * If you change one, change the other.
 */

export type JobStatus =
  | 'lead'
  | 'estimating'
  | 'won'
  | 'active'
  | 'complete'
  | 'closed'
  | 'lost';

export type BillingType = 'tm' | 'fixed' | 'retainer';

/**
 * What you are actually being paid in.
 *
 * cash is the default and covers almost everything. The rest exist so that
 * work paid for another way stops reading as work nobody paid for.
 */
export type Consideration = 'cash' | 'equity' | 'trade' | 'pro_bono' | 'deferred';

export const CONSIDERATION_LABEL: Record<Consideration, string> = {
  cash: 'Cash',
  equity: 'Equity',
  trade: 'Trade',
  pro_bono: 'Pro bono',
  deferred: 'Deferred',
};

export type LineKind = 'labor' | 'material' | 'subcontractor' | 'other';

export type CostKind =
  | 'material'
  | 'subcontractor'
  | 'equipment'
  | 'permit'
  | 'other';

export type DocumentKind =
  | 'receipt'
  | 'invoice'
  | 'estimate'
  | 'permit'
  | 'contract'
  | 'photo'
  | 'other'
  | 'unknown';

export type DocumentStatus =
  | 'uploaded'
  | 'processing'
  | 'extracted'
  | 'needs_review'
  | 'filed'
  | 'failed';

export type EstimateStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'superseded';

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'void';

export interface Org {
  id: string;
  name: string;
  slug: string;
  kind: 'agency' | 'contractor';
  /**
   * Sample data, for showing people.
   *
   * The failure mode of a demo is forgetting you are in one: typing a real
   * invoice into the fake business, or quoting fake numbers at a real client.
   * So it is on the org and the interface says so on every screen.
   */
  is_demo?: boolean;
  default_labor_rate: number;
  default_material_markup_pct: number;
  tax_rate: number;
  settings: Record<string, unknown>;
  /** Per-business module flags; empty means use the defaults for `kind`. */
  modules: Record<string, boolean>;
  payment_methods: unknown[];
  onboarded_at: string | null;
  billing_style: string | null;
  /** How the money works, in their own words, when no rate column can hold it. */
  billing_note?: string | null;
  /** Null means nobody has chosen one, which is not the same as choosing zero. */
  tax_set_aside_pct: number | null;
  tax_set_aside_note: string | null;
  /** Null switches review requests off, which is the safe default. */
  review_link: string | null;
  review_delay_days: number;
  /** What they pay for. Sets the default module list; modules overrides it. */
  plan: 'core' | 'grow' | 'agency';
  intake_token: string | null;
  price_feed_token: string | null;
  calendar_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  org_id: string;
  customer_id: string | null;
  name: string;
  address: string | null;
  description: string | null;
  status: JobStatus;
  billing_type: BillingType;
  labor_rate: number | null;
  material_markup_pct: number | null;
  source: string | null;
  started_on: string | null;
  completed_on: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  billing_period: 'none' | 'weekly' | 'biweekly' | 'monthly' | null;
  consideration: Consideration;
  consideration_note: string | null;
  retainer_amount: number | null;
  /** Hours the fee assumes, so overdelivery is visible. */
  retainer_hours: number | null;
  last_billed_on: string | null;
  created_at: string;
  updated_at: string;
}

/** A job with its customer joined in — what the list views actually render. */
export interface JobWithCustomer extends Job {
  customer: Pick<Customer, 'id' | 'name'> | null;
}

export interface Estimate {
  id: string;
  org_id: string;
  job_id: string;
  version: number;
  status: EstimateStatus;
  total: number;
  /** The price with no optional lines taken. total is this plus any selected. */
  base_total: number | null;
  valid_until: string | null;
  notes: string | null;
  sent_at: string | null;
  decided_at: string | null;
  public_token: string | null;
  sent_to: string | null;
  viewed_at: string | null;
  decided_by_name: string | null;
  decline_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface EstimateLine {
  id: string;
  estimate_id: string;
  kind: LineKind;
  description: string;
  qty: number;
  unit: string | null;
  unit_price: number;
  total: number;
  position: number;
  /** Priced but not included until the customer ticks it. */
  optional: boolean;
  /** Null while undecided; true or false once they have answered. */
  selected: boolean | null;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  org_id: string;
  job_id: string;
  worked_on: string;
  hours: number;
  rate: number;
  worker_name: string | null;
  description: string | null;
  billable: boolean;
  invoiced_on: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Structured data pulled off a document by extraction.
 * Deliberately loose — a smudged receipt yields partial data, and partial
 * data still beats a shoebox.
 */
export interface ExtractedReceipt {
  vendor?: string | null;
  purchased_on?: string | null;
  amount?: number | null;
  tax?: number | null;
  currency?: string | null;
  line_items?: Array<{ description: string; amount: number }> | null;
  category?: CostKind | null;
  summary?: string | null;
  /** Extraction's own read on whether a human should look at this. */
  needs_review?: boolean | null;
  review_reason?: string | null;
}

export interface DocumentRecord {
  id: string;
  org_id: string;
  job_id: string | null;
  customer_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: DocumentKind;
  status: DocumentStatus;
  extracted: ExtractedReceipt | null;
  extraction_confidence: number | null;
  extraction_model: string | null;
  extraction_cost_cents: number | null;
  extracted_at: string | null;
  extraction_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Cost {
  id: string;
  org_id: string;
  job_id: string;
  document_id: string | null;
  kind: CostKind;
  vendor: string | null;
  description: string | null;
  purchased_on: string;
  amount: number;
  billable: boolean;
  markup_pct: number | null;
  invoiced_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobInvoice {
  id: string;
  org_id: string;
  job_id: string;
  number: string;
  status: InvoiceStatus;
  period_start: string | null;
  period_end: string | null;
  issued_on: string | null;
  due_on: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  external_ref: string | null;
  public_token: string | null;
  viewed_at: string | null;
  paid_via: string | null;
  payment_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobInvoiceLine {
  id: string;
  invoice_id: string;
  kind: LineKind;
  description: string;
  qty: number;
  unit: string | null;
  unit_price: number;
  total: number;
  position: number;
  source_time_entry_id: string | null;
  source_cost_id: string | null;
  created_at: string;
}

/** The job_ledger view — one row per job, all the money in one read. */
export interface JobLedger {
  job_id: string;
  org_id: string;
  name: string;
  status: JobStatus;
  billing_type: BillingType;
  customer_id: string | null;
  hours_logged: number;
  labor_value: number;
  unbilled_labor: number;
  cost_total: number;
  unbilled_cost: number;
  invoiced_total: number;
  collected: number;
  estimate_total: number;
  margin_to_date: number;
  /**
   * Hours left against what the retainer fee assumed. Null unless this is a
   * retainer with a stated expectation, because a zero would read as "on
   * budget" when it actually means "nobody said".
   */
  retainer_variance: number | null;
  consideration: Consideration;
  consideration_note: string | null;
  retainer_amount: number | null;
  retainer_hours: number | null;
}

// ---------------------------------------------------------------------------
// Display labels. One place, so the same status never gets two names.
// ---------------------------------------------------------------------------

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  lead: 'Lead',
  estimating: 'Estimating',
  won: 'Won',
  active: 'In progress',
  complete: 'Complete',
  closed: 'Closed',
  lost: 'Lost',
};

/** The pipeline, in order. Drives the board columns. */
export const JOB_PIPELINE: JobStatus[] = [
  'lead',
  'estimating',
  'won',
  'active',
  'complete',
];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  partial: 'Partially paid',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

export const DOC_STATUS_LABEL: Record<DocumentStatus, string> = {
  uploaded: 'Waiting',
  processing: 'Reading',
  extracted: 'Read',
  needs_review: 'Needs review',
  filed: 'Filed',
  failed: 'Failed',
};

export const COST_KIND_LABEL: Record<CostKind, string> = {
  material: 'Materials',
  subcontractor: 'Subcontractor',
  equipment: 'Equipment',
  permit: 'Permit',
  other: 'Other',
};
