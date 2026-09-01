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
import { listJobs, listJobLedger } from '@/lib/spine/db';
import { JOB_PIPELINE, JOB_STATUS_LABEL } from '@/lib/spine/types';
import type { JobLedger, JobStatus, JobWithCustomer } from '@/lib/spine/types';
import {
  Button,
  C,
  Card,
  Empty,
  Metric,
  Page,
  Pill,
  money0,
} from '@/components/spine/ui';

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
  const [jobs, setJobs] = useState<JobWithCustomer[]>([]);
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
        setJobs(j);
        setLedger(Object.fromEntries(l.map((row) => [row.job_id, row])));
      } catch (e) {
        if (!canceled) setError((e as Error).message);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  const active = jobs.filter((j) => ['won', 'active'].includes(j.status));
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
      title="Jobs"
      subtitle="Every job from first call to final payment."
      action={<Button onClick={() => router.push('/jobs/new')}>New job</Button>}
    >
      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 20 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 26,
        }}
      >
        <Metric label="Active jobs" value={String(active.length)} />
        <Metric
          label="Unbilled work"
          value={money0(unbilled)}
          tone={unbilled > 0 ? 'amber' : undefined}
          hint="Hours and receipts not yet invoiced"
        />
        <Metric
          label="Awaiting payment"
          value={money0(outstanding)}
          tone={outstanding > 0 ? 'blue' : undefined}
          hint="Invoiced but not collected"
        />
      </div>

      {loading ? (
        <Empty>Loading…</Empty>
      ) : jobs.length === 0 ? (
        <Card>
          <Empty hero>
            No jobs yet. Create one, or let a lead come in from the site form.
          </Empty>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${JOB_PIPELINE.length}, minmax(190px, 1fr))`,
            gap: 12,
            overflowX: 'auto',
          }}
        >
          {JOB_PIPELINE.map((status) => {
            const column = jobs.filter((j) => j.status === status);
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
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      color: C.faint,
                      fontWeight: 600,
                    }}
                  >
                    {JOB_STATUS_LABEL[status]}
                  </span>
                  <span style={{ fontSize: 11, color: C.faint }}>{column.length}</span>
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
                        {/* Name and customer only. A pipeline card is for
                            recognising a job at a glance and clicking it —
                            the money lives one click deeper, on the job. */}
                        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35 }}>
                          {job.name}
                        </div>
                        {job.customer?.name && (
                          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>
                            {job.customer.name}
                          </div>
                        )}
                        {pending > 0 && (
                          <div style={{ fontSize: 11.5, color: C.amber, marginTop: 7 }}>
                            {money0(pending)} unbilled
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {column.length === 0 && (
                    <div
                      style={{
                        border: `1px dashed ${C.border}`,
                        borderRadius: 9,
                        padding: 14,
                        fontSize: 11.5,
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
              fontSize: 10,
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
                    fontSize: 12,
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
