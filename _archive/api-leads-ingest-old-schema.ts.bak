import { z } from 'zod'

// ============================================================================
// Meta: UTM, page context, spam signals
// ============================================================================

export const MetaSchema = z.object({
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  referrer: z.string().max(2000).optional(),
  page_url: z.string().max(2000).optional(),
  // Turnstile token: accepted now, server-side verify deferred.
  // When verify ships, check `sites.form_configs[form_id].turnstile === true`
  // and POST this token to Cloudflare siteverify.
  turnstile_token: z.string().max(4000).optional(),
  // Honeypot: hidden CSS field on the form. Humans never fill it. If present
  // and non-empty, the submission is rejected as spam.
  _hp: z.string().optional(),
})

export type Meta = z.infer<typeof MetaSchema>

// ============================================================================
// Fields: freeform key-value from the form
// ============================================================================

const FieldKey = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/, {
  message: 'field keys must match /^[a-zA-Z0-9_-]{1,64}$/',
})
const FieldValue = z.string().max(4000)

export const FieldsSchema = z
  .record(FieldKey, FieldValue)
  .refine((obj) => Object.keys(obj).length <= 20, {
    message: 'max 20 fields per submission',
  })
  .refine(
    (obj) => {
      const email = obj.email
      return typeof email === 'string' && z.string().email().safeParse(email).success
    },
    { message: 'valid email is required in fields.email' }
  )

export type Fields = z.infer<typeof FieldsSchema>

// ============================================================================
// Request body
// ============================================================================

export const IngestBody = z.object({
  form_id: z.string().min(1).max(50),
  fields: FieldsSchema,
  meta: MetaSchema.optional(),
})

export type IngestBodyT = z.infer<typeof IngestBody>

// ============================================================================
// form_id -> target table routing map
// ============================================================================

export const TABLE_ROUTE = {
  contact: 'leads',
  newsletter: 'leads',
  general: 'leads',
  quote: 'quote_requests',
  quote_request: 'quote_requests',
} as const satisfies Record<string, 'leads' | 'quote_requests'>

export type RoutableFormId = keyof typeof TABLE_ROUTE
export type TargetTable = (typeof TABLE_ROUTE)[RoutableFormId]

export function isRoutableFormId(id: string): id is RoutableFormId {
  return id in TABLE_ROUTE
}

// ============================================================================
// Error codes (mirrors v0.1 spec §1 error table)
// ============================================================================

export type IngestErrorCode =
  | 'invalid_body'
  | 'invalid_email'
  | 'unknown_form'
  | 'missing_key'
  | 'invalid_key'
  | 'origin_not_allowed'
  | 'site_paused'
  | 'duplicate'
  | 'spam_detected'
  | 'rate_limited'
  | 'internal'
