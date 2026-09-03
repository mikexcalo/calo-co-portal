'use client';

/**
 * Everybody, not just clients.
 *
 * The gap this fills: you have a good call with a fractional ops lead, and
 * there is nowhere to put her. She is not a client, not a company you are
 * chasing, and not somebody at a client. So she goes in a phone or a notebook,
 * and the cost lands six months later when you need somebody who does exactly
 * what she does and cannot remember her name.
 *
 * One list, filtered, rather than a second address book beside the client one.
 * Two places to look for a person guarantees that somebody is filed in the
 * wrong one.
 *
 * What it deliberately does not do is score anybody or move them through
 * stages. This is a record of who you know and what was said. The pipeline is
 * a different screen because it answers a different question.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import {
  Button,
  C,
  Card,
  Empty,
  Page,
  Pill,
  Avatar,
  inputStyle,
} from '@/components/spine/ui';

type Relationship = 'contact' | 'client' | 'prospect' | 'referrer' | 'freelancer' | 'partner';

interface Person {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  note: string | null;
  relationship: Relationship;
  met_how: string | null;
  met_on: string | null;
  last_spoke_on: string | null;
  customer_id: string | null;
  avatar_url: string | null;
  customers: { name: string } | null;
}

/**
 * Why they are in the book, in the order you meet them.
 *
 * Not a funnel. A referrer is not further along than a contact, they are a
 * different kind of relationship, and sorting them into a pipeline is how a
 * useful address book turns into a sales tool nobody updates.
 */
const KINDS: { key: Relationship; label: string; tone: 'blue' | 'green' | 'amber' | 'neutral' }[] = [
  { key: 'contact', label: 'Met them', tone: 'neutral' },
  { key: 'client', label: 'At a client', tone: 'green' },
  { key: 'prospect', label: 'Might buy', tone: 'amber' },
  { key: 'referrer', label: 'Sends work', tone: 'blue' },
  { key: 'freelancer', label: 'Could hire', tone: 'neutral' },
  { key: 'partner', label: 'Could sell with', tone: 'blue' },
];

const kindOf = (k: Relationship) => KINDS.find((x) => x.key === k) ?? KINDS[0];

const blank = {
  name: '',
  title: '',
  company: '',
  website: '',
  email: '',
  phone: '',
  relationship: 'contact' as Relationship,
  met_how: '',
  note: '',
};

