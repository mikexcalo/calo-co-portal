/**
 * Which payment methods this installation can actually offer.
 *
 * The setup screen used to let anyone tick "card or bank transfer online"
 * whether or not Stripe was connected. Ticking it did nothing except put an
 * option on a customer's invoice that led nowhere — the worst kind of broken,
 * because it fails in front of the customer rather than in front of you.
 *
 * Returns nothing sensitive: whether a key exists, never the key.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    stripe: !!process.env.STRIPE_SECRET_KEY,
  });
}
