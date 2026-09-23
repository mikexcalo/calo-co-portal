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
  Tiles,
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
import { human } from '@/lib/spine/errors';

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
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => setNow(Date.now()), []);

  const load = useCallback(async () => {
    const data = await listAllEstimates();
    setRows(data.map((r) => ({ ...r, total: Number(r.total) || 0 })));
  }, []);

  /*
    Sending, from the screen that lists the unsent ones.

    If the email cannot go out the proposal is still marked sent and the link
    comes back, so nothing is lost and there is always a way to get the
    document in front of somebody by hand.
  */
  const sendIt = useCallback(async (r: Row_) => {
    setBusy(r.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/estimates/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimateId: r.id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not send it');
      setNotice(
        payload.message
          ?? `Sent to ${r.job?.customer?.name ?? 'the customer'}. They can accept it from the link.`
      );
      await load();
    } catch (e) {
      setError(human((e as Error).message));
    } finally {
      setBusy(null);
    }
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        setError(human((e as Error).message));
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
      subtitle={`Everything you have quoted.`}
    >
      {/*
        The document opens here, not in a tab.

        Every row called window.open, so reading three proposals left three
        CALO&CO tabs behind. It is the same link the client is sent, in an
        iframe, so nothing here can drift from what they actually see, and
        Open in a tab is still there for anybody who wants one.
      */}
      {previewing && (
        <div
          onClick={() => setPreviewing(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.panel, borderRadius: 12, overflow: 'hidden',
              width: 'min(900px, 100%)', height: 'min(92vh, 1040px)',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(0,0,0,.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: C.text, flex: 1 }}>
                What they will see
              </span>
              <a
                href={previewing}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12.5, color: C.dim, textDecoration: 'none' }}
              >
                Open in a tab
              </a>
              <Button variant="ghost" onClick={() => setPreviewing(null)}>Close</Button>
            </div>
            <iframe
              src={previewing}
              title="Proposal preview"
              style={{ flex: 1, border: 'none', width: '100%', background: '#f5f5f3' }}
            />
          </div>
        </div>
      )}

      {notice && (
        <Card style={{ borderColor: `${C.green}55`, marginBottom: 16 }}>
          <div style={{ color: C.green, fontSize: 14 }}>{notice}</div>
        </Card>
      )}

      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}

      {/* The same strip as Home, Clients and Invoices. It was four Metrics
          with hideAtZero, so the row emptied out exactly when you had nothing
          outstanding and most wanted to see that. */}
      <Tiles
        items={[
          {
            label: 'Out for decision', value: money0(outValue), icon: 'send',
            hint: out.length ? `${out.length} waiting` : 'Nothing out',
            tone: outValue > 0 ? C.blue : undefined,
          },
          /*
            A count, because the sum was not a number.

            This added up every unsent proposal's total and printed $40 — two
            clients' monthly hosting fees from two agreements that are mostly
            an hourly rate, added together. Nobody is ever invoiced $40 and no
            decision comes out of it. The money is on each row, where it
            belongs to one client and means what it says.
          */
          {
            label: 'Unsent drafts', value: String(drafts.length), icon: 'brief',
            hint: 'Written, never sent',
            tone: drafts.length ? C.amber : undefined,
          },
          {
            label: 'Won', value: String(won.length), icon: 'star',
            hint: winRate != null ? `${winRate}% of ${decided} decided` : 'None decided yet',
            tone: won.length ? C.green : undefined,
          },
        ]}
      />

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
                {/*
                  A row that says which document it is, and opens it.

                  Every row read "Platform and support", the name of the
                  project the proposal hangs off, with no number, no status
                  and no hint that the thing being listed was a document at
                  all. Two of them side by side were distinguishable only by
                  the client's name in the next column.

                  And pressing one went to the project. That is the right
                  destination for the work and the wrong one for a proposal:
                  you came here to look at what you are about to send, and
                  landed on hours, costs, reminders and invoices instead, with
                  the proposal itself a table near the bottom.

                  It opens the document now, in the state the client will see
                  it. New tab, because this is a thing you read and come back
                  from, not a place you navigate to.
                */}
                {/*
                  Room where the words are.

                  The columns were fixed at 130/1fr/170/110/100, so the client
                  name got a flexible column it did not need and the project
                  name got 170 fixed pixels it could not live in. "Platform
                  Access & Ongoing Development" wrapped to two lines beside a
                  half-empty column.

                  The reference is a fixed width because it is always the same
                  shape. The two names share the slack, with the project taking
                  more because project names are always longer than company
                  names. Money is as narrow as money ever needs.
                */}
                <Row cols="104px minmax(0, 1fr) minmax(0, 1.6fr) 96px 110px" header>
                  <div>Proposal</div>
                  <div>For</div>
                  <div>Project</div>
                  <div>Total</div>
                  <div />
                </Row>
                {drafts.map((r) => (
                  <Row
                    key={r.id}
                    cols="104px minmax(0, 1fr) minmax(0, 1.6fr) 96px 110px"
                    onClick={() =>
                      r.public_token
                        ? setPreviewing(`/e/${r.public_token}?preview=1`)
                        : r.job && router.push(`/jobs/${r.job.id}`)
                    }
                  >
                    <div style={{ fontWeight: 500 }}>Proposal #{r.version}</div>
                    <div>{r.job?.customer?.name ?? '–'}</div>
                    <div style={{ color: C.dim }}>{r.job?.name ?? '–'}</div>
                    <div>{money(r.total)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      {/*
                        The button that was missing.

                        A screen headed "Written but never sent", above a note
                        saying nobody can accept a proposal they never received,
                        with no way to send one. The only send button lived on
                        the project page, three clicks away, under Estimate.
                      */}
                      <Button
                        onClick={() => { void sendIt(r); }}
                        disabled={busy === r.id}
                      >
                        {busy === r.id ? 'Sending…' : 'Send it'}
                      </Button>
                    </div>
                  </Row>
                ))}
              </Table>
              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 8 }}>
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
                      onClick={() =>
                      r.public_token
                        ? setPreviewing(`/e/${r.public_token}?preview=1`)
                        : r.job && router.push(`/jobs/${r.job.id}`)
                      }
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
                        <div style={{ fontSize: 15, fontWeight: 500 }}>{r.job?.name ?? '–'}</div>
                        <div style={{ fontSize: 13, color: C.dim, marginTop: 3 }}>
                          {r.job?.customer?.name ?? '–'}
                          {age != null && ` · sent ${age === 0 ? 'today' : `${age}d ago`}`}
                        </div>
                      </div>
                      {/* Opened-and-quiet and never-opened are different
                          problems. One needs a nudge, the other needs a
                          working email address. */}
                      <Pill tone={opened ? 'blue' : 'neutral'}>
                        {opened ? 'Opened it' : 'Not opened'}
                      </Pill>
                      <div style={{ fontSize: 16, minWidth: 90, textAlign: 'right' }}>
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
            <Card><Empty>Nothing decided yet. Estimates you send appear here once answered.</Empty></Card>
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
                    onClick={() =>
                      r.public_token
                        ? setPreviewing(`/e/${r.public_token}?preview=1`)
                        : r.job && router.push(`/jobs/${r.job.id}`)
                    }
                  >
                    <div>{r.job?.name ?? '–'}</div>
                    <div style={{ color: C.dim }}>{r.job?.customer?.name ?? '–'}</div>
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
                    <div key={r.id} style={{ fontSize: 13.5, color: C.dim, padding: '5px 0' }}>
                      <strong style={{ color: C.text }}>{r.job?.name}</strong> , {' '}
                      {r.decline_reason}
                    </div>
                  ))}
              </Card>
              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 8 }}>
                The most useful thing on this page over time.
              </div>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
