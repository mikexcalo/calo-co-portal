'use client';

/**
 * CRM.
 *
 * The first version was a name, an email and three numbers — a contact list.
 * A CRM's actual job is answering "who do I need to deal with today", so this
 * leads with that: anything overdue for a follow-up, anything owing money,
 * anything gone quiet.
 *
 * Faces matter more than they sound. People recall a photo instantly and a
 * row of text not at all, which is why the avatar is the biggest element.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { createCustomer, getCurrentOrg } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import {
  Avatar,
  Button,
  C,
  Card,
  Empty,
  Field,
  Page,
  Pill,
  SectionLabel,
  inputStyle,
  money,
  money0,
  radius,
  shortDate,
} from '@/components/spine/ui';

interface Summary {
  customer_id: string;
  name: string;
  contact_name: string | null;
  contact_title: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  stage: 'prospect' | 'active' | 'past' | 'lost';
  next_action: string | null;
  next_action_on: string | null;
  last_contacted_on: string | null;
  jobs: number;
  open_jobs: number;
  invoiced: number;
  collected: number;
  owed: number;
  unbilled: number;
  last_note_on: string | null;
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const STAGE_TONE = {
  prospect: 'amber',
  active: 'green',
  past: 'neutral',
  lost: 'neutral',
} as const;

export default function CustomersPage() {
  const router = useRouter();
  const { vocab } = useOrg();
  const [rows, setRows] = useState<Summary[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | Summary['stage']>('all');
  const [today, setToday] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', contact_name: '', contact_title: '', email: '', phone: '', address: '' });

  // After mount only — a date computed during render disagrees with the server.
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);

  const load = useCallback(async () => {
    const [o, res] = await Promise.all([
      getCurrentOrg(),
      supabase.from('customer_summary').select('*').order('name'),
    ]);
    setOrgId(o?.id ?? null);
    if (res.error) throw new Error(res.error.message);
    setRows(
      (res.data ?? []).map((r: Record<string, unknown>) => ({
        ...(r as unknown as Summary),
        jobs: num(r.jobs),
        open_jobs: num(r.open_jobs),
        invoiced: num(r.invoiced),
        collected: num(r.collected),
        owed: num(r.owed),
        unbilled: num(r.unbilled),
      }))
    );
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

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!orgId) throw new Error('No business selected.');
      await createCustomer(orgId, {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        ...(form.contact_name.trim() ? { contact_name: form.contact_name.trim() } : {}),
        ...(form.contact_title.trim() ? { contact_title: form.contact_title.trim() } : {}),
      } as never);
      setForm({ name: '', contact_name: '', contact_title: '', email: '', phone: '', address: '' });
      setAdding(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (stageFilter !== 'all' && r.stage !== stageFilter) return false;
      if (!term) return true;
      return [r.name, r.contact_name, r.email, r.phone].some((v) =>
        v?.toLowerCase().includes(term)
      );
    });
  }, [rows, q, stageFilter]);

  // The three things a CRM should shout about.
  const dueNow = today ? rows.filter((r) => r.next_action_on && r.next_action_on <= today) : [];
  const owing = rows.filter((r) => r.owed > 0);
  const noEmail = rows.filter((r) => !r.email);

  return (
    <Page
      title={vocab.customerPlural}
      subtitle={`Who to deal with today, and what everyone is worth. Value comes from their ${vocab.jobPlural.toLowerCase()}, never typed in.`}
      action={
        <>
          <Button variant="ghost" onClick={() => router.push('/customers/import')}>
            Import a list
          </Button>
          <Button onClick={() => setAdding((v) => !v)}>
            {adding ? 'Cancel' : `New ${vocab.customer.toLowerCase()}`}
          </Button>
        </>
      }
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      {adding && (
        <Card style={{ marginBottom: 20, maxWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
            <Field label={vocab.customer === 'Client' ? 'Company' : 'Name'}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} autoFocus />
            </Field>
            <Field label="Contact person">
              <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} style={inputStyle} placeholder="Mark Mesedahl" />
            </Field>
            <Field label="Their title">
              <input value={form.contact_title} onChange={(e) => setForm({ ...form, contact_title: e.target.value })} style={inputStyle} placeholder="Owner" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Address">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          <Button onClick={submit} disabled={busy || !form.name.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </Card>
      )}

      {/* What needs doing, before the list of everyone */}
      {!loading && (dueNow.length > 0 || owing.length > 0 || noEmail.length > 0) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          {dueNow.length > 0 && (
            <Flag tone="amber" label="Follow up due" value={String(dueNow.length)} />
          )}
          {owing.length > 0 && (
            <Flag tone="blue" label="Owing you" value={money0(owing.reduce((s, r) => s + r.owed, 0))} />
          )}
          {noEmail.length > 0 && (
            <Flag tone="neutral" label="No email, can't invoice" value={String(noEmail.length)} />
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${vocab.customerPlural.toLowerCase()}…`}
          style={{ ...inputStyle, maxWidth: 260, background: C.panel }}
        />
        <div style={{ display: 'flex', gap: 5 }}>
          {(['all', 'prospect', 'active', 'past'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                fontSize: 12,
                border: `1px solid ${stageFilter === s ? C.accent : C.border}`,
                background: stageFilter === s ? C.accentSoft : 'transparent',
                color: stageFilter === s ? C.text : C.dim,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Empty>Loading…</Empty>
      ) : filtered.length === 0 ? (
        <Card>
          <Empty>
            {rows.length === 0
              ? `No ${vocab.customerPlural.toLowerCase()} yet.`
              : 'Nothing matches.'}
          </Empty>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((r) => {
            const overdue = today && r.next_action_on && r.next_action_on <= today;
            return (
              <Card
                key={r.customer_id}
                style={{
                  padding: 16,
                  cursor: 'pointer',
                  borderColor: overdue ? C.amber : C.border,
                }}
              >
                <div
                  onClick={() => router.push(`/customers/${r.customer_id}`)}
                  style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}
                >
                  <Avatar src={r.avatar_url} name={r.contact_name || r.name} size={46} />

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 500 }}>{r.name}</span>
                      <Pill tone={STAGE_TONE[r.stage]}>{r.stage}</Pill>
                      {r.open_jobs > 0 && (
                        <Pill tone="blue">
                          {r.open_jobs} open {r.open_jobs === 1 ? vocab.job.toLowerCase() : vocab.jobPlural.toLowerCase()}
                        </Pill>
                      )}
                    </div>

                    {r.contact_name && (
                      <div style={{ fontSize: 12.5, color: C.dim, marginTop: 3 }}>
                        {r.contact_name}
                        {r.contact_title && <span style={{ color: C.faint }}> · {r.contact_title}</span>}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 7, fontSize: 12 }}>
                      {r.email ? (
                        <a
                          href={`mailto:${r.email}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: C.accent, textDecoration: 'none' }}
                        >
                          {r.email}
                        </a>
                      ) : (
                        <span style={{ color: C.amber }}>No email, so you can&apos;t invoice them</span>
                      )}
                      {r.phone && (
                        <a
                          href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: C.dim, textDecoration: 'none' }}
                        >
                          {r.phone}
                        </a>
                      )}
                    </div>

                    {r.next_action && (
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 12.5,
                          color: overdue ? C.amber : C.dim,
                          background: overdue ? C.amberSoft : C.panelAlt,
                          padding: '6px 10px',
                          borderRadius: radius.sm,
                          display: 'inline-block',
                        }}
                      >
                        <strong style={{ fontWeight: 600 }}>Next:</strong> {r.next_action}
                        {r.next_action_on && ` · ${shortDate(r.next_action_on)}`}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                    <Stat label="Invoiced" value={r.invoiced > 0 ? money(r.invoiced) : '—'} />
                    <Stat
                      label="Owed"
                      value={r.owed > 0 ? money(r.owed) : '—'}
                      color={r.owed > 0 ? C.amber : undefined}
                    />
                    <Stat
                      label="Unbilled"
                      value={r.unbilled > 0 ? money(r.unbilled) : '—'}
                      color={r.unbilled > 0 ? C.amber : undefined}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ minWidth: 72 }}>
      <div
        style={{
          fontSize: 9.5,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: C.faint,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, marginTop: 3, color: color ?? C.text }}>{value}</div>
    </div>
  );
}

function Flag({
  tone,
  label,
  value,
}: {
  tone: 'amber' | 'blue' | 'neutral';
  label: string;
  value: string;
}) {
  const fg = tone === 'amber' ? C.amber : tone === 'blue' ? C.accent : C.dim;
  const bg = tone === 'amber' ? C.amberSoft : tone === 'blue' ? C.accentSoft : C.panelAlt;
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${C.border}`,
        borderRadius: radius.md,
        padding: '10px 14px',
      }}
    >
      <div style={{ fontSize: 17, color: fg, fontWeight: 500 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{label}</div>
    </div>
  );
}
