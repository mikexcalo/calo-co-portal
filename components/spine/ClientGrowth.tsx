'use client';

/**
 * Getting a client found, as a checklist against that client.
 *
 * The same work Digital does for CALO&CO, pointed at somebody else: get their
 * site into Search Console, submit the sitemap, claim the map listing, turn
 * the review link on. It existed only as a 13px text link called "Search
 * setup" sitting in a row of links, beside one called "Their site" that opened
 * their homepage — so it read as a reference, not as work with a next step.
 *
 * Progress is stored in seo_tasks against (org_id, customer_id, key). That
 * column has been on the table since it was built and nothing had ever
 * written to it, because every screen that used seo_tasks passed
 * customer_id: null.
 *
 * This is also the answer to "what am I paying for". Every ticked line is
 * something done for them that they can be shown.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { save as saveOrFail } from '@/lib/spine/save';
import { orgNow } from '@/lib/spine/db';
import { Button, C, Card, SectionLabel, radius } from './ui';

interface Step {
  key: string;
  do: string;
  /** What they lose by not doing it. Always visible. */
  why: string;
  /** The actual clicks, if it needs them. */
  how?: string;
  link?: { label: string; href: string };
}

/**
 * The steps, in the order they pay off.
 *
 * Search Console first because it keeps no history from before you verify —
 * every day it is off is a day of data nobody can get back.
 */
