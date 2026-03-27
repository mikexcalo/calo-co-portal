import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface LineItem {
  id?: string
  description: string
  quantity: number
  price: number
}

export interface Invoice {
  id: string
  client_id: string
  invoice_number: string
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  issued_date: string
  due_date: string
  project_name: string
  line_items: {
    items: LineItem[]
    projectDesc?: string
    isReimbursement?: boolean
    paidDate?: string
    internalNotes?: string
    vendorOrder?: string
    vendorDate?: string
  }
  tax: number
  shipping: number
  notes?: string
  type: 'invoice' | 'estimate' | 'proposal'
  attachment_url?: string
  internal_margin?: number
  created_at?: string
  updated_at?: string
}

export interface Contact {
  id: string
  client_id: string
  name: string
  role: string
  email: string
  phone: string
  is_primary: boolean
  created_at?: string
  updated_at?: string
}

export interface Client {
  id: string
  name: string
  company: string
  email: string
  phone: string
  address: string
  website?: string
  active_modules: string[]
  engagement_status: 'active' | 'inactive' | 'prospect'
  next_step?: string
  tier: 'starter' | 'growth' | 'enterprise'
  health_status: 'healthy' | 'at-risk' | 'dormant'
  email_signature_html?: string
  signature_fields?: Record<string, string>
  created_at: string
  updated_at?: string
}

export interface Asset {
  id: string
  brand_kit_id: string
  slot: string
  file_name: string
  storage_url: string
  is_primary: boolean
  created_at?: string
  updated_at?: string
}

export interface BrandKit {
  id: string
  client_id: string
  typography?: {
    heading_font?: string
    body_font?: string
    font_sizes?: Record<string, number>
  }
  color_palette?: {
    primary?: string
    secondary?: string
    accent?: string
    neutral?: string
    colors?: Record<string, string>
  }
  brand_notes?: string
  created_at?: string
  updated_at?: string
}

export interface Expense {
  id: string
  client_id: string
  category: string
  description: string
  amount: number
  date: string
  paid_to: string
  invoice_id?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface AgencySettings {
  id: string
  tax_rate: number
  fiscal_year_start: string
  payment_methods?: {
    name: string
    details?: string
  }[]
  agency_name: string
  founder_name: string
  website?: string
  city: string
  created_at?: string
  updated_at?: string
}

export interface ActivityLogEntry {
  id: string
  client_id: string
  event_type: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface Agency {
  name: string
  founder: string
  url: string
  location: string
}

// ============================================================================
// SUPABASE CLIENT SINGLETON
// ============================================================================

let supabaseClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !anonKey) {
      throw new Error(
        'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
      )
    }

    supabaseClient = createClient(url, anonKey)
  }

  return supabaseClient
}

// ============================================================================
// AGENCY FUNCTIONS
// ============================================================================

export async function loadAgency(): Promise<Agency | null> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('agency')
      .select('name, founder, url, location')
      .limit(1)
      .single()

    if (error) {
      console.error('Failed to load agency:', error)
      return null
    }

    return data as Agency
  } catch (error) {
    console.error('Exception loading agency:', error)
    return null
  }
}

// ============================================================================
// CLIENT FUNCTIONS
// ============================================================================

export async function loadClients(): Promise<Client[]> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to load clients:', error)
      return []
    }

    return (data as Client[]) || []
  } catch (error) {
    console.error('Exception loading clients:', error)
    return []
  }
}

export async function saveClient(clientData: Partial<Client>): Promise<Client | null> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('clients')
      .upsert({
        ...clientData,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save client:', error)
      return null
    }

    return data as Client
  } catch (error) {
    console.error('Exception saving client:', error)
    return null
  }
}

export async function updateClientField(
  clientId: string,
  field: keyof Client,
  value: unknown
): Promise<Client | null> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('clients')
      .update({
        [field]: value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)
      .select()
      .single()

    if (error) {
      console.error(`Failed to update client field ${String(field)}:`, error)
      return null
    }

    return data as Client
  } catch (error) {
    console.error('Exception updating client field:', error)
    return null
  }
}

// ============================================================================
// CONTACT FUNCTIONS
// ============================================================================

export async function loadContacts(clientId: string): Promise<Contact[]> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('contacts')
      .select('*')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })

    if (error) {
      console.error('Failed to load contacts:', error)
      return []
    }

    return (data as Contact[]) || []
  } catch (error) {
    console.error('Exception loading contacts:', error)
    return []
  }
}

