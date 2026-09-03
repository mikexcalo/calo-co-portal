'use client';

/**
 * Their website, and whether it is being measured.
 *
 * This is the sellable half of analytics. The module switch above decides
 * whether the client can *see* traffic; this decides whether traffic is being
 * *collected*, and the two are deliberately separate: you install the tag,
 * let a fortnight of real numbers accumulate, and only then set the module
 * live. A client who opens a brand new traffic screen sees zeros and concludes
 * the thing they paid for does not work.
 *
 * The tag is shown rather than hidden behind a copy button alone, because the
 * person pasting it into Wix is often not the person reading this screen, and
 * a snippet you can read out is a snippet you can hand over.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, SectionLabel, inputStyle } from './ui';

interface Site {
  id: string;
  name: string;
  url: string | null;
  analytics_on: boolean;
  track_token: string | null;
}

/** Where the tracker is served from. Same origin as the portal. */
const ORIGIN = 'https://calo-co-portal.vercel.app';

export function TheirSite({
  customerId,
  clientName,
  orgId,
  website,
}: {
  customerId: string;
  clientName: string;
  orgId: string;
  website: string | null;
}) {
  const [site, setSite] = useState<Site | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');

  const load = useCallback(async () => {
    const res = await supabase
      .from('client_sites')
      .select('id, name, url, analytics_on, track_token')
      .eq('customer_id', customerId)
      .maybeSingle();
    if (!res.error) setSite((res.data as Site) ?? null);
    setLoaded(true);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  /**
   * Created on demand, seeded from the client record.
   *
   * The URL is usually already on the client, so asking for it again is asking
   * somebody to retype something the system knows.
   */
  const create = async () => {
    const clean = (url.trim() || website || '').trim();
    if (!clean) return;
    setBusy(true);
    await supabase.from('client_sites').insert({
      org_id: orgId,
      customer_id: customerId,
      name: clientName,
      url: clean.startsWith('http') ? clean : `https://${clean}`,
    });
    setBusy(false);
    setUrl('');
    load();
  };

  const toggle = async () => {
    if (!site) return;
    setBusy(true);
    await supabase.from('client_sites').update({ analytics_on: !site.analytics_on }).eq('id', site.id);
    setBusy(false);
    load();
  };

  if (!loaded) return null;

  const tag = site?.track_token
    ? `<script async src="${ORIGIN}/t.js" data-site="${site.track_token}"></script>`
    : '';

  return (
    <div style={{ marginBottom: 26 }}>
      <SectionLabel>Their website</SectionLabel>
      <Card>
        {!site ? (
          <>
            <div style={{ fontSize: 13.5, color: C.dim, marginBottom: 10, maxWidth: '60ch', lineHeight: 1.6 }}>
              No site on file. Add one and you can measure it, which is the first thing worth
              selling: nobody argues with their own numbers.
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={website ?? 'their-site.com'}
                style={{ ...inputStyle, flex: '1 1 220px' }}
              />
              <Button onClick={create} disabled={busy || !(url.trim() || website)}>
                {busy ? 'Saving…' : 'Add their site'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <span
                style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: site.analytics_on ? C.green : C.borderStrong,
                }}
              />
              {site.url && (
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ fontSize: 14, color: C.text, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              )}
              <span style={{ fontSize: 12.5, color: C.faint }}>
                {site.analytics_on ? 'collecting' : 'not collecting'}
              </span>
              <Button variant="ghost" onClick={toggle} disabled={busy}>
                {site.analytics_on ? 'Stop' : 'Start collecting'}
              </Button>
            </div>

            <pre
              style={{
                background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 7,
                padding: '10px 12px', fontSize: 12, color: C.text, overflowX: 'auto',
                margin: '0 0 10px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              {tag}
            </pre>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                onClick={() => {
                  navigator.clipboard?.writeText(tag);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? 'Copied' : 'Copy the tag'}
              </Button>
              <span style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.55, flex: '1 1 260px' }}>
                Head of every page. On Wix that is Settings, then Custom Code. Collect for a
                fortnight before setting their traffic module live, so the screen has something
                in it the day they first open it.
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
