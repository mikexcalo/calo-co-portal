'use client';

/**
 * Links belonging to a customer.
 *
 * The complaint this answers: "links that pertain to a client that I don't
 * want as open tabs in Chrome." A browser tab is a filing system that loses
 * everything on restart, and people use it anyway because opening a bookmark
 * manager and finding the right folder is slower than simply never closing
 * the tab.
 *
 * So the bar is low and deliberate: paste a URL, it saves. The title is
 * optional and filled in from the address if you skip it. Anything slower
 * than the tab loses to the tab.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, Empty, SectionLabel, inputStyle } from '@/components/spine/ui';
import { Confirm } from '@/components/spine/Confirm';

interface LinkRow {
  id: string;
  url: string;
  title: string | null;
  note: string | null;
  created_at: string;
}

/** A readable name from an address, for when nobody typed one. */
function nameFromUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const path = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop();
    const host = u.hostname.replace(/^www\./, '');
    if (!path) return host;
    return `${host} — ${decodeURIComponent(path).replace(/[-_]+/g, ' ').slice(0, 50)}`;
  } catch {
    return url.slice(0, 60);
  }
}

const normalise = (url: string) =>
  /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;

export function Links({
  orgId,
  customerId,
  jobId,
}: {
  orgId: string;
  customerId?: string;
  jobId?: string;
}) {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LinkRow | null>(null);

  const load = useCallback(async () => {
    let q = supabase
      .from('links')
      .select('id, url, title, note, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (customerId) q = q.eq('customer_id', customerId);
    if (jobId) q = q.eq('job_id', jobId);
    const res = await q;
    if (!res.error) setRows((res.data ?? []) as LinkRow[]);
  }, [orgId, customerId, jobId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const clean = normalise(url);
    try {
      new URL(clean);
    } catch {
      setError("That doesn't look like a web address.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await supabase.from('links').insert({
      org_id: orgId,
      customer_id: customerId ?? null,
      job_id: jobId ?? null,
      url: clean,
      title: title.trim() || nameFromUrl(clean),
    });
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setUrl('');
    setTitle('');
    setAdding(false);
    await load();
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    await supabase.from('links').delete().eq('id', confirmDelete.id);
    setBusy(false);
    setConfirmDelete(null);
    await load();
  };

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <SectionLabel>Links ({rows.length})</SectionLabel>
        <Button variant="ghost" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : 'Add a link'}
        </Button>
      </div>

      {adding && (
        <Card style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && url.trim()) add(); }}
              placeholder="Paste a web address"
              autoFocus
              style={{ ...inputStyle, flex: '2 1 260px' }}
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && url.trim()) add(); }}
              placeholder="What is it? (optional)"
              style={{ ...inputStyle, flex: '1 1 180px' }}
            />
            <Button onClick={add} disabled={busy || !url.trim()}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
          {error && (
            <div style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{error}</div>
          )}
        </Card>
      )}

      {rows.length === 0 ? (
        !adding && (
          <Card>
            <Empty>
              Plans, permits, inspiration, a shared folder — anything you&apos;d otherwise leave
              open in a tab.
            </Empty>
          </Card>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((l) => (
            <div
              key={l.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '10px 13px',
                background: C.panel,
              }}
            >
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}
              >
                <div
                  style={{
                    fontSize: 13.5,
                    color: C.text,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {l.title || nameFromUrl(l.url)}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: C.faint,
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {l.url}
                </div>
              </a>
              <Button variant="danger" onClick={() => setConfirmDelete(l)}>Remove</Button>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <Confirm
          title="Remove this link?"
          body={confirmDelete.title || confirmDelete.url}
          confirmLabel="Remove"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