export async function loadAllContacts(): Promise<Contact[]> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to load all contacts:', error)
      return []
    }

    return (data as Contact[]) || []
  } catch (error) {
    console.error('Exception loading all contacts:', error)
    return []
  }
}

export async function saveContact(contactData: Partial<Contact>): Promise<Contact | null> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('contacts')
      .upsert({
        ...contactData,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save contact:', error)
      return null
    }

    return data as Contact
  } catch (error) {
    console.error('Exception saving contact:', error)
    return null
  }
}

export async function deleteContact(contactId: string): Promise<boolean> {
  const client = getSupabaseClient()

  try {
    const { error } = await client
      .from('contacts')
      .delete()
      .eq('id', contactId)

    if (error) {
      console.error('Failed to delete contact:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Exception deleting contact:', error)
    return false
  }
}

// ============================================================================
// INVOICE FUNCTIONS
// ============================================================================

export async function loadInvoices(clientId?: string): Promise<Invoice[]> {
  const client = getSupabaseClient()

  try {
    let query = client.from('invoices').select('*')

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { data, error } = await query.order('issued_date', { ascending: false })

    if (error) {
      console.error('Failed to load invoices:', error)
      return []
    }

    return (data as Invoice[]) || []
  } catch (error) {
    console.error('Exception loading invoices:', error)
    return []
  }
}

export async function saveInvoice(invoiceData: Partial<Invoice>): Promise<Invoice | null> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('invoices')
      .upsert({
        ...invoiceData,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save invoice:', error)
      return null
    }

    return data as Invoice
  } catch (error) {
    console.error('Exception saving invoice:', error)
    return null
  }
}

export async function deleteInvoice(invoiceId: string): Promise<boolean> {
  const client = getSupabaseClient()

  try {
    const { error } = await client
      .from('invoices')
      .delete()
      .eq('id', invoiceId)

    if (error) {
      console.error('Failed to delete invoice:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Exception deleting invoice:', error)
    return false
  }
}

// ============================================================================
// BRAND KIT FUNCTIONS
// ============================================================================

export async function loadBrandKits(): Promise<BrandKit[]> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('brand_kits')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to load brand kits:', error)
      return []
    }

    return (data as BrandKit[]) || []
  } catch (error) {
    console.error('Exception loading brand kits:', error)
    return []
  }
}

export async function saveBrandKit(brandKitData: Partial<BrandKit>): Promise<BrandKit | null> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('brand_kits')
      .upsert({
        ...brandKitData,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save brand kit:', error)
      return null
    }

    return data as BrandKit
  } catch (error) {
    console.error('Exception saving brand kit:', error)
    return null
  }
}

// ============================================================================
// ASSET FUNCTIONS
// ============================================================================

export async function loadAssets(brandKitId?: string): Promise<Asset[]> {
  const client = getSupabaseClient()

  try {
    let query = client.from('assets').select('*')

    if (brandKitId) {
      query = query.eq('brand_kit_id', brandKitId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to load assets:', error)
      return []
    }

    return (data as Asset[]) || []
  } catch (error) {
    console.error('Exception loading assets:', error)
    return []
  }
}

export async function uploadAsset(
  brandKitId: string,
  slot: string,
  fileName: string,
  file: File
): Promise<Asset | null> {
  const client = getSupabaseClient()

  try {
    // Upload file to storage
    const storagePath = `brand-kits/${brandKitId}/${slot}/${fileName}`
    const { error: uploadError } = await client.storage
      .from('assets')
      .upload(storagePath, file, { upsert: true })

    if (uploadError) {
      console.error('Failed to upload asset file:', uploadError)
      return null
    }

    // Get public URL
    const { data: urlData } = client.storage
      .from('assets')
      .getPublicUrl(storagePath)

    const storage_url = urlData?.publicUrl || ''

    // Save asset metadata
    const { data, error } = await client
      .from('assets')
      .upsert({
        brand_kit_id: brandKitId,
        slot,
        file_name: fileName,
        storage_url,
        is_primary: false,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save asset metadata:', error)
      return null
    }

    return data as Asset
  } catch (error) {
    console.error('Exception uploading asset:', error)
    return null
  }
}

export async function deleteAsset(assetId: string): Promise<boolean> {
  const client = getSupabaseClient()

  try {
    // Get asset to find storage path
    const { data: asset, error: getError } = await client
      .from('assets')
      .select('storage_url')
      .eq('id', assetId)
      .single()

    if (getError) {
      console.error('Failed to get asset:', getError)
      return false
    }

    // Delete from storage if URL exists
    if (asset?.storage_url) {
      const path = new URL(asset.storage_url).pathname.split('/').pop()
      if (path) {
        await client.storage.from('assets').remove([path])
      }
    }

    // Delete metadata
    const { error: deleteError } = await client
      .from('assets')
      .delete()
      .eq('id', assetId)

    if (deleteError) {
      console.error('Failed to delete asset:', deleteError)
      return false
    }

    return true
  } catch (error) {
    console.error('Exception deleting asset:', error)
    return false
  }
}

export async function updateAssetPrimary(assetId: string, isPrimary: boolean): Promise<Asset | null> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('assets')
      .update({
        is_primary: isPrimary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update asset primary status:', error)
      return null
    }

    return data as Asset
  } catch (error) {
    console.error('Exception updating asset primary status:', error)
    return null
  }
}

// ============================================================================
// EXPENSE FUNCTIONS
// ============================================================================

export async function loadExpenses(): Promise<Expense[]> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })

    if (error) {
      console.error('Failed to load expenses:', error)
      return []
    }

    return (data as Expense[]) || []
  } catch (error) {
    console.error('Exception loading expenses:', error)
    return []
  }
}

