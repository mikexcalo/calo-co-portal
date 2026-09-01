/**
 * Approve a site change request and hand it off to be built.
 *
 * HOW THE HANDOFF ACTUALLY WORKS — read this before believing the button.
 *
 * A web app cannot reach into a coding agent and make it start working. There
 * is no inbound socket to Claude Code sitting on Mike's laptop. What this does
 * instead is produce an unambiguous, machine-readable BUILD BRIEF and put it
 * somewhere an agent reliably looks:
 *
 *   1. Writes the approved brief back onto the request (approve-or-modify:
 *      what gets built is Mike's edit, not the client's midnight paragraph)
 *   2. Opens a GitHub issue on the site's repo, labeled `nautilus-build`
 *   3. Moves the request to `building` and stores the issue URL
 *
 * A Claude Code session — run by hand, or a scheduled cloud agent — picks up
 * open `nautilus-build` issues and implements them, closing the issue with the
 * deploy URL. That last hop is a person or a schedule, not magic, and calling
 * it magic would just mean it silently doesn't happen.
 *
 * Requires GITHUB_TOKEN with `repo` scope. Without it the brief is still
 * written and the request still moves — you just file it yourself.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PRODUCT } from '@/lib/brand';

export const runtime = 'nodejs';

interface ApproveBody {
  requestId: string;
  /** Mike's edited brief. Falls back to the client's text if absent. */
  brief?: string;
  noteToClient?: string;
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** The brief an agent actually reads. Structure matters more than prose. */
function buildBrief(opts: {
  title: string;
  brief: string;
  kind: string;
  urgency: string;
  siteName: string;
  siteUrl: string | null;
  requester: string;
  requestId: string;
}): string {
  return `## Request

${opts.brief}

## Context

| | |
|---|---|
| Site | ${opts.siteName}${opts.siteUrl ? ` — ${opts.siteUrl}` : ''} |
| Type | ${opts.kind} |
| Urgency | ${opts.urgency} |
| Requested by | ${opts.requester} |
| ${PRODUCT} request | \`${opts.requestId}\` |

## Rules for this build

- Change **only** what the request asks for. No drive-by refactors, no
  reformatting untouched files, no dependency bumps.
- Read the target file before editing it. Match the surrounding style.
- Run the build before pushing. If it fails, fix it or stop — never push red.
- If the request is ambiguous, stop and say what's ambiguous rather than
  guessing. A wrong guess ships to a paying client's live website.

## Done when

- The change is live on the site
- This issue is closed with the deploy URL
`;
}

export async function POST(req: NextRequest) {
  let body: ApproveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.requestId) {
    return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
  }

  try {
    const db = admin();

    const { data: request, error } = await db
      .from('site_requests')
      .select('*, site:client_sites(id, name, url, repo)')
      .eq('id', body.requestId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const site = request.site as
      | { id: string; name: string; url: string | null; repo: string | null }
      | null;

    const brief = (body.brief ?? request.body ?? '').trim();
    if (!brief) {
      return NextResponse.json({ error: 'The brief cannot be empty' }, { status: 400 });
    }

    const markdown = buildBrief({
      title: request.title,
      brief,
      kind: request.kind,
      urgency: request.urgency,
      siteName: site?.name ?? 'Unknown site',
      siteUrl: site?.url ?? null,
      requester: request.requester_name || request.requester_email || 'Client',
      requestId: request.id,
    });

    let issueUrl: string | null = null;
    let handoffNote =
      'Approved. No repo is configured for this site, so file the brief wherever you build it.';

    const ghToken = process.env.GITHUB_TOKEN;

    if (site?.repo && ghToken) {
      const res = await fetch(`https://api.github.com/repos/${site.repo}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `[${PRODUCT}] ${request.title}`,
          body: markdown,
          labels: ['nautilus-build', request.urgency === 'urgent' ? 'urgent' : 'queued'],
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        // Don't fail the approval — the decision is real even if filing failed.
        console.error('[site-requests/approve] GitHub:', payload?.message);
        handoffNote = `Approved, but filing the issue failed: ${
          payload?.message ?? res.status
        }. The brief is saved on the request.`;
      } else {
        issueUrl = payload.html_url;
        handoffNote = 'Approved and filed. An agent can pick this up from the repo.';
      }
    } else if (site?.repo && !ghToken) {
      handoffNote =
        'Approved. GITHUB_TOKEN is not set, so nothing was filed — the brief is saved on the request.';
    }

    const { error: updErr } = await db
      .from('site_requests')
      .update({
        status: issueUrl ? 'building' : 'approved',
        approved_brief: brief,
        note_to_client: body.noteToClient?.trim() || null,
        issue_url: issueUrl,
        decided_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ ok: true, issueUrl, brief: markdown, note: handoffNote });
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[site-requests/approve]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
