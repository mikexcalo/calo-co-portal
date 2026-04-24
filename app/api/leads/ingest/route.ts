import { NextRequest, NextResponse } from 'next/server'
import {
  IngestBody,
  TABLE_ROUTE,
  isRoutableFormId,
  type IngestErrorCode,
} from './schema'
import {
  emitIngestEvent,
  errorResponse,
  extractBearerToken,
  findByIdempotencyKey,
  getClientIp,
  keyPrefix,
  logIngest,
  lookupSiteByKey,
  checkRateLimit,
  successResponse,
  supabaseAdmin,
} from './helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ----------------------------------------------------------------------------
// OPTIONS — CORS preflight
// ----------------------------------------------------------------------------

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  // Preflight cannot authenticate (no Authorization header by spec).
  // Permissive here; POST enforces allowlist strictly.
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin ?? '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, Idempotency-Key',
      'Access-Control-Max-Age': '86400',
    },
  })
}

// ----------------------------------------------------------------------------
// POST — ingest
// ----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const userAgent = req.headers.get('user-agent')
  const ip = getClientIp(req)
  const idempotencyKey = req.headers.get('idempotency-key')

  // 1. Extract bearer token
  const token = extractBearerToken(req)
  if (!token) {
    await logIngest({
      site: null, statusCode: 401, errorCode: 'missing_key',
      apiKeyPrefix: null, formId: null, ip, userAgent, origin,
      recordType: null, recordId: null,
    })
    return errorResponse(401, 'missing_key')
  }
  const prefix = keyPrefix(token)

  // 2. Resolve site
  const site = await lookupSiteByKey(token)
  if (!site) {
    await logIngest({
      site: null, statusCode: 401, errorCode: 'invalid_key',
      apiKeyPrefix: prefix, formId: null, ip, userAgent, origin,
      recordType: null, recordId: null,
    })
    return errorResponse(401, 'invalid_key')
  }
  if (site.status !== 'active') {
    await logIngest({
      site, statusCode: 403, errorCode: 'site_paused',
      apiKeyPrefix: prefix, formId: null, ip, userAgent, origin,
      recordType: null, recordId: null,
    })
    return errorResponse(403, 'site_paused')
  }

  // 3. Origin allowlist (strict)
  if (origin && !site.allowed_origins.includes(origin)) {
    await logIngest({
      site, statusCode: 403, errorCode: 'origin_not_allowed',
      apiKeyPrefix: prefix, formId: null, ip, userAgent, origin,
      recordType: null, recordId: null,
    })
    return errorResponse(403, 'origin_not_allowed')
  }

  // 4. Rate limit
  if (await checkRateLimit(site, ip)) {
    await logIngest({
      site, statusCode: 429, errorCode: 'rate_limited',
      apiKeyPrefix: prefix, formId: null, ip, userAgent, origin,
      recordType: null, recordId: null,
    })
    return errorResponse(429, 'rate_limited')
  }

  // 5. Parse + validate body
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    await logIngest({
      site, statusCode: 400, errorCode: 'invalid_body',
      apiKeyPrefix: prefix, formId: null, ip, userAgent, origin,
      recordType: null, recordId: null,
    })
    return errorResponse(400, 'invalid_body')
  }

  const parsed = IngestBody.safeParse(rawBody)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    const code: IngestErrorCode =
      firstIssue?.message?.includes('email') ? 'invalid_email' : 'invalid_body'
    await logIngest({
      site, statusCode: 400, errorCode: code,
      apiKeyPrefix: prefix, formId: null, ip, userAgent, origin,
      recordType: null, recordId: null,
    })
    return errorResponse(400, code, firstIssue?.message)
  }

  const { form_id, fields, meta } = parsed.data

  // 6. Honeypot
  if (meta?._hp && meta._hp.trim().length > 0) {
    await logIngest({
      site, statusCode: 422, errorCode: 'spam_detected',
      apiKeyPrefix: prefix, formId: form_id, ip, userAgent, origin,
      recordType: null, recordId: null,
    })
    return errorResponse(422, 'spam_detected')
  }

  // 7. Form routing
  if (!isRoutableFormId(form_id)) {
    await logIngest({
      site, statusCode: 400, errorCode: 'unknown_form',
      apiKeyPrefix: prefix, formId: form_id, ip, userAgent, origin,
      recordType: null, recordId: null,
    })
    return errorResponse(400, 'unknown_form')
  }
  const table = TABLE_ROUTE[form_id]

  // 8. Per-form required-fields check (from sites.form_configs)
  const requiredFields: string[] =
    site.form_configs?.[form_id]?.required_fields ?? []
  for (const key of requiredFields) {
    const v = (fields as Record<string, string>)[key]
    if (!v || v.trim().length === 0) {
      await logIngest({
        site, statusCode: 400, errorCode: 'invalid_body',
        apiKeyPrefix: prefix, formId: form_id, ip, userAgent, origin,
        recordType: null, recordId: null,
      })
      return errorResponse(400, 'invalid_body', `missing required field: ${key}`)
    }
  }

  // 9. Idempotency short-circuit
  if (idempotencyKey) {
    const existing = await findByIdempotencyKey(table, site.id, idempotencyKey)
    if (existing) {
      const redirect = site.form_configs?.[form_id]?.redirect_url ?? null
      return successResponse({
        recordId: existing.id,
        recordType: table === 'leads' ? 'lead' : 'quote_request',
        redirectUrl: redirect,
      })
    }
  }

  // 10. Build insert payload
  const utm = {
    utm_source: meta?.utm_source ?? null,
    utm_medium: meta?.utm_medium ?? null,
    utm_campaign: meta?.utm_campaign ?? null,
    utm_term: meta?.utm_term ?? null,
    utm_content: meta?.utm_content ?? null,
  }
  const sourceMeta = {
    referrer: meta?.referrer ?? null,
    page_url: meta?.page_url ?? null,
    user_agent: userAgent,
    ip,
  }

  const basePayload: Record<string, unknown> = {
    client_id: site.client_id,
    site_id: site.id,
    form_id,
    idempotency_key: idempotencyKey,
    raw_fields: fields,
    utm,
    source_meta: sourceMeta,
    status: 'new',
    email: fields.email,
    name: (fields as Record<string, string>).name ?? null,
    phone: (fields as Record<string, string>).phone ?? null,
    message: (fields as Record<string, string>).message ?? null,
  }

  const payload =
    table === 'quote_requests'
      ? {
          ...basePayload,
          project_type: (fields as Record<string, string>).project_type ?? null,
          budget_range: (fields as Record<string, string>).budget_range ?? null,
          timeline: (fields as Record<string, string>).timeline ?? null,
        }
      : basePayload

  // 11. Insert
  const { data: inserted, error: insertErr } = await supabaseAdmin()
    .from(table)
    .insert(payload)
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('ingest insert failed', insertErr)
    await logIngest({
      site, statusCode: 500, errorCode: 'internal',
      apiKeyPrefix: prefix, formId: form_id, ip, userAgent, origin,
      recordType: table, recordId: null,
    })
    return errorResponse(500, 'internal')
  }

  // 12. Log success
  await logIngest({
    site, statusCode: 201, errorCode: null,
    apiKeyPrefix: prefix, formId: form_id, ip, userAgent, origin,
    recordType: table, recordId: inserted.id,
  })

  // 13. Emit event
  await emitIngestEvent({
    clientId: site.client_id,
    siteId: site.id,
    type: table === 'leads' ? 'lead.received' : 'quote_request.received',
    payload: {
      record_id: inserted.id,
      form_id,
      email: fields.email,
    },
  })

  // 14. Response
  const redirect = site.form_configs?.[form_id]?.redirect_url ?? null
  return successResponse({
    recordId: inserted.id,
    recordType: table === 'leads' ? 'lead' : 'quote_request',
    redirectUrl: redirect,
  })
}
