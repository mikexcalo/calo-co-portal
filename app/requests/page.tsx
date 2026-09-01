'use client';

/**
 * Site requests — the queue between "client wants a change" and "it's live".
 *
 * Approve-or-modify is the whole design: the brief that goes to build is the
 * one you edited, never the raw paragraph a client typed at midnight.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { modulesFor } from '@/lib/spine/modules';
import { getCurrentOrg } from '@/lib/spine/db';
import {
  Button,
  C,
  Card,
  Empty,
  Field,
  Page,
  Pill,
  SectionLabel,
  inputStyle,
  shortDate,
} from '@/components/spine/ui';

type Status = 'submitted' | 'needs_info' | 'approved' | 'building' | 'shipped' | 'declined';

interface SiteRequest {
  id: string;
  title: string;
  body: string;
  kind: string;
  urgency: 'whenever' | 'normal' | 'urgent';
  status: Status;
  approved_brief: string | null;
  note_to_client: string | null;
  requester_name: string | null;
  requester_email: string | null;
  issue_url: string | null;
  deploy_url: string | null;
  submitted_at: string;
  site: { id: string; name: string; url: string | null; repo: string | null } | null;
}

const STATUS_LABEL: Record<Status, string> = {
  submitted: 'Needs your call',
  needs_info: 'Waiting on client',
  approved: 'Approved',
  building: 'Being built',
  shipped: 'Live',
  declined: 'Declined',
};

const STATUS_TONE: Record<Status, 'neutral' | 'amber' | 'blue' | 'green' | 'red'> = {
  submitted: 'amber',
  needs_info: 'neutral',
  approved: 'blue',
  building: 'blue',
  shipped: 'green',
  declined: 'neutral',
};

export default function RequestsPage() {
  const { org } = useOrg();
  const mods = modulesFor(org);
  const [requests, setRequests] = useState<SiteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftBrief, setDraftBrief] = useState('');
  const [clientNote, setClientNote] = useState('');

  const load = useCallback(async () => {
    const res = await supabase
      .from('site_requests')
      .select('*, site:client_sites(id, name, url, repo)')
      .order('submitted_at', { ascending: false });
    if (res.error) throw new Error(res.error.message);
    setRequests((res.data ?? []) as SiteRequest[]);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await getCurrentOrg();
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const openRequest = (r: SiteRequest) => {
    const next = openId === r.id ? null : r.id;
    setOpenId(next);
    setDraftBrief(r.approved_brief ?? r.body);
    setClientNote(r.note_to_client ?? '');
    setNotice(null);
    setError(null);
  };

  const approve = async (r: SiteRequest) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/site-requests/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: r.id,
          brief: draftBrief,
          noteToClient: clientNote,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not approve');
      setNotice(payload.note);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (r: SiteRequest, status: Status) => {
    setBusy(true);
    setError(null);
    try {
      const res = await supabase
        .from('site_requests')
        .update({
          status,
          note_to_client: clientNote || null,
          decided_at: new Date().toISOString(),
          ...(status === 'shipped' ? { shipped_at: new Date().toISOString() } : {}),
        })
        .eq('id', r.id);
      if (res.error) throw new Error(res.error.message);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = requests.filter((r) => !['shipped', 'declined'].includes(r.status));
  const closed = requests.filter((r) => ['shipped', 'declined'].includes(r.status));

  return (
    <Page
      title="Site requests"
      subtitle="Changes your clients have asked for. What you approve is what gets built."
    >
      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}
      {notice && (
        <Card style={{ borderColor: `${C.green}55`, marginBottom: 16 }}>
          <div style={{ color: C.green, fontSize: 14 }}>{notice}</div>
        </Card>
      )}

      {loading ? (
        <Empty>Loading…</Empty>
      ) : requests.length === 0 ? (
        <Card>
          <Empty>
            No requests yet. Clients submit these from their own portal view.
          </Empty>
        </Card>
      ) : (
        <>
          <SectionLabel>Open ({open.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {open.length === 0 && (
              <Card><Empty>Nothing waiting on you.</Empty></Card>
            )}
            {open.map((r) => (
              <Card key={r.id} style={{ padding: 0 }}>
                <div
                  onClick={() => openRequest(r)}
                  style={{
                    padding: 16,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 500 }}>{r.title}</span>
                      <Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Pill>
                      {r.urgency === 'urgent' && <Pill tone="red">Urgent</Pill>}
                    </div>
                    <div style={{ fontSize: 12.5, color: C.faint, marginTop: 5 }}>
                      {r.site?.name ?? 'No site'} · {r.requester_name || r.requester_email || 'Client'} ·{' '}
                      {shortDate(r.submitted_at)}
                    </div>
                  </div>
                  <span style={{ color: C.faint, fontSize: 13 }}>
                    {openId === r.id ? 'Close' : 'Review'}
                  </span>
                </div>

                {openId === r.id && (
                  <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.border}` }}>
                    <div style={{ margin: '14px 0' }}>
                      <SectionLabel>What they asked for</SectionLabel>
                      <div
                        style={{
                          fontSize: 14,
                          color: C.dim,
                          background: C.panelAlt,
                          padding: 12,
                          borderRadius: 7,
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.55,
                        }}
                      >
                        {r.body}
                      </div>
                    </div>

                    <Field label="Brief to build from. Edit freely">
                      <textarea
                        value={draftBrief}
                        onChange={(e) => setDraftBrief(e.target.value)}
                        style={{ ...inputStyle, minHeight: 120, resize: 'vertical', lineHeight: 1.55 }}
                      />
                    </Field>
                    <div style={{ fontSize: 12.5, color: C.faint, margin: '-8px 0 14px' }}>
                      This is what gets built, not the text above. Tighten anything ambiguous now,
                      because ambiguity gets resolved by guessing on a live client site.
                    </div>

                    <Field label="Note back to the client (optional)">
                      <input
                        value={clientNote}
                        onChange={(e) => setClientNote(e.target.value)}
                        style={inputStyle}
                        placeholder="On it. Live by Thursday."
                      />
                    </Field>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button onClick={() => approve(r)} disabled={busy || !draftBrief.trim()}>
                        Approve &amp; send to build
                      </Button>
                      <Button variant="ghost" onClick={() => setStatus(r, 'needs_info')} disabled={busy}>
                        Ask a question
                      </Button>
                      {r.status === 'building' && (
                        <Button variant="ghost" onClick={() => setStatus(r, 'shipped')} disabled={busy}>
                          Mark live
                        </Button>
                      )}
                      <Button variant="danger" onClick={() => setStatus(r, 'declined')} disabled={busy}>
                        Decline
                      </Button>
                    </div>

                    {r.issue_url && (
                      <div style={{ marginTop: 12, fontSize: 13 }}>
                        <a
                          href={r.issue_url}
                          target="_blank"
                          rel="noopener"
                          style={{ color: C.blue }}
                        >
                          Filed as an issue →
                        </a>
                      </div>
                    )}

                    {!r.site?.repo && (
                      <div style={{ marginTop: 12, fontSize: 12.5, color: C.amber }}>
                        This site has no repo set, so approving won&apos;t file anything
                        automatically. Add one on the site record to enable handoff.
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {closed.length > 0 && (
            <>
              <SectionLabel>Closed ({closed.length})</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {closed.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      background: C.panel,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      fontSize: 13.5,
                      color: C.dim,
                    }}
                  >
                    <Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Pill>
                    <span style={{ flex: 1 }}>{r.title}</span>
                    <span style={{ color: C.faint, fontSize: 12 }}>{shortDate(r.submitted_at)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Page>
  );
}
