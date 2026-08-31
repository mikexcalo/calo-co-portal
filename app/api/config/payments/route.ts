/**
 * Which payment methods a given business can actually offer.
 *
 * WHY THIS IS SCOPED TO ONE BUSINESS
 * There is a single platform Stripe key, and money paid through it lands in
 * the account that key belongs to. That is correct for CALO&CO invoicing its
 * own clients, and catastrophically wrong for anyone else: if Mammoth ticked
 * "card" and sent an invoice, their customer would pay CALO&CO. The money
 * would arrive in the wrong bank account, and the first person to notice
 * would be the contractor wondering where his payment went.
 *
 * So card payment is offered only to the business that owns the key, named in
 * STRIPE_OWNER_ORG. Everyone else is told plainly why it is unavailable.
 *
 * The real fix is Stripe Connect, where each business links their own account
 * and their customers pay them directly. Until that exists, this guard is what
 * stops a routing mistake nobody would catch until it had already happened.
 *
 * Returns nothing sensitive: whether a key exists, never the key.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const hasKey = !!process.env.STRIPE_SECRET_KEY;

  /**
   * Defaults to calo-co so an unset variable cannot silently open card
   * payment to every business. Failing closed is the only safe default when
   * the failure mode is money going somewhere else.
   */
  const owner = (process.env.STRIPE_OWNER_ORG || 'calo-co').trim();
  const slug = req.nextUrl.searchParams.get('org')?.trim();

  return NextResponse.json({
    stripe: hasKey && !!slug && slug === owner,
    // Told apart so the screen can explain which of the two it is.
    reason: !hasKey
      ? 'not_configured'
      : slug !== owner
      ? 'not_your_account'
      : null,
  });
}
