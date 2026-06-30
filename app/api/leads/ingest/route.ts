import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, { auth: { persistSession: false } })
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}

// POST — lead ingest
export async function POST(req: NextRequest) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  try {
    const body = await req.json()
    const { source, name, email, company, message } = body as {
      source?: string
      name?: string
      email?: string
      company?: string | null
      message?: string
      client_id?: string
    }

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400, headers: corsHeaders })
    }
    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'email is required' }, { status: 400, headers: corsHeaders })
    }
    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400, headers: corsHeaders })
    }

    const sb = getSupabaseAdmin()

    // 1. Insert contact
    const { data: contact, error: contactErr } = await sb
      .from('contacts')
      .insert({
        kind: 'lead',
        name: name.trim(),
        email: email.trim(),
        phone: null,
        client_id: null,
        role: company?.trim() || null,
        is_primary_contact: false,
        is_billing_contact: false,
        source: source || 'unknown',
        unread: true,
      })
      .select('id')
      .single()

    if (contactErr || !contact) {
      console.error('Contact insert failed:', contactErr)
      return NextResponse.json({ error: 'Failed to create contact' }, { status: 500, headers: corsHeaders })
    }

    // 2. Create initial note with the message
    const { error: noteErr } = await sb.from('notes').insert({
      contact_id: contact.id,
      content: `Initial inquiry: ${message.trim()}`,
      kind: 'note',
      source_kind: 'manual',
    })
    if (noteErr) {
      console.error('Note insert failed:', noteErr)
      // Don't fail the whole request — contact was created
    }

    // 3. Send email notification via Resend
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      try {
        const resend = new Resend(resendKey)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://calo-co-portal-tf7x.vercel.app'
        const contactUrl = `${appUrl}/contacts/${contact.id}`

          // Route lead notifications by source; fall back to the existing default recipient.
          const DEFAULT_LEAD_RECIPIENT = 'mikexcalo@gmail.com'
          const LEAD_RECIPIENTS: Record<string, string> = {
            'stevies-poem-store-contact-form': 'stevie@steviespoemstore.com',
          }
          const leadRecipient = LEAD_RECIPIENTS[source || ''] ?? DEFAULT_LEAD_RECIPIENT

        await resend.emails.send({
          from: 'CALO&CO Nautilus <onboarding@resend.dev>',
          to: leadRecipient,
          replyTo: email.trim(),
          subject: 'New CALO&CO lead!',
          html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 15px; line-height: 1.6; color: #111;">
  <p>New lead via the CALO&CO contact form.</p>
  <p><strong>Name:</strong> ${name.trim()}<br/>
  <strong>Email:</strong> ${email.trim()}<br/>
  <strong>Company:</strong> ${company?.trim() || '—'}</p>
  <p><strong>What they're looking for:</strong><br/>
  ${message.trim()}</p>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
  <p><a href="${contactUrl}" style="color: #2563eb;">View in Nautilus →</a></p>
</div>
          `.trim(),
        })
      } catch (emailErr) {
        console.error('Resend email exception:', emailErr)
      }
    } else {
      console.warn('RESEND_API_KEY not set — skipping email notification')
    }

    return NextResponse.json(
      { success: true, contact_id: contact.id },
      { status: 200, headers: corsHeaders }
    )
  } catch (err: any) {
    console.error('Lead ingest error:', err)
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
