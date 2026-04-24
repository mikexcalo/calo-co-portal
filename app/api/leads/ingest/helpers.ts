import { createHash } from 'crypto'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { IngestErrorCode, TargetTable } from './schema'

// ============================================================================
// Supabase admin (service role)
// ============================================================================

let _sb: SupabaseClient | null = null
export function supabaseAdmin(): SupabaseClient {
  if (_sb) return _sb
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  _sb = createClient(url, key, { auth: { persistSession: false } })
  return _sb
}

// ============================================================================
// Bearer token + hashing
// ============================================================================

export function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

export function hashKey(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function keyPrefix(token: string): string {
  return token.slice(0, 12)
}

// ============================================================================
// Client IP
// ============================================================================

export function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return null
}

// ============================================================================
// Site lookup
// ============================================================================

export type SiteRow = {
  id: string
  agency_id: string | null
  client_id: string | null
  name: string
  allowed_origins: string[]
  api_key_hash: string
  status: string
  rate_limit_per_minute: number
  rate_limit_per_day: number
  form_configs: Record<string, any>
}

export async function lookupSiteByKey(token: string): Promise<SiteRow | null> {
  const prefix = keyPrefix(token)
  const hash = hashKey(token)
  const { data, error } = await supabaseAdmin()
    .from('sites')
    .select(
      'id, agency_id, client_id, name, allowed_origins, api_key_hash, status, rate_limit_per_minute, rate_limit_per_day, form_configs'
    )
    .eq('api_key_prefix', prefix)
    .maybeSingle()
  if (error || !data) return null
  if (data.api_key_hash !== hash) return null
  return data as SiteRow
}

// ============================================================================
// Rate limiting (Supabase-backed, queries ingest_log)
// ============================================================================

export async function checkRateLimit(
  site: SiteRow,
  ip: string | null
): Promise<boolean> {
  const sb = supabaseAdmin()
  const now = Date.now()
  const oneMinAgo = new Date(now - 60 * 1000).toISOString()
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  // Per-site per-minute
  const { count: perMinute } = await sb
    .from('ingest_log')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', site.id)
    .gte('received_at', oneMinAgo)
  if ((perMinute ?? 0) >= site.rate_limit_per_minute) return true

  // Per-site per-day
  const { count: perDay } = await sb
    .from('ingest_log')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', site.id)
    .gte('received_at', oneDayAgo)
  if ((perDay ?? 0) >= site.rate_limit_per_day) return true

  // Per-(IP, site) per-minute (hard-coded 5)
  if (ip) {
    const { count: perIp } = await sb
      .from('ingest_log')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', site.id)
      .eq('ip', ip)
      .gte('received_at', oneMinAgo)
    if ((perIp ?? 0) >= 5) return true
  }
  return false
}

// ============================================================================
// Ingest log
// ============================================================================

export async function logIngest(opts: {
  site: SiteRow | null
  statusCode: number
  errorCode: IngestErrorCode | null
  apiKeyPrefix: string | null
  formId: string | null
  ip: string | null
  userAgent: string | null
  origin: string | null
  recordType: TargetTable | null
  recordId: string | null
}) {
  try {
    const record_type =
      opts.recordType === 'quote_requests'
        ? 'quote_request'
        : opts.recordType === 'leads'
          ? 'lead'
          : null
    await supabaseAdmin().from('ingest_log').insert({
      site_id: opts.site?.id ?? null,
      agency_id: opts.site?.agency_id ?? null,
      client_id: opts.site?.client_id ?? null,
      api_key_prefix: opts.apiKeyPrefix,
      form_id: opts.formId,
      status_code: opts.statusCode,
      error_code: opts.errorCode,
      ip: opts.ip,
      user_agent: opts.userAgent,
      origin: opts.origin,
      record_type,
      record_id: opts.recordId,
    })
  } catch (e) {
    // logging must never break ingest
    console.error('logIngest failed', e)
  }
}

// ============================================================================
// Event emission
// ============================================================================

export async function emitIngestEvent(opts: {
  agencyId: string | null
  clientId: string | null
  siteId: string
  type: 'lead.received' | 'quote_request.received'
  payload: Record<string, unknown>
}) {
  try {
    await supabaseAdmin().from('ingest_events').insert({
      agency_id: opts.agencyId,
      client_id: opts.clientId,
      site_id: opts.siteId,
      type: opts.type,
      payload: opts.payload,
    })
  } catch (e) {
    console.error('emitIngestEvent failed', e)
  }
}

// ============================================================================
// Idempotency
// ============================================================================

export async function findByIdempotencyKey(
  table: TargetTable,
  siteId: string,
  idempotencyKey: string
): Promise<{ id: string } | null> {
  const { data } = await supabaseAdmin()
    .from(table)
    .select('id')
    .eq('site_id', siteId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  return data ?? null
}

// ============================================================================
// Response builders
// ============================================================================

export function errorResponse(
  status: number,
  code: IngestErrorCode,
  message?: string
) {
  return NextResponse.json(
    { ok: false, error: { code, message: message ?? code } },
    { status }
  )
}

export function successResponse(opts: {
  recordId: string
  recordType: 'lead' | 'quote_request'
  redirectUrl: string | null
}) {
  return NextResponse.json(
    {
      ok: true,
      record_id: opts.recordId,
      record_type: opts.recordType,
      redirect_url: opts.redirectUrl,
    },
    { status: 201 }
  )
}