export async function saveExpense(expenseData: Partial<Expense>): Promise<Expense | null> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('expenses')
      .upsert({
        ...expenseData,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save expense:', error)
      return null
    }

    return data as Expense
  } catch (error) {
    console.error('Exception saving expense:', error)
    return null
  }
}

export async function deleteExpense(expenseId: string): Promise<boolean> {
  const client = getSupabaseClient()

  try {
    const { error } = await client
      .from('expenses')
      .delete()
      .eq('id', expenseId)

    if (error) {
      console.error('Failed to delete expense:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Exception deleting expense:', error)
    return false
  }
}

// ============================================================================
// AGENCY SETTINGS FUNCTIONS
// ============================================================================

export async function loadAgencySettings(): Promise<AgencySettings | null> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('agency_settings')
      .select('*')
      .limit(1)
      .single()

    if (error) {
      console.error('Failed to load agency settings:', error)
      return null
    }

    return data as AgencySettings
  } catch (error) {
    console.error('Exception loading agency settings:', error)
    return null
  }
}

export async function saveAgencySettings(
  settingsData: Partial<AgencySettings>
): Promise<AgencySettings | null> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('agency_settings')
      .upsert({
        ...settingsData,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save agency settings:', error)
      return null
    }

    return data as AgencySettings
  } catch (error) {
    console.error('Exception saving agency settings:', error)
    return null
  }
}

// ============================================================================
// ACTIVITY LOG FUNCTIONS
// ============================================================================

export async function loadActivityLog(limit: number = 50): Promise<ActivityLogEntry[]> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Failed to load activity log:', error)
      return []
    }

    return (data as ActivityLogEntry[]) || []
  } catch (error) {
    console.error('Exception loading activity log:', error)
    return []
  }
}

export async function logActivity(
  clientId: string,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<ActivityLogEntry | null> {
  const client = getSupabaseClient()

  try {
    const { data, error } = await client
      .from('activity_log')
      .insert({
        client_id: clientId,
        event_type: eventType,
        metadata: metadata || {},
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to log activity:', error)
      return null
    }

    return data as ActivityLogEntry
  } catch (error) {
    console.error('Exception logging activity:', error)
    return null
  }
}

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

export function getStorageUrl(bucket: string, path: string): string {
  const client = getSupabaseClient()
  const { data } = client.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl || ''
}

export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<string | null> {
  const client = getSupabaseClient()

  try {
    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(path, file, { upsert: true })

    if (uploadError) {
      console.error('Failed to upload file:', uploadError)
      return null
    }

    const { data } = client.storage.from(bucket).getPublicUrl(path)
    return data?.publicUrl || null
  } catch (error) {
    console.error('Exception uploading file:', error)
    return null
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function currency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n)
}

export function isoToDisplay(iso: string): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

export function daysUntil(dateStr: string): number {
  const targetDate = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  targetDate.setHours(0, 0, 0, 0)
  const diffTime = targetDate.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function invSubtotal(inv: Invoice): number {
  if (!inv.line_items?.items) return 0
  return inv.line_items.items.reduce((sum, item) => sum + item.quantity * item.price, 0)
}

export function invTotal(inv: Invoice): number {
  const subtotal = invSubtotal(inv)
  const tax = inv.tax || 0
  const shipping = inv.shipping || 0
  return subtotal + tax + shipping
}
