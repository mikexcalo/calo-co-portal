/**
 * TypeScript types for CALO&CO Portal
 * Mirrors the data model from the original HTML application
 */

/**
 * A logo file asset within a brand kit slot
 */
export interface LogoFile {
  name: string;
  ext?: string;
  size?: number;
  data: string; // URL or base64 data
  isPrimary: boolean;
  assetId?: string;
  _assetId?: string; // Internal asset ID
  type?: string;
}

/**
 * Brand kit logos organized by slot
 */
export interface LogoSlots {
  light: LogoFile[];
  dark: LogoFile[];
  color: LogoFile[];
  icon: LogoFile[];
  secondary: LogoFile[];
  favicon: LogoFile[];
}

/**
 * Brand kit typography settings
 */
export interface Typography {
  heading: string;
  body: string;
  accent: string;
}

/**
 * Complete brand kit for a client or agency
 */
export interface BrandKit {
  _id: string | null;
  logos: LogoSlots;
  colors: string[]; // Hex color values
  fonts: Typography;
  notes: string;
  _saving?: boolean; // Internal flag for concurrent save protection
}

/**
 * Contact person for a client
 */
export interface Contact {
  id?: string;
  clientId: string;
  name: string;
  title?: string;
  role?: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

/**
 * Line item on an invoice
 */
export interface InvoiceItem {
  description: string;
  qty: number;
  price: number;
}

/**
 * Complete invoice record
 */
export interface Invoice {
  id: string; // invoice_number (display ID)
  _uuid?: string; // Primary key from database
  clientId: string;
  project: string;
  date: string; // Display format (e.g., "March 28, 2024")
  due: string; // Display format
  items: InvoiceItem[];
  tax: number;
  shipping: number;
  status: 'draft' | 'sent' | 'unpaid' | 'paid' | 'overdue';
  notes: string;
  type?: string; // 'invoice' or other types
  // Internal metadata
  projectDesc?: string;
  isReimbursement?: boolean;
  paidDate?: string | null;
  internalNotes?: string;
  vendorOrder?: string;
  vendorDate?: string;
  attachmentUrl?: string | null;
  netCost?: number; // internal_margin
}

/**
 * Expense record
 */
export interface Expense {
  id?: string;
  date: string; // ISO format
  category: string;
  vendor?: string;
  description: string;
  amount: number;
  invoiceId?: string | null;
  clientId?: string | null;
  notes?: string;
}

/**
 * Activity log entry
 */
export interface ActivityLogEntry {
  id: string;
  clientId: string;
  eventType: string;
  metadata: Record<string, any>;
  createdAt: string;
}

/**
 * Payment method option
 */
export interface PaymentMethod {
  method: string;
  handle: string;
  instructions?: string;
}

/**
 * Agency settings
 */
export interface AgencySettings {
  taxRate: number;
  fiscalYearStart: number;
  paymentMethods: PaymentMethod[];
  agencyBrandKit?: BrandKit;
  agencyInfo?: {
    agencyName?: string;
    founderName?: string;
    website?: string;
    city?: string;
  };
}

/**
 * Agency information
 */
export interface Agency {
  name: string;
  founder: string;
  url: string;
  location: string;
  brandKit: BrandKit;
  emailSignatureHtml?: string;
  signatureFields?: SignatureFields;
}

/**
 * Signature field configuration
 */
export interface SignatureFields {
  [key: string]: string | Record<string, boolean> | undefined;
  name?: string;
  title?: string;
  company?: string;
  email?: string;
  website?: string;
  brandColor?: string;
  logoSrc?: string;
  layout?: string;
  visible?: Record<string, boolean>;
}

/**
 * Client record
 */
export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  city?: string;
  logo?: string | null; // Data URL or image URL
  activeModules: string[];
  hasBrandKit: boolean;
  hasEmailSig: boolean;
  engagementStatus: 'active' | 'paused' | 'closed';
  nextStep: string;
  emailSignatureHtml: string;
  signatureFields: SignatureFields;
  brandKit: BrandKit;
}

/**
 * In-memory database cache
 */
export interface DBCache {
  agency: Agency;
  clients: Client[];
  clientsState: 'loading' | 'loaded' | 'error';
  invoices: Invoice[];
  _nextInvNum: Record<string, number>;
  activityLog: ActivityLogEntry[];
  contacts: Record<string, Contact[]>; // clientId -> contacts[]
  expenses: Expense[];
  agencySettings: AgencySettings;
}

/**
 * Statistics for a client
 */
export interface ClientStats {
  billed: number;
  paid: number;
  outstanding: number;
  reimbursed: number;
  count: number;
}

/**
 * Statistics for the entire agency
 */
export interface AgencyStats {
  billed: number;
  paid: number;
  outstanding: number;
  reimbursed: number;
  clients: number;
  invoices: number;
}
