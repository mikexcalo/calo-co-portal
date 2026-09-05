/**
 * The site, rendered from its sections, at a link anybody can open.
 *
 * A preview behind a login is a preview you cannot show to anyone, and the
 * whole point of reviewing a change is looking at it somewhere other than the
 * screen you made it on. This needs no session: the token is random and the
 * page reads nothing but the sections belonging to it.
 *
 * WHY IT RENDERS DRAFTS
 *
 * That is the job. It shows the draft where one exists and the published copy
 * everywhere else, which is exactly what the site would look like if you
 * published right now. A preview that showed the live version would answer a
 * question nobody asked.
 *
 * Server rendered on purpose, so the link works when it is pasted into a
 * message and opened by somebody who has never seen this product.
 */

import { createClient } from '@supabase/supabase-js';
import { SiteSection } from '@/components/site/SiteSection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  kind: string;
  variant: string;
  content: Record<string, string>;
  draft: Record<string, string> | null;
  live: boolean;
  sort: number;
}

export default async function PreviewPage({ params }: { params: { token: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    return <Bare title="Preview is not configured" body="The server is missing its keys." />;
  }

  /**
   * Service role, because there is no session here.
   *
   * Everything read below is pinned to the org that owns this token, so a
   * token is the only thing that grants access and it grants access to exactly
   * one site.
   */
  const db = createClient(url, service, { auth: { persistSession: false } });

  const { data: org } = await db
    .from('orgs')
    .select('id, name')
    .eq('site_preview_token', params.token)
    .maybeSingle();

  if (!org) {
    return <Bare title="Nothing here" body="That preview link is not valid, or it has been changed." />;
  }

  const { data } = await db
    .from('site_sections')
    .select('id, kind, variant, content, draft, live, sort')
    .eq('org_id', org.id)
    .is('customer_id', null)
    .order('sort');

  const rows = ((data ?? []) as Row[]).filter((r) => r.live);
  const pending = rows.filter((r) => r.draft).length;

  if (rows.length === 0) {
    return <Bare title={org.name} body="No sections on this site yet. Add one in Your website." />;
  }

  return (
    <div style={{ background: '#FFFFFF', color: '#141414', minHeight: '100vh' }}>
      {/* Said plainly at the top, because a preview mistaken for the live site
          is how somebody sends a client a half-finished sentence. */}
      <div
        style={{
          background: '#141414', color: '#FFFFFF', fontSize: 12.5,
          padding: '7px 16px', textAlign: 'center', letterSpacing: '.01em',
        }}
      >
        Preview of {org.name}
        {pending > 0
          ? ` — showing ${pending} unpublished ${pending === 1 ? 'edit' : 'edits'}`
          : ' — nothing unpublished, this is the live version'}
      </div>

      {rows.map((r) => (
        <SiteSection key={r.id} kind={r.kind} variant={r.variant} data={r.draft ?? r.content} />
      ))}
    </div>
  );
}

function Bare({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#FFFFFF', color: '#141414', padding: 24, textAlign: 'center',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 14, color: '#5B6069' }}>{body}</div>
      </div>
    </div>
  );
}
