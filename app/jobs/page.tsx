'use client';

/**
 * Jobs — the pipeline.
 *
 * A lead is a job at status 'lead'. There is no separate leads module: the
 * same record moves left to right, which is what makes this process-oriented
 * rather than a pile of screens.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/spine/org';
import { FirstSteps } from '@/components/spine/FirstSteps';
import { ClientScope, useClientScope } from '@/components/spine/ClientScope';
import { listJobs, listJobLedger } from '@/lib/spine/db';
import { JOB_PIPELINE, JOB_STATUS_LABEL } from '@/lib/spine/types';
import type { JobLedger, JobStatus, JobWithCustomer } from '@/lib/spine/types';
import {
  Button,
  C,
  Card,
  Empty,
  Figures,
  Page,
  Pill,
  hours,
  money0,
} from '@/components/spine/ui';
import { human } from '@/lib/spine/errors';

const TONE: Record<JobStatus, 'neutral' | 'blue' | 'green' | 'amber' | 'red'> = {
  lead: 'neutral',
  estimating: 'amber',
  won: 'blue',
  active: 'blue',
  complete: 'green',
  closed: 'neutral',
  lost: 'red',
};

export default function JobsPage() {
  const router = useRouter();
  const clientScope = useClientScope();
  const { vocab } = useOrg();
  const [jobs, setAllJobs] = useState<JobWithCustomer[]>([]);
  const [ledger, setLedger] = useState<Record<string, JobLedger>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        // Two queries total, regardless of how many jobs exist.
        const [j, l] = await Promise.all([listJobs(), listJobLedger()]);
        if (canceled) return;
        setAllJobs(j);
        setLedger(Object.fromEntries(l.map((row) => [row.job_id, row])));
      } catch (e) {
        if (!canceled) setError(human((e as Error).message));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  /**
   * Filtered here rather than in the query.
   *
   * Every row is already loaded and the whole page is two requests; refetching
   * to narrow a list of this size would be slower than filtering it. The
   * banner below says the narrowing happened, which is the part that must not
   * be silent.
   */
  const shown = clientScope ? jobs.filter((j) => j.customer_id === clientScope) : jobs;
  const scopedName = shown[0]?.customer?.name ?? null;

  const active = shown.filter((j) => ['won', 'active'].includes(j.status));

  /**
   * Only the stages that hold something, plus the next one along.
   *
   * Five columns with four reading Empty is a board that spends most of its
   * width telling you about work you do not have. The stage after the last
   * occupied one stays, because that is where the next card goes and a board
   * with nowhere to move to is not a pipeline.
   */
  const occupied = JOB_PIPELINE.filter((st) => shown.some((j) => j.status === st));
  const lastIdx = occupied.length
    ? Math.max(...occupied.map((st) => JOB_PIPELINE.indexOf(st)))
    : -1;
  const columns = JOB_PIPELINE.filter(
    (st, i) => occupied.includes(st) || i === lastIdx + 1
  );
  const unbilled = Object.values(ledger).reduce(
    (s, r) => s + r.unbilled_labor + r.unbilled_cost,
    0
  );
  const outstanding = Object.values(ledger).reduce(
    (s, r) => s + (r.invoiced_total - r.collected),
    0
  );

  return (
    <Page
      title={vocab.jobPlural}
      /*
        What this screen is, as against Home.

        It said "every engagement from first call to final payment", which
        describes the data and not the job. Mike read it beside Home and could
        not say which he was meant to be standing on — reasonably, because both
        opened with a row of tiles and a list of the same work.

        They answer different questions. Home is today: what is wrong, what is
        owed, what is waiting, ranked by what it costs to keep ignoring. This
        is everything at once, in the order it moves — the board you come to in
        order to move something along, not to find out what is on fire.
      */
      subtitle={`Every ${vocab.job.toLowerCase()} you have on, in the order it moves. Home is what needs you today; this is the whole board.`}
      action={
        <Button onClick={() => router.push('/jobs/new')}>New {vocab.job.toLowerCase()}</Button>
      }
    >
      <ClientScope name={scopedName} count={shown.length} />

      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 20 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}

      {/* Context above a board, so a line rather than a row of cards. */}
      <Figures
        items={[
          { label: `Active ${vocab.jobPlural.toLowerCase()}`, value: String(active.length), hideAtZero: true },
          { label: 'Unbilled work', value: money0(unbilled), tone: 'amber', hideAtZero: true },
          { label: 'Awaiting payment', value: money0(outstanding), tone: 'red', hideAtZero: true },
        ]}
      />

      {loading ? (
        <Empty>Loading…</Empty>
      ) : jobs.length === 0 ? (
        <FirstSteps
          copy={{
            title: `No ${vocab.jobPlural.toLowerCase()} yet`,
            blurb: `A ${vocab.job.toLowerCase()} is the unit everything else hangs off, hours, receipts, and the invoice at the end all point back at one. A lead is simply one that has not been won yet.`,
            steps: [
              `Create one and give it a name you would recognise on a phone call. The address and the ${vocab.customer.toLowerCase()} can wait.`,
              'Move it along the board as it goes, lead, quoted, won, done. Nothing else has to be kept in step.',
              'Log hours and file receipts against it, and the invoice builds itself out of what actually happened.',
            ],
            action: { label: `New ${vocab.job.toLowerCase()}`, href: '/jobs/new' },
          }}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns.length}, minmax(190px, 1fr))`,
            gap: 12,
            overflowX: 'auto',
          }}
        >
          {columns.map((status) => {
            const column = shown.filter((j) => j.status === status);
            return (
              <div key={status}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                    padding: '0 2px',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      color: C.faint,
                      fontWeight: 600,
                    }}
                  >
                    {JOB_STATUS_LABEL[status]}
                  </span>
                  <span style={{ fontSize: 12, color: C.faint }}>{column.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {column.map((job) => {
                    const l = ledger[job.id];
                    const pending = l ? l.unbilled_labor + l.unbilled_cost : 0;
                    return (
                      <div
                        key={job.id}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                        style={{
                          background: C.panel,
                          border: `1px solid ${C.border}`,
                          borderRadius: 9,
                          padding: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {/*
                          A card that says what is happening on it.

                          It carried a name and a client, on the reasoning that
                          a board card is for recognising a thing and clicking
                          it. That holds for a lead. It does not hold for three
                          live projects called almost the same thing for two
                          different clients, where the only way to find out
                          which one needed anything was to open all three.

                          One line of state, and only where there is state to
                          report: money sitting unbilled, hours logged and
                          never invoiced, or nothing, in which case the card
                          stays as quiet as it was.
                        */}
                        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35 }}>
                          {job.name}
                        </div>
                        {job.customer?.name && (
                          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 4 }}>
                            {job.customer.name}
                          </div>
                        )}
                        {(() => {
                          const owed = l ? l.invoiced_total - l.collected : 0;
                          const hrs = l?.hours_logged ?? 0;
                          const bits: Array<{ text: string; tone: string }> = [];
                          if (owed > 0) bits.push({ text: `${money0(owed)} owed`, tone: C.red });
                          if (pending > 0) bits.push({ text: `${money0(pending)} unbilled`, tone: C.amber });
                          if (!bits.length && hrs > 0) bits.push({ text: `${hours(hrs)} logged`, tone: C.faint });
                          if (!bits.length) return null;
                          return (
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 7 }}>
                              {bits.map((b) => (
                                <span key={b.text} style={{ fontSize: 12.5, color: b.tone }}>
                                  {b.text}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                  {column.length === 0 && (
                    <div
                      style={{
                        border: `1px dashed ${C.border}`,
                        borderRadius: 9,
                        padding: 14,
                        fontSize: 12.5,
                        color: C.faint,
                        textAlign: 'center',
                      }}
                    >
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && jobs.some((j) => ['closed', 'lost'].includes(j.status)) && (
        <div style={{ marginTop: 28 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: C.faint,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Archive
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {jobs
              .filter((j) => ['closed', 'lost'].includes(j.status))
              .map((job) => (
                <div
                  key={job.id}
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  style={{
                    background: C.panelAlt,
                    border: `1px solid ${C.border}`,
                    borderRadius: 7,
                    padding: '7px 12px',
                    fontSize: 13,
                    color: C.dim,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {job.name}
                  <Pill tone={TONE[job.status]}>{JOB_STATUS_LABEL[job.status]}</Pill>
                </div>
              ))}
          </div>
        </div>
      )}
    </Page>
  );
}
