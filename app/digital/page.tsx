'use client';

/**
 * Digital: the whole of how a business is found and judged online.
 *
 * "Being found" named one of the four things behind it, so search checklists
 * were discoverable and analytics were not. Somebody looking for their traffic
 * numbers does not think "being found", they think website, or analytics, or
 * digital. The word on the row has to be the word in their head.
 *
 * This screen exists because the module had no home. Clicking the row dropped
 * you straight into the search checklist, which is one tab of four and the
 * most tedious one, so the module read as a chore rather than a place.
 *
 * Each card shows real state and nothing else. A dashboard that says "SEO:
 * good" without saying what it measured is worse than no dashboard, because
 * it is believed.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { SEO_TASKS } from '@/lib/spine/seo';
import { Button, C, Card, DIGITAL_TABS, Empty, Page, SectionLabel } from '@/components/spine/ui';
import { Glyph, type IconName } from '@/components/spine/icons';

interface Panel {
  icon: IconName;
  title: string;
  /** The number that matters, or null when nothing has happened yet. */
  headline: string;
  /** What that number is, in words somebody would use out loud. */
  detail: string;
  /** What to do next, when there is something. */
  cta: string;
  href: string;
  tone: 'green' | 'amber' | 'neutral';
}

export default function DigitalPage() {
  const router = useRouter();
  const [panels, setPanels] = useState<Panel[] | null>(null);
  const [gbp, setGbp] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [sites, tasks, reviews, profile] = await Promise.all([
      supabase.from('client_sites').select('id, name, analytics_on, customer_id'),
      supabase.from('seo_tasks').select('key, status'),
      supabase.from('review_requests').select('id, sent_at, clicked_at'),
      supabase.from('seo_profile').select('gbp_url, site_url').is('customer_id', null).maybeSingle(),
    ]);

    const siteRows = sites.data ?? [];
    const tracking = siteRows.filter((s) => s.analytics_on);
    const mine = siteRows.filter((s) => !s.customer_id);

    const done = (tasks.data ?? []).filter((t) => t.status === 'done').length;
    const total = SEO_TASKS.length;

    const sent = (reviews.data ?? []).filter((r) => r.sent_at).length;
    const clicked = (reviews.data ?? []).filter((r) => r.clicked_at).length;

    const gbpUrl = (profile.data as { gbp_url?: string } | null)?.gbp_url ?? null;
    setGbp(gbpUrl);

    setPanels([
      {
        icon: 'chart',
        title: 'Traffic',
        headline: tracking.length ? `${tracking.length} site${tracking.length === 1 ? '' : 's'} collecting` : 'Not collecting',
        detail: tracking.length
          ? 'Cookieless, first party, no banner needed. Numbers start from the day the tag went live.'
          : siteRows.length
            ? `${siteRows.length} site${siteRows.length === 1 ? '' : 's'} on file and none measured. One script tag each.`
            : 'No sites on file yet. Add one and it can be measured.',
        cta: tracking.length ? 'Open traffic' : 'Set up tracking',
        href: '/traffic',
        tone: tracking.length ? 'green' : 'amber',
      },
      {
        icon: 'search',
        title: 'Search',
        headline: `${done} of ${total} done`,
        detail: done === 0
          ? 'Nothing started. The first step is deciding whether to publish an address, because everything else depends on it.'
          : done < total
            ? 'The checklist in the order the decisions have to be made. Each one feeds the next.'
            : 'Every step marked done. Worth revisiting whenever the services or the area change.',
        cta: done < total ? 'Continue the checklist' : 'Review it',
        href: '/seo',
        tone: done === 0 ? 'amber' : done < total ? 'neutral' : 'green',
      },
      {
        icon: 'star',
        title: 'Ratings and reviews',
        headline: sent === 0 ? 'None asked' : `${clicked} of ${sent} clicked`,
        detail: sent === 0
          ? 'Finished, paid-up jobs can ask automatically. The difference between forty reviews and four is almost always that one of them asks.'
          : 'Clicks are the honest measure. Google will not say who left a review, so attributing one would be inventing a number.',
        cta: sent === 0 ? 'Set the review link' : 'Open reviews',
        href: '/reviews',
        tone: sent === 0 ? 'amber' : clicked > 0 ? 'green' : 'neutral',
      },
      {
        icon: 'globe',
        title: 'Google Business Profile',
        headline: gbpUrl ? 'Claimed' : 'Not claimed',
        detail: gbpUrl
          ? 'The profile is on file. The star rating itself lives at Google and is not read in here, so open it to see where it stands.'
          : 'Until it is claimed you do not appear in map results, and anybody can edit it. Verification is a postcard, about a week.',
        cta: gbpUrl ? 'Open the profile' : 'How to claim it',
        href: gbpUrl ?? '/seo',
        tone: gbpUrl ? 'green' : 'amber',
      },
    ]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const tone = (t: Panel['tone']) =>
    t === 'green' ? C.green : t === 'amber' ? C.amber : C.faint;

  return (
    <Page
      title="Digital"
      subtitle="How the business is found online, and what happens when somebody arrives."
      tabs={DIGITAL_TABS}
    >
      {!panels ? (
        <Empty>Loading…</Empty>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: 12,
            }}
          >
            {panels.map((p) => (
              <Card key={p.title}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                  <Glyph name={p.icon} color={tone(p.tone)} size={16} />
                  <span style={{ fontSize: 13, color: C.dim, fontWeight: 500 }}>{p.title}</span>
                  <span
                    style={{
                      width: 6, height: 6, borderRadius: '50%', background: tone(p.tone),
                      marginLeft: 'auto', flexShrink: 0,
                    }}
                  />
                </div>

                <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 5 }}>
                  {p.headline}
                </div>

                <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.6, marginBottom: 12 }}>
                  {p.detail}
                </div>

                {/* An external profile opens in a tab; everything else is a
                    route, and the two should not look identical. */}
                {p.href.startsWith('http') ? (
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ fontSize: 13, color: C.accent, textDecoration: 'none' }}
                  >
                    {p.cta} ↗
                  </a>
                ) : (
                  <button
                    onClick={() => router.push(p.href)}
                    style={{
                      background: 'transparent', border: 'none', padding: 0,
                      color: C.accent, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {p.cta} →
                  </button>
                )}
              </Card>
            ))}
          </div>

        </>
      )}
    </Page>
  );
}