export default function PeoplePage() {
  const router = useRouter();
  const { org } = useOrg();
  const [rows, setRows] = useState<Person[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Relationship | 'all'>('all');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await supabase
      .from('customer_contacts')
      .select(
        'id, name, title, company, website, email, phone, note, relationship, met_how, met_on, last_spoke_on, customer_id, avatar_url, customers(name)'
      )
      .order('name');
    if (!res.error) setRows((res.data ?? []) as unknown as Person[]);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!org || !draft.name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await supabase.from('customer_contacts').insert({
      org_id: org.id,
      name: draft.name.trim(),
      title: draft.title.trim() || null,
      company: draft.company.trim() || null,
      website: draft.website.trim() || null,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      relationship: draft.relationship,
      met_how: draft.met_how.trim() || null,
      note: draft.note.trim() || null,
      // Today, because you are adding them right after speaking to them. It is
      // the one date that is almost always right and never gets filled in.
      met_on: new Date().toISOString().slice(0, 10),
      last_spoke_on: new Date().toISOString().slice(0, 10),
      is_primary: false,
    });
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setDraft(blank);
    setAdding(false);
    await load();
  };

  const save = async (id: string, patch: Partial<Person>) => {
    await supabase.from('customer_contacts').update(patch).eq('id', id);
    load();
  };

  const spokeToday = async (id: string) => {
    await save(id, { last_spoke_on: new Date().toISOString().slice(0, 10) });
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (filter !== 'all' && p.relationship !== filter) return false;
      if (!needle) return true;
      // Searches the substance too. The reason you are looking somebody up is
      // usually something they said, not their name.
      return [p.name, p.company, p.title, p.email, p.note, p.met_how, p.customers?.name]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(needle));
    });
  }, [rows, q, filter]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((p) => m.set(p.relationship, (m.get(p.relationship) ?? 0) + 1));
    return m;
  }, [rows]);

  return (
    <Page
      title="People"
      subtitle="Your network. Everyone you know, whether or not they pay you."
      action={
        <Button onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : 'Add someone'}
        </Button>
      }
    >
      {adding && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }}>
            <input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" style={inputStyle} />
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="What they do" style={inputStyle} />
            <input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} placeholder="Where they work" style={inputStyle} />
            <input value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} placeholder="Website" style={inputStyle} />
            <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" style={inputStyle} />
            <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Phone" style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {KINDS.map((k) => (
              <button
                key={k.key}
                onClick={() => setDraft({ ...draft, relationship: k.key })}
                style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: `1px solid ${draft.relationship === k.key ? C.accent : C.border}`,
                  background: draft.relationship === k.key ? C.accentSoft : 'transparent',
                  color: draft.relationship === k.key ? C.accent : C.dim,
                }}
              >
                {k.label}
              </button>
            ))}
          </div>

          <input
            value={draft.met_how}
            onChange={(e) => setDraft({ ...draft, met_how: e.target.value })}
            placeholder="How you met. Six months from now this is the thing you will want and the thing you did not write down."
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <textarea
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            placeholder="What you actually discussed."
            rows={3}
            style={{ ...inputStyle, marginBottom: 10, resize: 'vertical' }}
          />
          {error && <div style={{ fontSize: 13, color: C.red, marginBottom: 8 }}>{error}</div>}
          <Button onClick={add} disabled={busy || !draft.name.trim()}>
            {busy ? 'Saving…' : 'Add'}
          </Button>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search names, companies, and what was said"
          style={{ ...inputStyle, flex: '1 1 260px' }}
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '6px 10px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${filter === 'all' ? C.accent : C.border}`,
              background: filter === 'all' ? C.accentSoft : 'transparent',
              color: filter === 'all' ? C.accent : C.dim,
            }}
          >
            All ({rows.length})
          </button>
          {KINDS.filter((k) => (counts.get(k.key) ?? 0) > 0).map((k) => (
            <button
              key={k.key}
              onClick={() => setFilter(k.key)}
              style={{
                padding: '6px 10px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${filter === k.key ? C.accent : C.border}`,
                background: filter === k.key ? C.accentSoft : 'transparent',
                color: filter === k.key ? C.accent : C.dim,
              }}
            >
              {k.label} ({counts.get(k.key)})
            </button>
          ))}
        </div>
      </div>

      {!loaded ? (
        <Empty>Loading…</Empty>
      ) : shown.length === 0 ? (
        <Card>
          <Empty>
            {rows.length === 0
              ? 'Nobody yet. Add the last person you had a good call with.'
              : 'Nobody matches that.'}
          </Empty>
        </Card>
      ) : (
        <Card>
          {shown.map((p, idx) => {
            const k = kindOf(p.relationship);
            const open = openId === p.id;
            return (
              <div
                key={p.id}
                style={{
                  padding: '9px 0',
                  borderTop: idx === 0 ? 'none' : `1px solid ${C.border}`,
                }}
              >
                <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                  <Avatar src={p.avatar_url} name={p.name} size={26} />

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 500, color: C.text }}>{p.name}</span>
                      <Pill tone={k.tone}>{k.label}</Pill>
                    </div>
                    <div style={{ fontSize: 12.5, color: C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[p.title, p.customers?.name ?? p.company].filter(Boolean).join(' · ') || 'No details yet'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 11, flexShrink: 0, alignItems: 'center' }}>
                    {p.website && (
                      <a
                        href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{ fontSize: 12.5, color: C.dim, textDecoration: 'none' }}
                      >
                        Site
                      </a>
                    )}
                    {p.email && (
                      <a href={`mailto:${p.email}`} style={{ fontSize: 12.5, color: C.accent, textDecoration: 'none' }}>
                        Email
                      </a>
                    )}
                    <button
                      onClick={() => setOpenId(open ? null : p.id)}
                      style={{ background: 'transparent', border: 'none', padding: 0, color: C.dim, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {open ? 'Close' : 'Open'}
                    </button>
                  </div>
                </div>

                {/* The substance, folded. A list you scan should not make you
                    read six paragraphs to find one name. */}
                {open && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                      {([
                        ['title', 'What they do'],
                        ['company', 'Where they work'],
                        ['website', 'Website'],
                        ['email', 'Email'],
                        ['phone', 'Phone'],
                        ['met_how', 'How you met'],
                      ] as const).map(([field, ph]) => (
                        <input
                          key={field}
                          defaultValue={(p[field] as string | null) ?? ''}
                          placeholder={ph}
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null;
                            if (v !== (p[field] ?? null)) save(p.id, { [field]: v });
                          }}
                          style={{ ...inputStyle, fontSize: 13 }}
                        />
                      ))}
                    </div>

                    <textarea
                      defaultValue={p.note ?? ''}
                      placeholder="What you discussed."
                      rows={4}
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null;
                        if (v !== (p.note ?? null)) save(p.id, { note: v });
                      }}
                      style={{ ...inputStyle, fontSize: 13, resize: 'vertical' }}
                    />

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {KINDS.map((kk) => (
                        <button
                          key={kk.key}
                          onClick={() => save(p.id, { relationship: kk.key })}
                          style={{
                            padding: '4px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                            border: `1px solid ${p.relationship === kk.key ? C.accent : C.border}`,
                            background: p.relationship === kk.key ? C.accentSoft : 'transparent',
                            color: p.relationship === kk.key ? C.accent : C.faint,
                          }}
                        >
                          {kk.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, color: C.faint }}>
                        {p.last_spoke_on ? `Last spoke ${p.last_spoke_on}` : 'No call logged'}
                        {p.met_on ? ` · met ${p.met_on}` : ''}
                      </span>
                      <button
                        onClick={() => spokeToday(p.id)}
                        style={{ background: 'transparent', border: 'none', padding: 0, color: C.accent, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Spoke today
                      </button>
                      {p.customer_id && (
                        <button
                          onClick={() => router.push(`/customers/${p.customer_id}`)}
                          style={{ background: 'transparent', border: 'none', padding: 0, color: C.accent, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}
                        >
                          Open {p.customers?.name ?? 'the client'} →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </Page>
  );
}
