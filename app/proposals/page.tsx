'use client';

/**
 * Proposals — everything quoted, across every job.
 *
 * Estimates already lived on the job. What was missing was the view that
 * answers the question a business actually asks out loud: "what have I
 * quoted that hasn't come back yet, and how much is it worth?"
 *
 * The board is ordered by what needs doing — drafts nobody sent, quotes that
 * were opened and went quiet, quotes never opened at all. Those three are
 * different problems and only one of them is the customer's fault.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listAllEstimates } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import type { Estimate } from '@/lib/spine/types';
import {
  Button,
  C,
  Card,
  Empty,
  Metric,
  Page,
  Pill,
  Row,
  SectionLabel,
  Table,
  money,
  money0,
  radius,
  shortDate,
} from '@/components/spine/ui';

type Row_ = Estimate & {
  job: { id: string; name: string; customer: { name: string } | null } | null;
};

const STATUS_TONE = {
  draft: 'neutral',
  sent: 'blue',
  accepted: 'green',
  declined: 'red',
  superseded: 'neutral',
} as const;

export default function ProposalsPage() {
  const router = useRouter();
  const { vocab } = useOrg();
  const [rows, setRows] = useState<Row_[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => setNow(Date.now()), []);

  const load = useCallback(async () => {
    const data = await listAllEstimates();
    setRows(data.map((r) => ({ ...r, total: Number(r.total) || 0 })));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const live = rows.filter((r) => r.status !== 'superseded');

  const drafts = live.filter((r) => r.status === 'draft');
  const out = live.filter((r) => r.status === 'sent');
  const won = live.filter((r) => r.status === 'accepted');
  const lost = live.filter((r) => r.status === 'declined');

  // Of everything decided, what share came back yes. Only meaningful once a
  // few have been decided, so it stays hidden until then.
  const decided = won.length + lost.length;
  const winRate = decided >= 3 ? Math.round((won.length / decided) * 100) : null;

  const outValue = out.reduce((s, r) => s + r.total, 0);
  const draftValue = drafts.reduce((s, r) => s + r.total, 0);

  const daysSince = (iso: string | null) =>
    iso && now ? Math.floor((now - new Date(iso).getTime()) / 86_400_000) : null;

  /** Sent quotes, oldest first — the ones going cold need chasing first. */
  const chase = useMemo(
    () => [...out].sort((a, b) => (a.sent_at ?? '').localeCompare(b.sent_at ?? '')),
    [out]
  );

  return (
    <Page
      title={`${vocab.estimate}s`}
      subtitle={`Everything quoted across every ${vocab.job.toLowerCase()}. Once accepted, they can be invoiced.`}
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
          gap: 12,
          marginBottom: 26,
        }}
      >
        <Metric
          label="Out for decision"
          value={money0(outValue)}
          tone={outValue > 0 ? 'blue' : undefined}
          hint={`${out.length} waiting`}
        />
        <Metric
          label="Unsent drafts"
          value={money0(draftValue)}
          tone={drafts.length ? 'amber' : undefined}
          hint={`${drafts.length} never sent`}
        />
        <Metric label="Won" value={String(won.length)} tone="green" />
        {winRate != null && (
          <Metric label="Win rate" value={`${winRate}%`} hint={`${decided} decided`} />
        )}
      </div>

      {loading ? (
        <Empty>Loading…</Empty>
      ) : live.length === 0 ? (
        <Card>
          <Empty>
            Nothing quoted yet. Build an estimate on a {vocab.job.toLowerCase()} and it shows
            up here.
          </Empty>
        </Card>
      ) : (
        <>
          {drafts.length > 0 && (
            <div style={{ marginBottom: 26 }}>
              <SectionLabel>Written but never sent ({drafts.length})</SectionLabel>
              <Table>
                {drafts.map((r) => (
                  <Row
                    key={r.id}
                    cols="1fr 160px 120px"
                    onClick={() => r.job && router.push(`/jobs/${r.job.id}`)}
                  >
                    <div>{r.job?.name ?? '—'}</div>
                    <div style={{ color: C.dim }}>{r.job?.customer?.name ?? '—'}</div>
                    <div>{money(r.total)}</div>
                  </Row>
                ))}
              </Table>
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 8 }}>
                Nobody can accept a proposal they never received.
              </div>
            </div>
          )}

          {chase.length > 0 && (
            <div style={{ marginBottom: 26 }}>
              <SectionLabel>Waiting on the customer ({chase.length})</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {chase.map((r) => {
                  const age = daysSince(r.sent_at);
                  const opened = !!r.viewed_at;
                  const stale = age != null && age >= 7;
                  return (
                    <div
                      key={r.id}
                      onClick={() => r.job && router.push(`/jobs/${r.job.id}`)}
                      style={{
                        background: C.panel,
                        border: `1px solid ${stale ? C.amber : C.border}`,
                        borderRadius: radius.md,
                        padding: '13px 15px',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{r.job?.name ?? '—'}</div>
                        <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>
                          {r.job?.customer?.name ?? '—'}
                          {age != null && ` · sent ${age === 0 ? 'today' : `${age}d ago`}`}
                        </div>
                      </div>
                      {/* Opened-and-quiet and never-opened are different
                          problems. One needs a nudge, the other needs a
                          working email address. */}
                      <Pill tone={opened ? 'blue' : 'neutral'}>
                        {opened ? 'Opened it' : 'Not opened'}
                      </Pill>
                      <div style={{ fontSize: 15, minWidth: 90, textAlign: 'right' }}>
                        {money(r.total)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <SectionLabel>Decided ({won.length + lost.length})</SectionLabel>
          {won.length + lost.length === 0 ? (
            <Card><Empty>Nothing decided yet.</Empty></Card>
          ) : (
            <Table>
              <Row cols="1fr 150px 110px 110px 110px" header>
                <div>{vocab.job}</div>
                <div>{vocab.customer}</div>
                <div>Status</div>
                <div>Decided</div>
                <div>Value</div>
              </Row>
              {[...won, ...lost]
                .sort((a, b) => (b.decided_at ?? '').localeCompare(a.decided_at ?? ''))
                .map((r) => (
                  <Row
                    key={r.id} cols="1fr 150px 110px 110px 110px" labels={['', '', 'Status', 'Decided', 'Value']}
                    onClick={() => r.job && router.push(`/jobs/${r.job.id}`)}
                  >
                    <div>{r.job?.name ?? '—'}</div>
                    <div style={{ color: C.dim }}>{r.job?.customer?.name ?? '—'}</div>
                    <div><Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill></div>
                    <div style={{ color: C.dim }}>{shortDate(r.decided_at)}</div>
                    <div>{money(r.total)}</div>
                  </Row>
                ))}
            </Table>
          )}

          {lost.some((r) => r.decline_reason) && (
            <div style={{ marginTop: 24 }}>
              <SectionLabel>Why people said no</SectionLabel>
              <Card>
                {lost
                  .filter((r) => r.decline_reason)
                  .map((r) => (
                    <div key={r.id} style={{ fontSize: 12.5, color: C.dim, padding: '5px 0' }}>
                      <strong style={{ color: C.text }}>{r.job?.name}</strong> —{' '}
                      {r.decline_reason}
                    </div>
                  ))}
              </Card>
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 8 }}>
                The most useful thing on this page over time.
              </div>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
