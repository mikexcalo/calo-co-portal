/**
 * The tracked hop to Google.
 *
 * Records the click, then forwards. The customer never sees this page, which
 * is the point: anything rendered here is a step between somebody willing to
 * leave a review and the box they type it into.
 *
 * Clicks are all this can honestly measure. Google does not say who left a
 * review, and attributing one would be inventing a number.
 */

import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ReviewHop({ params }: { params: { token: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let target: string | null = null;

  if (url && anon) {
    const supabase = createClient(url, anon, { auth: { persistSession: false } });
    const { data } = await supabase.rpc('follow_review', { t: params.token });
    target = (data as string | null) ?? null;
  }

  // A dead token still goes somewhere sensible rather than showing an error to
  // a customer who was doing us a favour.
  redirect(target ?? 'https://www.google.com/search?q=reviews');
}
