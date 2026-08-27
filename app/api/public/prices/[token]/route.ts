/**
 * Published price list, for a business's own website to render.
 *
 * Public and CORS-open by design — a marketing site fetches this from the
 * visitor's browser. It returns ONLY items explicitly flagged `public` AND
 * `confirmed`, so nothing reaches a customer that hasn't been both published
 * on purpose and stood behind by someone who sets prices.
 *
 * Cached for five minutes. A price list changes a few times a year; hammering
 * the database on every page view would be silly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=300, s-maxage=300',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500, headers: cors });
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: org } = await db
    .from('orgs')
    .select('id, name')
    .eq('price_feed_token', params.token)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: cors });
  }

  const { data: items } = await db
    .from('price_items')
    .select('name, description, category, unit, unit_price, price_high, varies, kind')
    .eq('org_id', org.id)
    .eq('public', true)
    .eq('confirmed', true)
    .eq('active', true)
    .order('category')
    .order('position');

  // Grouped by category, because that's how a price list is read.
  const grouped: Record<string, unknown[]> = {};
  for (const i of items ?? []) {
    const cat = (i.category as string) || 'Other';
    (grouped[cat] ??= []).push({
      name: i.name,
      description: i.description,
      unit: i.unit,
      price: Number(i.unit_price),
      priceHigh: i.price_high == null ? null : Number(i.price_high),
      varies: i.varies,
      kind: i.kind,
    });
  }

  return NextResponse.json(
    {
      business: org.name,
      updated: new Date().toISOString().slice(0, 10),
      categories: grouped,
      note: 'Prices are a guide. Final pricing depends on the specifics of the job.',
    },
    { headers: cors }
  );
}
