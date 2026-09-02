'use client';

/**
 * Companies you are going after.
 *
 * Kept apart from clients on purpose. A prospect is somebody in a
 * conversation; a target is a row on a list you are working through, and there
 * are two hundred of them. Mixing the two makes the list you open every day
 * useless, which is the whole reason the client screen is worth opening.
 *
 * Built to be worked down rather than admired. Filter to a segment, change a
 * status, write the next step, close the tab.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabase';
import { Button, C, Card, Empty, Metric, Page, Pill, inputStyle } from '@/components/spine/ui';

interface Target {
  id: string;
  name: string;
  segment: string | null;
  region: string | null;
  size: number | null;
  note: string | null;
  website: string | null;
  contact_name: string | null;
  status: 'researching' | 'approached' | 'talking' | 'won' | 'passed';
  next_step: string | null;
  last_touch: string | null;
  /** Whose campaign this is. Null means it is your own list. */
  client: { name: string } | null;
}

const STATUS: Array<{ id: Target['status']; label: string; tone: 'neutral' | 'blue' | 'amber' | 'green' | 'red' }> = [
  { id: 'researching', label: 'On the list', tone: 'neutral' },
  { id: 'approached', label: 'Approached', tone: 'blue' },
  { id: 'talking', label: 'Talking', tone: 'amber' },
  { id: 'won', label: 'Won', tone: 'green' },
  { id: 'passed', label: 'Passed', tone: 'red' },
];

const toneFor = (s: Target['status']) => STATUS.find((x) => x.id === s)?.tone ?? 'neutral';
const labelFor = (s: Target['status']) => STATUS.find((x) => x.id === s)?.label ?? s;

export default function TargetsPage() {
  /**
   * Whose list this is.
   *
   * Reached from a client record, because a hundred and four seafood
   * distributors are that client's list and not yours. Without a client this
   * shows everything, which is the view you want once for a sanity check and
   * never again.
   */
  const clientId = useSearchParams().get('client');
  const [clientName, setClientName] = useState<string | null>(null);
  const [rows, setRows] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<string>('all');
  const [status, setStatus] = useState<string>('open');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase
      .from('targets')
      .select('*, client:customers!targets_for_client_id_fkey(name)')
      .order('segment')
      .order('name');
    if (clientId) q = q.eq('for_client_id', clientId);

    const res = await q;
    if (!res.error) setRows((res.data ?? []) as Target[]);

    if (clientId) {
      const c = await supabase.from('customers').select('name').eq('id', clientId).maybeSingle();
      setClientName(c.data?.name ?? null);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const patch = async (t: Target, changes: Partial<Target>) => {
    setRows((r) => r.map((x) => (x.id === t.id ? { ...x, ...changes } : x)));
    await supabase.from('targets').update(changes).eq('id', t.id);
  };

  const segments = useMemo(
    () => Array.from(new Set(rows.map((r) => r.segment).filter(Boolean))) as string[],
    [rows]
  );

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (segment !== 'all' && r.segment !== segment) return false;
      // "Open" is the default because a list you are working through should
      // not show you the ones you already closed.
      if (status === 'open' && (r.status === 'won' || r.status === 'passed')) return false;
      if (status !== 'open' && status !== 'all' && r.status !== status) return false;
      if (needle && !`${r.name} ${r.region ?? ''} ${r.note ?? ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, segment, status, search]);

  if (loading) return <Page title="Targets"><Card><Empty>Loading…</Empty></Card></Page>;

  const counts = Object.fromEntries(
    STATUS.map((s) => [s.id, rows.filter((r) => r.status === s.id).length])
  );

  return (
    <Page
      back={clientId ? { label: clientName ?? 'Client', href: `/customers/${clientId}` } : undefined}
      title={clientName ? `Targets for ${clientName}` : 'Targets'}
      subtitle="Companies worth approaching. They become clients only once somebody answers."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 22 }}>
        <Metric label="On the list" value={String(counts.researching ?? 0)} />
        <Metric label="Approached" value={String(counts.approached ?? 0)} />
        <Metric label="Talking" value={String(counts.talking ?? 0)} tone={counts.talking ? 'amber' : undefined} />
        <Metric label="Won" value={String(counts.won ?? 0)} tone={counts.won ? 'green' : undefined} />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            style={{ ...inputStyle, flex: '1 1 200px' }}
          />
          <select value={segment} onChange={(e) => setSegment(e.target.value)} style={{ ...inputStyle, width: 240 }}>
            <option value="all">Every segment</option>
            {segments.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, width: 150 }}>
            <option value="open">Still open</option>
            <option value="all">Everything</option>
            {STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </Card>

      <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 8 }}>
        {shown.length} of {rows.length}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {shown.map((t) => {
          const isOpen = open === t.id;
          return (
            <Card key={t.id}>
              <div
                onClick={() => setOpen(isOpen ? null : t.id)}
                style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }}
              >
                <div style={{ flex: 1, minWidth: 190 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 500, color: C.text }}>{t.name}</div>
                  <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>
                    {[clientId ? null : t.client?.name, t.region, t.size ? `${t.size} units` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                {t.next_step && (
                  <span style={{ fontSize: 12.5, color: C.blue, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.next_step}
                  </span>
                )}
                <Pill tone={toneFor(t.status)}>{labelFor(t.status)}</Pill>
              </div>

              {isOpen && (
                <div style={{ marginTop: 14 }}>
                  {t.note && (
                    <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.65, margin: '0 0 14px', maxWidth: 660 }}>
                      {t.note}
                    </p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    <select
                      value={t.status}
                      onChange={(e) => patch(t, {
                        status: e.target.value as Target['status'],
                        // Changing the state is contact, so the date follows
                        // rather than asking somebody to keep two records.
                        last_touch: new Date().toISOString().slice(0, 10),
                      })}
                      style={inputStyle}
                    >
                      {/* Won is set from the client record, because it needs a
                          customer behind it and the database enforces that. */}
                      {STATUS.filter((s) => s.id !== 'won').map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                    <input
                      defaultValue={t.contact_name ?? ''}
                      onBlur={(e) => patch(t, { contact_name: e.target.value || null })}
                      placeholder="Who you know there"
                      style={inputStyle}
                    />
                    <input
                      defaultValue={t.next_step ?? ''}
                      onBlur={(e) => patch(t, { next_step: e.target.value || null })}
                      placeholder="Next step"
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {shown.length === 0 && <Card><Empty>Nothing matches that.</Empty></Card>}
      </div>
    </Page>
  );
}
