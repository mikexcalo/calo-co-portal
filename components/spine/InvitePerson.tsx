'use client';

/**
 * Give somebody a login.
 *
 * Memberships were created by hand in SQL, then behind a form on a Team screen
 * filed as a tab of Business settings — three clicks deep, behind a word
 * nobody searching for "invite" would try. It is the single most common thing
 * an owner does after signing up, so it is a button where people already are.
 *
 * Roles are described by what they can do rather than named after themselves.
 * "Member" tells you nothing; "can do the work, cannot change settings" tells
 * you which one to pick.
 */

import { useState } from 'react';
import supabase from '@/lib/supabase';
import { human } from '@/lib/spine/errors';
import { Button, C, Card, inputStyle } from './ui';

const ROLES = [
  { id: 'member', label: 'Can do the work', note: 'Add jobs, log hours, file receipts. Cannot change settings or rates.' },
  { id: 'admin',  label: 'Can run the business', note: 'Everything above, plus settings, rates and inviting other people.' },
] as const;

export function InvitePerson({ orgId, orgName, onDone }: { orgId: string; orgName?: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');

  async function send() {
    const to = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { setError('That does not look like an email address.'); return; }
    setBusy(true); setError('');
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { setError('Your sign-in has expired. Reload the page.'); setBusy(false); return; }

      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: to, orgId, role, fullName: name.trim() || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(human(body.error ?? '', 'That invite did not send.')); setBusy(false); return; }

      setSent(to);
      setEmail(''); setName('');
      onDone?.();
    } catch (e) {
      setError(human(e, 'That invite did not send.'));
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => { setOpen(true); setSent(''); }}>
        Invite someone
      </Button>
    );
  }

  return (
    <Card style={{ maxWidth: 520 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 2 }}>
        Invite someone to {orgName ?? 'this business'}
      </div>
      <p style={{ fontSize: 13, color: C.faint, margin: '0 0 14px' }}>
        They get an email with a link to set a password. If they already have a login, this just
        adds this business to it.
      </p>

      <div style={{ display: 'grid', gap: 8 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Their email"
          style={inputStyle}
          autoFocus
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Their name (optional)"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
        {ROLES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRole(r.id)}
            style={{
              textAlign: 'left',
              background: role === r.id ? C.panelAlt : 'transparent',
              border: `1px solid ${role === r.id ? C.ink : C.border}`,
              borderRadius: 9,
              padding: '9px 11px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 500, color: C.text }}>{r.label}</div>
            <div style={{ fontSize: 12, color: C.faint, marginTop: 1 }}>{r.note}</div>
          </button>
        ))}
      </div>

      {error && <p style={{ fontSize: 12.5, color: C.red, margin: '10px 0 0' }}>{error}</p>}
      {sent && (
        <p style={{ fontSize: 12.5, color: C.green, margin: '10px 0 0' }}>
          Sent to {sent}. They can sign in as soon as they follow the link.
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
        <Button onClick={send} disabled={busy || !email.trim()}>
          {busy ? 'Sending…' : 'Send the invite'}
        </Button>
        <button
          onClick={() => { setOpen(false); setError(''); }}
          style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Close
        </button>
      </div>
    </Card>
  );
}
