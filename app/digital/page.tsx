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
import { DIGITAL_PLAN } from '@/lib/spine/digital-plan';
import { Button, C, Card, DIGITAL_TABS, Empty, Page, SectionLabel } from '@/components/spine/ui';
import { Glyph, type IconName } from '@/components/spine/icons';
import { orgNow } from '@/lib/spine/db';

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

  /* Counted from today rather than hardcoded, so it goes quiet on its own. */
  const EXPIRES = '2026-09-28';
  const daysLeft = Math.max(
    0,
    Math.ceil((Date.parse(`${EXPIRES}T23:59:59Z`) - Date.now()) / 86400000)
  );
  const oldDomainLive = daysLeft > 0;

  /*
    Progress lives in seo_tasks, which already exists and already stores a
    key and a status per workspace. A second table for the same idea is how
    you end up with two places that disagree about what is done.
  */
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [openTrack, setOpenTrack] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<string | null>(null);

  const tick = useCallback(async (key: string, on: boolean) => {
    setTicks((t) => ({ ...t, [key]: on }));
    const org = await orgNow();
    if (!org) return;
    await supabase.from('seo_tasks').upsert(
      { org_id: org, customer_id: null, key, status: on ? 'done' : 'todo' },
      { onConflict: 'org_id,customer_id,key' }
    );
  }, []);

  const load = useCallback(async () => {
    const [sites, tasks, reviews, profile] = await Promise.all([
      supabase.from('client_sites').select('id, name, analytics_on, customer_id').eq('org_id', await orgNow()),
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
      /*
        The old domain, while there is still time to do anything about it.

        This belongs on the screen called "how people find you online", because
        that is exactly what it is: every link anybody has ever sent to
        mikecalo.co, and every result Google holds for it. It is on Home as a
        task with the full steps; this is the same thing where somebody looking
        at their web presence would expect to trip over it.

        It is dated, so it disappears once the date has passed rather than
        sitting there as a permanent reminder of something nobody can act on.
      */
      ...(oldDomainLive
        ? [{
            icon: 'globe' as const,
            title: 'mikecalo.co',
            headline: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
            detail:
              'Expires 28 September and redirects nowhere, so every link to it breaks and every result Google holds for it disappears rather than moving to calo.company. Renewing is the part that matters: a redirect only passes anything while somebody can still follow it.',
            cta: 'The steps are on Home',
            href: '/',
            tone: 'amber' as const,
          }]
        : []),
    ]);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const org = await orgNow();
      if (org) {
        const res = await supabase
          .from('seo_tasks')
          .select('key, status')
          .eq('org_id', org)
          .is('customer_id', null);
        const out: Record<string, boolean> = {};
        for (const r of (res.data ?? []) as Array<{ key: string; status: string }>) {
          out[r.key] = r.status === 'done';
        }
        setTicks(out);
      }
      setLoaded(true);
    })();
  }, []);


  return (
    <Page
      title="Digital"
      subtitle="How people find you online."
      tabs={DIGITAL_TABS}
    >
      {/*
        One ordered plan, not four overlapping lists.

        This screen showed four status cards, and behind them sat a seven-step
        setup order, a seven-item checklist saying much the same thing, a
        directory list, and a set of Home tasks covering the same ground again.
        Two of them contradicted each other on whether to keep the old domain.
        None of them said what to do first.

        Three tracks, in the order they are worth doing: there is no point
        measuring traffic to a site nobody can find, or claiming a map listing
        for a business nobody searches by name. Closed by default, open the one
        you are on.
      */}
      {!loaded ? (
        <Empty>Loading…</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 820 }}>
          {DIGITAL_PLAN.map((track, ti) => {
            const total = track.steps.length;
            const done = track.steps.filter((st) => st.done === 'built' || ticks[st.key]).length;
            const open = openTrack === track.key;
            const finished = done === total;
            return (
              <Card key={track.key} style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenTrack(open ? null : track.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    background: 'transparent', border: 'none', textAlign: 'left',
                    padding: '16px 18px', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <span
                    style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600,
                      background: finished ? C.greenSoft : C.panelAlt,
                      color: finished ? C.green : C.dim,
                      border: `1px solid ${finished ? C.green + '55' : C.border}`,
                    }}
                  >
                    {finished ? '\u2713' : ti + 1}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: C.text }}>
                      {track.title}
                    </span>
                    <span style={{ display: 'block', fontSize: 12.5, color: C.faint, marginTop: 2, lineHeight: 1.5 }}>
                      {track.promise}
                    </span>
                  </span>
                  <span style={{ fontSize: 12.5, color: finished ? C.green : C.faint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {done} of {total}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      fontSize: 10, color: C.faint, flexShrink: 0,
                      transform: open ? 'rotate(90deg)' : 'none',
                      transition: 'transform .18s ease',
                    }}
                  >
                    \u25b6
                  </span>
                </button>

                {open && (
                  <div style={{ borderTop: `1px solid ${C.border}` }}>
                    {track.steps.map((st, si) => {
                      const built = st.done === 'built';
                      const ticked = built || !!ticks[st.key];
                      const showing = openStep === st.key;
                      return (
                        <div key={st.key} style={{ borderTop: si === 0 ? 'none' : `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '12px 18px' }}>
                            {/* Anything already done is ticked and not
                                clickable, because unticking it would not undo
                                it and a checkbox that lies is worse than none. */}
                            <button
                              onClick={() => !built && tick(st.key, !ticks[st.key])}
                              disabled={built}
                              aria-label={ticked ? 'Done' : `Mark "${st.do}" done`}
                              style={{
                                width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 2,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: `1.5px solid ${ticked ? C.green : C.borderStrong}`,
                                background: ticked ? C.green : 'transparent',
                                color: '#fff', fontSize: 11, lineHeight: 1,
                                cursor: built ? 'default' : 'pointer', padding: 0,
                              }}
                            >
                              {ticked ? '\u2713' : ''}
                            </button>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <button
                                onClick={() => setOpenStep(showing ? null : st.key)}
                                style={{
                                  background: 'transparent', border: 'none', padding: 0, textAlign: 'left',
                                  font: 'inherit', cursor: 'pointer', width: '100%',
                                  color: ticked ? C.faint : C.text,
                                  textDecoration: ticked ? 'line-through' : 'none',
                                  textDecorationColor: C.border,
                                }}
                              >
                                {st.do}
                                {built && (
                                  <span style={{ marginLeft: 8, fontSize: 11, color: C.green, textDecoration: 'none', display: 'inline-block' }}>
                                    already done
                                  </span>
                                )}
                              </button>

                              {showing && st.note && (
                                <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, marginTop: 7, maxWidth: '62ch' }}>
                                  {st.note}
                                </div>
                              )}

                              {showing && st.where && (
                                <div style={{ marginTop: 10 }}>
                                  {st.where.href.startsWith('http') ? (
                                    <a
                                      href={st.where.href}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      style={{ fontSize: 13, color: C.blue, textDecoration: 'none' }}
                                    >
                                      {st.where.label} &nearr;
                                    </a>
                                  ) : (
                                    <button
                                      onClick={() => router.push(st.where!.href)}
                                      style={{ background: 'transparent', border: 'none', padding: 0, fontSize: 13, color: C.blue, cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                      {st.where.label} &rarr;
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {!showing && st.note && (
                              <span style={{ fontSize: 12, color: C.faint, flexShrink: 0 }}>How</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
