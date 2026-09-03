'use client';

/**
 * Who showed up.
 *
 * Four numbers, where they came from, which pages, and how far down anybody
 * got. That is the whole screen, because those are the questions somebody
 * actually has about a website and everything else is a chart nobody acts on.
 *
 * Visitors and views are shown as separate numbers on purpose. One visitor who
 * read six pages is not six visitors, and every analytics product that blurs
 * the two does it in the flattering direction.
 *
 * Nothing here is retrospective. If a site was switched on yesterday, this
 * starts yesterday, and it says so rather than drawing a flat line back
 * through time as though there were data.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import {
  Button,
  C,
  Card,
  Empty,
  Page,
  DIGITAL_TABS,
  SectionLabel,
} from '@/components/spine/ui';

interface Site {
  id: string;
  name: string;
  url: string | null;
  analytics_on: boolean;
  track_token: string | null;
}

interface Day {
  day: string;
  views: number;
  visitors: number;
  clicks: number;
  goals: number;
  read_to_end: number;
}

interface Source { source: string; visitors: number }
interface PageRow { path: string; views: number; visitors: number; clicks: number }

const num = (n: number) => n.toLocaleString();

export default function TrafficPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadSites = useCallback(async () => {
    const res = await supabase
      .from('client_sites')
      .select('id, name, url, analytics_on, track_token')
      .order('name');
    const rows = (res.data ?? []) as Site[];
    setSites(rows);
    // Prefer one that is actually collecting, so the screen opens on data
    // rather than on an empty state you have to click past.
    setSiteId((cur) => cur ?? rows.find((s) => s.analytics_on)?.id ?? rows[0]?.id ?? null);
  }, []);

  const loadData = useCallback(async (id: string) => {
    const [d, s, p] = await Promise.all([
      supabase.from('site_traffic_daily').select('*').eq('site_id', id).order('day', { ascending: false }).limit(30),
      supabase.from('site_sources_30d').select('source, visitors').eq('site_id', id).order('visitors', { ascending: false }).limit(12),
      supabase.from('site_pages_30d').select('path, views, visitors, clicks').eq('site_id', id).order('visitors', { ascending: false }).limit(15),
    ]);
    setDays((d.data ?? []) as Day[]);
    setSources((s.data ?? []) as Source[]);
    setPages((p.data ?? []) as PageRow[]);
    setLoaded(true);
  }, []);

  useEffect(() => { loadSites(); }, [loadSites]);
  useEffect(() => { if (siteId) loadData(siteId); }, [siteId, loadData]);

  const site = sites.find((s) => s.id === siteId) ?? null;

  const totals = useMemo(() => {
    const t = { views: 0, visitors: 0, clicks: 0, read: 0 };
    days.forEach((d) => {
      t.views += d.views;
      // Summing distinct-per-day sessions overcounts anybody who came twice in
      // a month. Named "visits" rather than "people" for exactly that reason.
      t.visitors += d.visitors;
      t.clicks += d.clicks;
      t.read += d.read_to_end;
    });
    return t;
  }, [days]);

  const toggle = async () => {
    if (!site) return;
    await supabase.from('client_sites').update({ analytics_on: !site.analytics_on }).eq('id', site.id);
    loadSites();
  };

  const snippet = site?.track_token
    ? `<script async src="https://calo-co-portal.vercel.app/t.js" data-site="${site.track_token}"></script>`
    : '';

  const peak = Math.max(1, ...days.map((d) => d.visitors));

  return (
    <Page
      title="Traffic"
      subtitle="Who arrived, where from, and how far they got."
      tabs={DIGITAL_TABS}
      action={
        sites.length > 1 ? (
          <select
            value={siteId ?? ''}
            onChange={(e) => { setLoaded(false); setSiteId(e.target.value); }}
            style={{
              background: C.panelAlt, color: C.text, border: `1px solid ${C.border}`,
              borderRadius: 7, padding: '7px 10px', fontSize: 13.5, fontFamily: 'inherit',
            }}
          >
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : undefined
      }
    >
      {!site ? (
        <Card>
          <Empty>No sites yet. Add one on a client&apos;s record, or in Digital, and it shows up here.</Empty>
        </Card>
      ) : !site.analytics_on ? (
        /* The install, which is the only thing worth showing until it is on. */
        <Card>
          <div style={{ fontSize: 14.5, fontWeight: 500, color: C.text, marginBottom: 6 }}>
            Not collecting yet
          </div>
          <div style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.6, marginBottom: 14, maxWidth: '62ch' }}>
            One script tag, and nothing else to install. It sets no cookies and stores nothing
            in the browser, so it needs no consent banner. Numbers start from the moment it
            goes live, not before.
          </div>

          <pre
            style={{
              background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 7,
              padding: '11px 13px', fontSize: 12.5, color: C.text, overflowX: 'auto',
              margin: '0 0 12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {snippet}
          </pre>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              onClick={() => {
                navigator.clipboard?.writeText(snippet);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Copied' : 'Copy the tag'}
            </Button>
            <Button variant="ghost" onClick={toggle}>Start collecting</Button>
          </div>

          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
            On Wix: Settings, then Custom Code, add it to the head on all pages. Turning
            this on before the tag is live is harmless; it just records nothing.
          </div>
        </Card>
      ) : !loaded ? (
        <Empty>Loading…</Empty>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 10,
              marginBottom: 22,
            }}
          >
            {[
              ['Visits', num(totals.visitors), 'Sessions, counted once a day each'],
              ['Pages read', num(totals.views), 'One per visit per page'],
              ['Clicks', num(totals.clicks), 'On links and buttons'],
              ['Got to the end', num(totals.read), 'Scrolled past three quarters'],
            ].map(([label, value, help]) => (
              <Card key={label}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: C.faint, marginBottom: 5 }}>
                  {label}
                </div>
                <div style={{ fontSize: 23, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                  {value}
                </div>
                <div style={{ fontSize: 11.5, color: C.faint, marginTop: 3 }}>{help}</div>
              </Card>
            ))}
          </div>

          {days.length === 0 ? (
            <Card>
              <Empty>
                Collecting, but nothing has arrived yet. Check the tag is on the page, then
                load the site once yourself.
              </Empty>
            </Card>
          ) : (
            <>
              <SectionLabel>Last {days.length} days</SectionLabel>
              <Card style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>
                  {[...days].reverse().map((d) => (
                    <div
                      key={d.day}
                      title={`${d.day}: ${d.visitors} visits, ${d.views} pages`}
                      style={{
                        flex: 1,
                        minWidth: 3,
                        // Floor of 2px, so a day with one visitor is visibly
                        // different from a day with none.
                        height: `${Math.max(2, (d.visitors / peak) * 100)}%`,
                        background: d.visitors > 0 ? C.accent : C.border,
                        borderRadius: 2,
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.faint, marginTop: 7 }}>
                  <span>{days[days.length - 1]?.day}</span>
                  <span>{days[0]?.day}</span>
                </div>
              </Card>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 22 }}>
                <div>
                  <SectionLabel>Where from</SectionLabel>
                  <Card>
                    {sources.length === 0 ? (
                      <Empty>Nothing yet.</Empty>
                    ) : (
                      sources.map((s, i) => (
                        <div
                          key={s.source}
                          style={{
                            display: 'flex', justifyContent: 'space-between', gap: 10,
                            padding: '7px 0',
                            borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                          }}
                        >
                          <span style={{ fontSize: 13.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.source}
                          </span>
                          <span style={{ fontSize: 13.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
                            {num(s.visitors)}
                          </span>
                        </div>
                      ))
                    )}
                  </Card>
                </div>

                <div>
                  <SectionLabel>Which pages</SectionLabel>
                  <Card>
                    {pages.length === 0 ? (
                      <Empty>Nothing yet.</Empty>
                    ) : (
                      pages.map((p, i) => (
                        <div
                          key={p.path}
                          style={{
                            display: 'flex', justifyContent: 'space-between', gap: 10,
                            padding: '7px 0',
                            borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                          }}
                        >
                          <span style={{ fontSize: 13.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.path}
                          </span>
                          <span style={{ fontSize: 13.5, color: C.faint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {num(p.visitors)}
                            {p.clicks > 0 && <span style={{ color: C.dim }}> · {num(p.clicks)} clicks</span>}
                          </span>
                        </div>
                      ))
                    )}
                  </Card>
                </div>
              </div>

              <div style={{ marginTop: 22 }}>
                <Button variant="ghost" onClick={toggle}>Stop collecting</Button>
              </div>
            </>
          )}
        </>
      )}
    </Page>
  );
}
