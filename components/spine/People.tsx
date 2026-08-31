'use client';

/**
 * The other people at a client.
 *
 * A client is a company, not a person. Mark is the CEO, but there is an office
 * manager who handles the invoices and a foreman who answers when Mark is on a
 * roof. The record held exactly one name, so everyone else lived in somebody's
 * phone and nowhere the business could see.
 *
 * Kept deliberately shallow: a name, what they do, and how to reach them.
 * Anything more and it becomes a contact manager nobody asked for, competing
 * with the phone that already has these people in it.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, Empty, Pill, SectionLabel, inputStyle } from './ui';
import { Confirm } from './Confirm';

interface Person {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  note: string | null;
  is_primary: boolean;
}

const blank = { name: '', title: '', email: '', phone: '', note: '' };

export function People({ orgId, customerId }: { orgId: string; customerId: string }) {
  const [rows, setRows] = useState<Person[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Person | null>(null);

  const load = useCallback(async () => {
    const res = await supabase
      .from('customer_contacts')
      .select('id, name, title, email, phone, note, is_primary')
      .eq('customer_id', customerId)
      .order('is_primary', { ascending: false })
      .order('name');
    if (!res.error) setRows((res.data ?? []) as Person[]);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await supabase.from('customer_contacts').insert({
      org_id: orgId,
      customer_id: customerId,
      name: draft.name.trim(),
      title: draft.title.trim() || null,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      note: draft.note.trim() || null,
      // The first person added becomes the default. After that it is a
      // deliberate choice, not a side effect of being typed in first.
      is_primary: rows.length === 0,
    });
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setDraft(blank);
    setAdding(false);
    await load();
  };

  const makePrimary = async (p: Person) => {
    setBusy(true);
    // Stand the old one down first. The database allows only one primary per
    // client, so setting the new one first would collide.
    await supabase
      .from('customer_contacts')
      .update({ is_primary: false })
      .eq('customer_id', customerId)
      .eq('is_primary', true);
    await supabase.from('customer_contacts').update({ is_primary: true }).eq('id', p.id);
    setBusy(false);
    await load();
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    await supabase.from('customer_contacts').delete().eq('id', confirmDelete.id);
    setBusy(false);
    setConfirmDelete(null);
    await load();
  };

  return (
    <div style={{ marginBottom: 26 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <SectionLabel>People ({rows.length})</SectionLabel>
        <Button variant="ghost" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : 'Add someone'}
        </Button>
      </div>

      {adding && (
        <Card style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Name"
              autoFocus
              style={{ ...inputStyle, flex: '1 1 160px' }}
            />
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="What they do"
              style={{ ...inputStyle, flex: '1 1 160px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="Email"
              style={{ ...inputStyle, flex: '1 1 200px' }}
            />
            <input
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="Phone"
              style={{ ...inputStyle, flex: '1 1 140px' }}
            />
          </div>
          {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>{error}</div>}
          <Button onClick={add} disabled={busy || !draft.name.trim()}>
            {busy ? 'Saving…' : 'Add'}
          </Button>
        </Card>
      )}

      {rows.length === 0 ? (
        !adding && (
          <Card>
            <Empty>
              The office manager, the foreman, whoever actually answers. One name is rarely the
              whole story.
            </Empty>
          </Card>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '11px 13px',
                background: C.panel,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{p.name}</span>
                  {p.is_primary && <Pill tone="blue">Main contact</Pill>}
                </div>
                {p.title && (
                  <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{p.title}</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                {p.email && (
                  <a
                    href={`mailto:${p.email}`}
                    style={{ fontSize: 12.5, color: C.blue, textDecoration: 'none' }}
                  >
                    {p.email}
                  </a>
                )}
                {/* A tel: link, because half the time this is being read on a
                    phone with the person's number right there. */}
                {p.phone && (
                  <a
                    href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}
                    style={{ fontSize: 12.5, color: C.dim, textDecoration: 'none' }}
                  >
                    {p.phone}
                  </a>
                )}
                {!p.is_primary && (
                  <Button variant="ghost" onClick={() => makePrimary(p)} disabled={busy}>
                    Make main
                  </Button>
                )}
                <Button variant="danger" onClick={() => setConfirmDelete(p)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <Confirm
          title={`Remove ${confirmDelete.name}?`}
          body="This only removes them from this client. Nothing else is affected."
          confirmLabel="Remove"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
