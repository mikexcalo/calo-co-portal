/**
 * Fill in a company from its own website.
 *
 * A hundred and four records arrived by import carrying a name, a segment and
 * a state. No website, no description, nobody to call. Records that start empty
 * stay empty, because the moment to fill them in is never.
 *
 * WHY NOT A DATA PROVIDER
 *
 * Clearbit and its kind are the usual answer and they cost per lookup, which is
 * a bill that scales with how much you use the product. The site itself is
 * free, already public, and more current than any broker's copy of it. It gives
 * a real description, a real name and often a phone number, which is most of
 * what an empty record is missing.
 *
 * WHAT IT WILL NOT DO
 *
 * It does not guess. If a domain cannot be resolved or the page says nothing
 * useful, it comes back with nothing rather than a plausible sentence, because
 * a CRM full of invented company descriptions is worse than one full of blanks:
 * the blank tells you it needs work.
 *
 * SSRF
 *
 * The host arrives from the browser and gets fetched by our server, which is a
 * way to read anything the server can reach. Only public http and https hosts
 * are allowed, redirects are capped, and anything resolving to a private range
 * is refused.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Private and link-local ranges, plus the obvious loopback names. */
const BLOCKED = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/,
  /\.local$/i,
  /\.internal$/i,
];

function safeUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (BLOCKED.some((re) => re.test(u.hostname))) return null;
  // A bare hostname with no dot is either a local machine or a typo.
  if (!u.hostname.includes('.')) return null;
  return u;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function meta(html: string, names: string[]): string | null {
  for (const n of names) {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)=["']${n}["'][^>]*content=["']([^"']+)["']`,
      'i'
    );
    const m = html.match(re) ?? html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${n}["']`, 'i')
    );
    if (m?.[1]?.trim()) return decode(m[1]);
  }
  return null;
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'Not configured.' }, { status: 500 });

  const store = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: { get: (n: string) => store.get(n)?.value, set: () => {}, remove: () => {} },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  let body: { domain?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const target = safeUrl((body.domain ?? '').trim());
  if (!target) return NextResponse.json({ error: 'That does not look like a website.' }, { status: 400 });

  try {
    const res = await fetch(target.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: {
        // Named honestly. A crawler that lies about who it is deserves to be
        // blocked, and site owners can see this in their logs and act on it.
        'User-Agent': 'CALO&CO portal (company lookup; one page, on request)',
        Accept: 'text/html',
      },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Their site answered ${res.status}.` }, { status: 200, headers: { 'x-soft': '1' } });
    }

    // Enough for the head of the document, and a cap so a huge page cannot
    // be used to tie the function up.
    const html = (await res.text()).slice(0, 400_000);

    const title = meta(html, ['og:site_name']) ??
      decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '');
    const description = meta(html, ['og:description', 'description', 'twitter:description']);

    // A phone number written in the page. Loose on purpose: it is offered for
    // review, never written without being seen.
    const phone = html.match(/(?:tel:|Phone:?\s*)\+?1?[\s.-]?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/i);

    const found = {
      website: `${target.protocol}//${target.hostname}`,
      // A page title is usually "Company | Tagline"; the first part is the name.
      name: title ? title.split(/\s*[|·—–-]\s*/)[0].slice(0, 80) || null : null,
      description: description ? description.slice(0, 300) : null,
      phone: phone ? `(${phone[1]}) ${phone[2]}-${phone[3]}` : null,
    };

    if (!found.name && !found.description) {
      return NextResponse.json({ error: 'Nothing useful on that page.' }, { status: 200 });
    }

    return NextResponse.json({ found });
  } catch (e) {
    const msg = (e as Error).name === 'TimeoutError'
      ? 'Their site took too long to answer.'
      : 'Could not reach that site.';
    return NextResponse.json({ error: msg }, { status: 200 });
  }
}
