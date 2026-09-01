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
  avatar_url?: string | null;
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
  /** Who is being edited, and the fields as they stand. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ email: '', phone: '', title: '' });

  const load = useCallback(async () => {
    const res = await supabase
      .from('customer_contacts')
      .select('id, name, title, email, phone, note, is_primary, avatar_url')
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

  /**
   * Contact details, fixable in place.
   *
   * A person could be added and deleted but never corrected, so the one thing
   * people actually do to a contact record, filling in the email they did not
   * have on the day they created it, was the one thing there was no way to do.
   */
  const saveEdit = async (p: Person) => {
    setBusy(true);
    setError(null);
    const res = await supabase
      .from('customer_contacts')
      .update({
        email: edit.email.trim() || null,
        phone: edit.phone.trim() || null,
        title: edit.title.trim() || null,
      })
      .eq('id', p.id);
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setEditingId(null);
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
          {error && <div style={{ fontSize: 13, color: C.red, marginBottom: 8 }}>{error}</div>}
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
              {/* A face makes a list of names scannable. Falls back to
                  initials rather than a grey silhouette, which reads as a
                  missing image rather than as somebody we simply have no
                  photo of. */}
              <span
                aria-hidden
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  flexShrink: 0,
                  overflow: 'hidden',
                  background: C.accentSoft,
                  color: C.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatar_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  p.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
                )}
              </span>

              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{p.name}</span>
                  {p.is_primary && <Pill tone="blue">Main contact</Pill>}
                </div>
                {p.title && (
                  <div style={{ fontSize: 13, color: C.faint, marginTop: 2 }}>{p.title}</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                {p.email ? (
                  <a
                    href={`mailto:${p.email}`}
                    style={{ fontSize: 13.5, color: C.blue, textDecoration: 'none' }}
                  >
                    {p.email}
                  </a>
                ) : (
                  /* The gap says what it costs you, and fixes itself. */
                  <button
                    onClick={() => {
                      setEditingId(p.id);
                      setEdit({ email: '', phone: p.phone ?? '', title: p.title ?? '' });
                    }}
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      fontSize: 13.5,
                      color: C.amber,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    No email, so you can&apos;t invoice them. Add one
                  </button>
                )}
                {/* A tel: link, because half the time this is being read on a
                    phone with the person's number right there. */}
                {p.phone && (
                  <a
                    href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}
                    style={{ fontSize: 13.5, color: C.dim, textDecoration: 'none' }}
                  >
                    {p.phone}
                  </a>
                )}
                {p.email && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingId(editingId === p.id ? null : p.id);
                      setEdit({ email: p.email ?? '', phone: p.phone ?? '', title: p.title ?? '' });
                    }}
                  >
                    {editingId === p.id ? 'Cancel' : 'Edit'}
                  </Button>
                )}
                {!p.is_primary && (
                  <Button variant="ghost" onClick={() => makePrimary(p)} disabled={busy}>
                    Make main
                  </Button>
                )}
                {/* Pushed away from the phone number it was sitting beside.
                    A destructive control inside arm's reach of the thing you
                    tap most is how people delete a contact trying to call
                    one. */}
                <button
                  onClick={() => setConfirmDelete(p)}
                  aria-label={`Remove ${p.name}`}
                  title="Remove"
                  style={{
                    marginLeft: 4,
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    background: 'transparent',
                    color: C.faint,
                    fontSize: 15,
                    lineHeight: 1,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ×
                </button>
              </div>

              {editingId === p.id && (
                <div
                  style={{
                    flexBasis: '100%',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: 8,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: `1px solid ${C.border}`,
                  }}
                >
                  <input
                    value={edit.email}
                    onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(p); }}
                    type="email"
                    placeholder="Email"
                    autoFocus
                    style={{ ...inputStyle, fontSize: 13.5, padding: '6px 9px' }}
                  />
                  <input
                    value={edit.phone}
                    onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(p); }}
                    placeholder="Phone"
                    style={{ ...inputStyle, fontSize: 13.5, padding: '6px 9px' }}
                  />
                  <input
                    value={edit.title}
                    onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(p); }}
                    placeholder="Their title"
                    style={{ ...inputStyle, fontSize: 13.5, padding: '6px 9px' }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button onClick={() => saveEdit(p)} disabled={busy}>
                      {busy ? 'Saving…' : 'Save'}
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              )}
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