function stepsFor(name: string, site: string | null): Step[] {
  const host = (site ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const domain = host || 'their domain';
  return [
    {
      key: 'gsc_verify',
      do: `Add ${domain} to Search Console`,
      why: 'It keeps no history from before the day you verify, so every day it is off is data nobody can get back.',
      how:
        '1. Open Search Console and press "Add property", top left.\n' +
        '2. Pick the LEFT box, "Domain". Not "URL prefix".\n' +
        `3. Type: ${domain} — no https://, no www.\n` +
        '4. Google gives you one long line starting google-site-verification=. Copy it.\n' +
        '5. Paste it here in chat and I will put it into DNS for you.\n' +
        '6. Come back to Google and press Verify.',
      link: { label: 'Search Console', href: 'https://search.google.com/search-console' },
    },
    {
      key: 'gsc_sitemap',
      do: 'Submit the sitemap',
      why: 'Without it Google finds pages by following links, and misses anything not linked from the homepage.',
      how:
        '1. In Search Console, left menu, Sitemaps.\n' +
        '2. Type: sitemap.xml\n' +
        '3. Press Submit. "Success" can take a day.',
    },
    {
      key: 'tag_on',
      do: 'Turn on visitor tracking',
      why: 'Numbers start the day you press it, not the day you look, so this is worth doing before anybody asks.',
      how: 'The tag is already on any site built here. Press Start collecting above.',
    },
    {
      key: 'gbp_claim',
      do: `Claim the Google Business Profile for ${name}`,
      why: 'Until somebody claims it, they do not appear in map results and anybody can edit the hours.',
      how:
        'Search the business name at business.google.com. If it is listed, press it and choose Claim this business; if not, Add your business. Verification is a postcard, about a week, so start it and do the rest while it is in the mail.',
      link: { label: 'business.google.com', href: 'https://business.google.com' },
    },
    {
      key: 'gbp_noaddress',
      do: 'Decide whether their address is published',
      why: 'Get it wrong and a home address is on the internet permanently.',
      how:
        'If customers do not come to them, answer No to "can customers visit?". Google still takes an address to verify and simply does not publish it. Saying no does not hide them from search.',
    },
    {
      key: 'nap',
      do: 'Put the same name, address and phone everywhere',
      why: 'Three slightly different spellings read to Google as three businesses that each know a third as much.',
      how: 'Search holds the block to copy, and the directories worth the time.',
      link: { label: 'Open their search setup', href: '/seo' },
    },
    {
      key: 'review_link',
      do: 'Set their review link',
      why: 'The only thing here that keeps working by itself after setup.',
      how:
        'From their profile: Read reviews, then Get more reviews, which gives a short g.page link. Once it is in, every finished, paid job asks for a review automatically.',
    },
  ];
}

export function ClientGrowth({
  customerId,
  clientName,
  website,
}: {
  customerId: string;
  clientName: string;
  website: string | null;
}) {
  const router = useRouter();
  const [ticks, setTicks] = useState<Record<string, 'done' | 'skipped' | false>>({});
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const steps = stepsFor(clientName, website);

  const load = useCallback(async () => {
    const org = await orgNow();
    if (!org) { setLoaded(true); return; }
    const res = await supabase
      .from('seo_tasks')
      .select('key, status')
      .eq('org_id', org)
      .eq('customer_id', customerId);
    const out: Record<string, 'done' | 'skipped' | false> = {};
    for (const r of (res.data ?? []) as Array<{ key: string; status: string }>) {
      if (r.status === 'done' || r.status === 'skipped') out[r.key] = r.status;
    }
    setTicks(out);
    setLoaded(true);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  /* Reverts if the write fails. A checkbox that lies about saving is worse
     than one that refuses — learned the hard way on the Digital plan. */
  const tick = async (key: string, next: 'done' | 'skipped' | false) => {
    const before = ticks[key] ?? false;
    setTicks((t) => ({ ...t, [key]: next }));
    const org = await orgNow();
    if (!org) return;
    const res = await saveOrFail(
      supabase.from('seo_tasks').upsert(
        { org_id: org, customer_id: customerId, key, status: next || 'todo' },
        { onConflict: 'org_id,customer_id,key' }
      )
    );
    if (res.error) setTicks((t) => ({ ...t, [key]: before }));
  };

  const done = steps.filter((s) => ticks[s.key] === 'done').length;
  const put = steps.filter((s) => ticks[s.key] === 'skipped').length;

  if (!loaded) return null;

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <SectionLabel>Getting them found</SectionLabel>
        <span style={{ fontSize: 12.5, color: done === steps.length ? C.green : C.faint, fontVariantNumeric: 'tabular-nums' }}>
          {done} of {steps.length}{put ? ` · ${put} skipped` : ''}
        </span>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {steps.map((st, i) => {
          const ticked = ticks[st.key] === 'done';
          const skipped = ticks[st.key] === 'skipped';
          const showing = open === st.key;
          return (
            <div key={st.key} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
              <div
                className="taskRow"
                style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '12px 16px', opacity: skipped ? 0.45 : 1 }}
              >
                <button
                  onClick={() => tick(st.key, ticked ? false : 'done')}
                  aria-label={ticked ? 'Done' : `Mark "${st.do}" done`}
                  style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1.5px solid ${ticked ? C.green : C.borderStrong}`,
                    background: ticked ? C.green : 'transparent',
                    color: '#fff', fontSize: 11, lineHeight: 1, cursor: 'pointer', padding: 0,
                  }}
                >
                  {ticked ? '✓' : ''}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14, color: ticked ? C.faint : C.text,
                      textDecoration: ticked ? 'line-through' : 'none',
                      textDecorationColor: C.border,
                    }}
                  >
                    {st.do}
                  </div>
                  {!ticked && !skipped && (
                    <div style={{ fontSize: 12.5, color: C.faint, marginTop: 3, lineHeight: 1.5 }}>
                      {st.why}
                    </div>
                  )}
                  {showing && st.how && (
                    <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.7, marginTop: 7, maxWidth: '58ch', whiteSpace: 'pre-line' }}>
                      {st.how}
                    </div>
                  )}
                  {showing && st.link && (
                    <div style={{ marginTop: 9 }}>
                      {st.link.href.startsWith('http') ? (
                        <a href={st.link.href} target="_blank" rel="noreferrer noopener" style={{ fontSize: 13, color: C.blue, textDecoration: 'none' }}>
                          {st.link.label} ↗
                        </a>
                      ) : (
                        <button
                          onClick={() => router.push(`${st.link!.href}?client=${customerId}`)}
                          style={{ background: 'transparent', border: 'none', padding: 0, fontSize: 13, color: C.blue, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          {st.link.label} →
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <span className="rowActions" style={{ flexShrink: 0 }}>
                  {st.how && (
                    <button onClick={() => setOpen(showing ? null : st.key)} className="rowBtn rowBtnWide">
                      {showing ? 'Less' : 'How'}
                    </button>
                  )}
                  <button
                    onClick={() => tick(st.key, ticks[st.key] ? false : 'skipped')}
                    className="rowBtn rowBtnWide"
                    title={skipped ? 'Put it back on the list' : 'Not for this client'}
                  >
                    {skipped ? 'Undo' : 'Skip'}
                  </button>
                </span>
              </div>
            </div>
          );
        })}
      </Card>

      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="ghost" onClick={() => router.push(`/seo?client=${customerId}`)}>
          Their address block and directories
        </Button>
      </div>
    </div>
  );
}
