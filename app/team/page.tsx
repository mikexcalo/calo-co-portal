'use client';

/**
 * Team — who can get into this business.
 *
 * Deliberately scoped to the business you're currently in. Inviting someone
 * to Mammoth from the Mammoth view means you can't accidentally hand a client
 * a key to your agency's books.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import {
  Button,
  C,
  Card,
  Empty,
  Field,
  Page,
  Pill,
  SectionLabel,
  Row,
  Table,
  inputStyle,
  shortDate,
  SETUP_TABS,
} from '@/components/spine/ui';

interface Member {
  user_id: string;
  role: string;
  created_at: string;
}

export default function TeamPage() {
  const { org } = useOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'member' | 'admin' | 'owner'>('member');

  const load = useCallback(async () => {
    if (!org) return;
    const res = await supabase
      .from('memberships')
      .select('user_id, role, created_at')
      .eq('org_id', org.id);
    if (res.error) throw new Error(res.error.message);
    setMembers((res.data ?? []) as Member[]);
  }, [org]);

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

  const invite = async () => {
    if (!org) return;
    setBusy(true);
    setError(null);
    setHint(null);
    setNotice(null);
    try {
      // The API verifies the caller from this token, not from anything the
      // page claims about itself.
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Your session expired. Sign in again.');

      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, orgId: org.id, role, fullName: name }),
      });

      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Could not send the invite');
        if (payload.hint) setHint(payload.hint);
        return;
      }

      setNotice(payload.message);
      // Kept whichever way it went, so there is always something to send.
      setLink(payload.link ?? null);
      setEmail('');
      setName('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      tabs={SETUP_TABS}
      title="Team"
      subtitle={
        org
          ? `Who can sign in to ${org.name}. They'll see this business only.`
          : undefined
      }
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
          {hint && (
            <div style={{ color: C.dim, fontSize: 13, marginTop: 8, lineHeight: 1.55 }}>
              {hint}
            </div>
          )}
        </Card>
      )}
      {/*
        The link, always, whether the email sent or not.

        Getting somebody into this product used to mean asking for a link by
        hand, because the invitation went out through Supabase's own mail,
        which is rate limited and lands in spam. It goes from calo.company now,
        and this sits here regardless so there is always something to paste
        into a text message.
      */}
      {link && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>Their sign-in link</div>
              <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.55, marginTop: 2 }}>
                Works once, expires in about a day. They set their own password; nobody has one for
                them.
              </div>
            </div>
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </Card>
      )}

      {notice && (
        <Card style={{ borderColor: C.green, marginBottom: 16 }}>
          <div style={{ color: C.green, fontSize: 14 }}>{notice}</div>
        </Card>
      )}

      <Card style={{ maxWidth: 560, marginBottom: 24 }}>
        <SectionLabel>Invite someone</SectionLabel>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            placeholder="mark@mammothconstructiontx.com"
          />
        </Field>
        <Field label="Name (optional)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            placeholder="Mark Mesedahl"
          />
        </Field>
        <Field label="Access">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            style={inputStyle}
          >
            <option value="member">Member: can use everything in this business</option>
            <option value="admin">Admin: can also invite others</option>
            <option value="owner">Owner: full control</option>
          </select>
        </Field>

        <Button onClick={invite} disabled={busy || !email.trim() || !org}>
          {busy ? 'Sending…' : 'Send invite'}
        </Button>

        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
          They get an email to set their own password. You never see or handle it. They will
          only see <strong>{org?.name}</strong>, and no other business you belong to.
        </div>
      </Card>

      <SectionLabel>Who has access ({members.length})</SectionLabel>
      {loading ? (
        <Empty>Loading…</Empty>
      ) : members.length === 0 ? (
        <Card><Empty>Nobody yet.</Empty></Card>
      ) : (
        <Table>
          <Row cols="1fr 140px 130px" header>
            <div>User</div><div>Access</div><div>Added</div>
          </Row>
          {members.map((m) => (
            <Row key={m.user_id} cols="1fr 140px 130px">
              <div style={{ fontFamily: 'monospace', fontSize: 12.5, color: C.dim }}>
                {m.user_id.slice(0, 8)}…
              </div>
              <div><Pill tone={m.role === 'owner' ? 'blue' : 'neutral'}>{m.role}</Pill></div>
              <div style={{ color: C.dim }}>{shortDate(m.created_at)}</div>
            </Row>
          ))}
        </Table>
      )}

      <div style={{ fontSize: 12.5, color: C.faint, marginTop: 14, maxWidth: 620, lineHeight: 1.6 }}>
        Emails aren&apos;t shown here. The members table stores only the user id, and reading
        the auth records needs admin access the browser deliberately doesn&apos;t have.
      </div>
    </Page>
  );
}
