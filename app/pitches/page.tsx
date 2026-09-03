'use client';

/**
 * Pitches — send a link, not an attachment.
 *
 * The list view. Its real job is the read count: a deck that was never opened
 * and a deck that was read four times look identical from the sender's side,
 * and the follow-up gets written blind either way. Here they look different.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { modulesFor } from '@/lib/spine/modules';
import {
  Button,
  C,
  Card,
  Empty,
  Metric,
  Page,
  Pill,
  SectionLabel,
  shortDate,
} from '@/components/spine/ui';

interface Pitch {
  id: string;
  title: string;
  recipient: string | null;
  public_token: string | null;
  published_at: string | null;
  views: number;
  last_viewed_at: string | null;
  updated_at: string;
}

export default function PitchesPage() {
  const router = useRouter();
  const { org } = useOrg();
  const mods = modulesFor(org);
  const [rows, setRows] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    if (!org) return;
    const res = await supabase
      .from('pitches')
      .select('id, title, recipient, public_token, published_at, views, last_viewed_at, updated_at')
      .eq('org_id', org.id)
      .eq('archived', false)
      .order('updated_at', { ascending: false });
    if (res.error) setError(res.error.message);
    else setRows((res.data ?? []) as Pitch[]);
    setLoading(false);
  }, [org]);

  useEffect(() => { load(); }, [load]);

  /**
   * A new pitch starts with the shape of one rather than a blank page. A
   * blank page is where a deck stops being written; five headings you can
   * delete is a far lower bar than five you have to think of.
   */
  const create = async () => {
    if (!org) return;
    setBusy(true);
    const res = await supabase
      .from('pitches')
      .insert({
        org_id: org.id,
        title: 'Untitled pitch',
        sections: [
          { heading: 'The situation', body: 'What they told you, in their words. Starting here proves you listened.' },
          { heading: 'What we would do', body: 'The work itself, in plain terms.' },
          { heading: 'How it works', body: 'Timeline, what you need from them, how it runs.' },
          { heading: 'What it costs', body: 'The number, and what is included.' },
          { heading: 'Next step', body: 'One clear action. Not "let me know your thoughts".' },
        ],
      })
      .select()
      .single();
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    router.push(`/pitches/${res.data.id}`);
  };

  const copy = async (p: Pitch) => {
    if (!p.public_token) return;
    await navigator.clipboard.writeText(`${origin}/p/${p.public_token}`).catch(() => {});
    setCopied(p.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const live = rows.filter((r) => r.published_at);
  const totalViews = rows.reduce((s, r) => s + r.views, 0);
  const unopened = live.filter((r) => r.views === 0).length;

  return (
    <Page
      title="Pitches"
      subtitle="Send a link instead of a slide deck. You'll know when it gets read."
      action={<Button onClick={create} disabled={busy}>{busy ? 'Creating…' : 'New pitch'}</Button>}
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}

      {loading ? (
        <Card><Empty>Loading…</Empty></Card>
      ) : rows.length === 0 ? (
        <Card style={{ maxWidth: 620 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: C.text, marginBottom: 8 }}>
            Stop attaching decks
          </div>
          <p style={{ fontSize: 14.5, color: C.dim, lineHeight: 1.7, margin: '0 0 8px' }}>
            A PowerPoint lands in spam, opens with the fonts substituted, and freezes the moment
            you send it. The version being forwarded round their office is whatever was true that
            day.
          </p>
          <p style={{ fontSize: 14.5, color: C.dim, lineHeight: 1.7, margin: '0 0 18px' }}>
            A link renders the same everywhere, stays correctable after you send it, and tells you
            when it was read.
          </p>
          <Button onClick={create} disabled={busy}>Write your first pitch</Button>
        </Card>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 12,
              marginBottom: 26,
            }}
          >
            <Metric label="Live" value={String(live.length)} hint="Published and shareable" />
            <Metric label="Reads" value={String(totalViews)} hint="Across every pitch" />
            <Metric
              label="Not opened"
              value={String(unopened)}
              tone={unopened > 0 ? 'amber' : undefined}
              hint="Sent, never read"
            />
          </div>

          <SectionLabel>All pitches</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((p) => (
              <Card key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                  <div
                    onClick={() => router.push(`/pitches/${p.id}`)}
                    style={{ cursor: 'pointer', minWidth: 0, flex: 1 }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{p.title}</div>
                    <div style={{ fontSize: 13, color: C.faint, marginTop: 3 }}>
                      {p.recipient ? `For ${p.recipient} · ` : ''}
                      {p.published_at
                        ? p.views > 0
                          ? `Read ${p.views} ${p.views === 1 ? 'time' : 'times'}, last ${shortDate(p.last_viewed_at)}`
                          : 'Sent, not opened yet'
                        : `Draft, edited ${shortDate(p.updated_at)}`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {!p.published_at ? (
                      <Pill tone="neutral">Draft</Pill>
                    ) : p.views === 0 ? (
                      <Pill tone="amber">Not opened</Pill>
                    ) : (
                      <Pill tone="green">Read {p.views}×</Pill>
                    )}
                    {p.public_token && (
                      <Button variant="ghost" onClick={() => copy(p)}>
                        {copied === p.id ? 'Copied' : 'Copy link'}
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => router.push(`/pitches/${p.id}`)}>
                      Open
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
