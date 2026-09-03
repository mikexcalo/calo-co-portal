/**
 * The ingest endpoint.
 *
 * A pipe. It knows two things the database cannot: the caller's address and
 * their user agent. It hands both over as one opaque seed and never stores
 * either, and the database salts that seed per site and per day into something
 * that cannot be reversed or matched across days.
 *
 * Everything else that has to be right, including which tokens are real and
 * what a valid event looks like, lives in record_site_event. Logic here is
 * logic that has to be correct in two places.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/**
 * Answers everything, including failures.
 *
 * A tracker that can tell a real token from a fake one is a tracker somebody
 * can use to enumerate them, and a beacon has nobody listening for the reply
 * anyway. The only status that means anything here is "received".
 */
const ok = () =>
  new NextResponse(null, {
    status: 204,
    headers: {
      // The whole point is being called from somebody else's domain.
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

interface Body {
  t?: string;
  ev?: string;
  p?: string;
  ref?: string;
  utm?: { source?: string; medium?: string; campaign?: string };
  vw?: number;
  gx?: number;
  gy?: number;
  scroll?: number;
  label?: string;
}

/** Three buckets, from the width the page reported. Parsing user agent strings
 *  for device names is a losing game that has to be maintained forever. */
function device(vw: number | undefined): string | null {
  if (!vw || !Number.isFinite(vw)) return null;
  if (vw < 640) return 'phone';
  if (vw < 1024) return 'tablet';
  return 'desktop';
}

const int = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return ok();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return ok();
  }
  if (!body?.t || !body?.ev) return ok();

  /**
   * The seed, built and immediately handed off.
   *
   * x-forwarded-for is a list when proxies chain; the first entry is the
   * client and the rest are infrastructure. Taking the last one would key
   * every visitor behind the same CDN to one session.
   */
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const ip = fwd.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const ua = req.headers.get('user-agent') ?? 'unknown';

  const vw = int(body.vw) ?? undefined;

  const db = createClient(url, anon, { auth: { persistSession: false } });
  await db.rpc('record_site_event', {
    t: body.t,
    ev: body.ev,
    p: body.p ?? '/',
    seed: `${ip}|${ua}`,
    ref: body.ref ?? null,
    utm: {
      source: body.utm?.source ?? null,
      medium: body.utm?.medium ?? null,
      campaign: body.utm?.campaign ?? null,
    },
    dev: device(vw),
    // Vercel resolves this at the edge, so nothing has to be geolocated here.
    ctry: req.headers.get('x-vercel-ip-country') ?? null,
    vw: vw ?? null,
    gx: int(body.gx),
    gy: int(body.gy),
    scroll: int(body.scroll),
    lbl: body.label ?? null,
  });

  // Errors are swallowed deliberately. A analytics failure must never be
  // visible on somebody's website, and there is nothing the page could do.
  return ok();
}
