'use client';

/**
 * Reviews, which for a trade is the marketing.
 *
 * Not a campaign and not a funnel. The number of stars beside the business
 * name when somebody searches, which decides whether the phone rings. A
 * contractor with forty reviews gets called and one with four does not, and
 * the difference between them is almost always that one of them asks.
 *
 * Asking takes five seconds and nobody does it, because it lands on the day
 * the job finishes, which is the day you are already onto the next one.
 *
 * Clicks are the only honest measure here. Google will not say who left a
 * review, so attributing one would be inventing a number.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { Button, C, Card, Empty, Metric, Page, Pill, DIGITAL_TABS, SectionLabel, shortDate } from '@/components/spine/ui';

interface Due {
  job_id: string;
  job_name: string;
  customer_name: string | null;
  customer_email: string;
  completed_on: string;
}

interface Sent {
  id: string;
  sent_to: string | null;
  sent_at: string | null;
  clicked_at: string | null;
  job: { name: string } | null;
}

export default function ReviewsPage() {
  const { vocab } = useOrg();
  const router = useRouter();
  const [due, setDue] = useState<Due[]>([]);
  const [sent, setSent] = useState<Sent[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [d, s, o] = await Promise.all([
      supabase.from('review_due').select('*'),
      supabase
        .from('review_requests')
        .select('id, sent_to, sent_at, clicked_at, job:jobs(name)')
        .order('sent_at', { ascending: false })
        .limit(50),
      supabase.rpc('current_org_id'),
    ]);
    if (d.data) setDue(d.data as Due[]);
    if (s.data) setSent(s.data as unknown as Sent[]);
    if (o.data) {
      const org = await supabase.from('orgs').select('review_link').eq('id', o.data).maybeSingle();
      setLink(org.data?.review_link ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const send = async (jobId?: string) => {
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/reviews/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobId ? { jobId } : {}),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(data.message ?? data.error ?? 'Done.');
    load();
  };

  if (loading) return <Page title="Reviews"><Card><Empty>Loading…</Empty></Card></Page>;

  const clicked = sent.filter((s) => s.clicked_at).length;

  if (!link) {
    return (
      <Page tabs={DIGITAL_TABS} title="Reviews" subtitle={`Ask every finished ${vocab.job.toLowerCase()} for a Google review.`}>
        <Card>
          <div style={{ fontSize: 15, color: C.text, marginBottom: 8 }}>
            No review link set yet
          </div>
          <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.7, maxWidth: 600, marginBottom: 14 }}>
            Open your Google Business Profile, choose Ask for reviews, and copy the link it gives
            you. Paste it into Business and every finished job gets one request from then on.
            Nothing is sent until it is there.
          </p>
          <Button onClick={() => router.push('/business')}>Open Business</Button>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      tabs={DIGITAL_TABS}
      title="Reviews"
      subtitle={`One ask per finished ${vocab.job.toLowerCase()}, and never to somebody who still owes you money.`}
      action={
        due.length > 0 ? (
          <Button onClick={() => send()} disabled={busy}>
            {busy ? 'Sending…' : `Ask all ${due.length}`}
          </Button>
        ) : undefined
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Metric label="Waiting to be asked" value={String(due.length)} tone={due.length ? 'amber' : undefined} />
        <Metric label="Asked" value={String(sent.length)} />
        <Metric
          label="Followed the link"
          value={String(clicked)}
          hint={sent.length ? `${Math.round((clicked / sent.length) * 100)}% of asks` : undefined}
        />
      </div>

      {message && (
        <div style={{ fontSize: 13.5, color: C.dim, marginBottom: 16 }}>{message}</div>
      )}

      <SectionLabel>Ready to ask ({due.length})</SectionLabel>
      {due.length === 0 ? (
        <Card>
          <Empty>
            Nobody right now. Finished jobs appear here once they are paid up.
          </Empty>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 26 }}>
          {due.map((d) => (
            <Card key={d.job_id}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14.5, color: C.text }}>{d.customer_name ?? d.customer_email}</div>
                  <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>
                    {d.job_name} · finished {shortDate(d.completed_on)}
                  </div>
                </div>
                <Button variant="ghost" onClick={() => send(d.job_id)} disabled={busy}>Ask</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {sent.length > 0 && (
        <>
          <SectionLabel>Asked ({sent.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sent.map((s) => (
              <Card key={s.id}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, color: C.text, flex: 1, minWidth: 160 }}>
                    {s.job?.name ?? 'A job'}
                  </span>
                  <span style={{ fontSize: 12.5, color: C.faint }}>{s.sent_to}</span>
                  {s.clicked_at ? <Pill tone="green">followed</Pill> : <Pill>no click yet</Pill>}
                  <span style={{ fontSize: 12.5, color: C.faint }}>{shortDate(s.sent_at)}</span>
                </div>
              </Card>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: C.faint, marginTop: 12, lineHeight: 1.6, maxWidth: 620 }}>
            Followed means they clicked through to Google. Whether they then left a review is not
            something Google tells anybody, so it is not claimed here.
          </p>
        </>
      )}
    </Page>
  );
}
