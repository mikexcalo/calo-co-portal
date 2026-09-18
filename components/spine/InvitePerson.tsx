'use client';

/**
 * Give somebody a login.
 *
 * Two things this got wrong first time.
 *
 * It rendered a whole card inside the page header's action slot, which is a
 * flex row sized to a button — so opening it stretched the button beside it
 * into a black column the height of the form. A dialog belongs over the page,
 * not inside its header.
 *
 * And it asked you to type an email you already have. The person you are
 * inviting is usually somebody you have spoken to and written down, so typing
 * a name searches the address book and fills the rest in.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import supabase from '@/lib/supabase';
import { human } from '@/lib/spine/errors';
import { Button, C, inputStyle } from './ui';

const ROLES = [
  { id: 'member', label: 'Can do the work', note: 'Add jobs, log hours, file receipts. Cannot change settings or rates.' },
  { id: 'admin',  label: 'Can run the business', note: 'Everything above, plus settings, rates and inviting other people.' },
] as const;

interface Suggestion { id: string; name: string; email: string | null; company: string | null }

export function InvitePerson({ orgId, orgName, onDone }: { orgId: string; orgName?: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [link, setLink] = useState('');
  const [emailed, setEmailed] = useState(true);
  const [copied, setCopied] = useState(false);
  const [hits, setHits] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  /* Escape closes it, and the backdrop is clickable. Standard, and absent. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  /**
   * Everybody you already know, across every business you belong to.
   *
   * Row-level security decides what comes back, so this cannot reach into a
   * workspace you are not a member of.
   */
  const search = useCallback(async (text: string) => {
    const t = text.trim();
    if (t.length < 2) { setHits([]); return; }
    const res = await supabase
      .from('customer_contacts')
      .select('id, name, email, company')
      .or(`name.ilike.%${t}%,email.ilike.%${t}%,company.ilike.%${t}%`)
      .not('email', 'is', null)
      .limit(6);
    setHits((res.data ?? []) as Suggestion[]);
  }, []);

  useEffect(() => {
    if (picked) return;
    const id = setTimeout(() => search(q), 180);
    return () => clearTimeout(id);
  }, [q, picked, search]);

  function choose(s: Suggestion) {
    setEmail(s.email ?? '');
    setName(s.name);
    setQ(s.name);
    setPicked(true);
    setHits([]);
  }

  async function send() {
    const to = (email || q).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      setError('That does not look like an email address. Pick somebody from the list, or type the whole address.');
      return;
    }
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
      const body = (await res.json().catch(() => ({}))) as {
        error?: string; link?: string; emailed?: boolean;
      };
      if (!res.ok) { setError(human(body.error ?? '', 'That invite did not send.')); setBusy(false); return; }

      setSent(to);
      setLink(body.link ?? '');
      setEmailed(body.emailed !== false);
      setQ(''); setEmail(''); setName(''); setPicked(false);
      onDone?.();
    } catch (e) {
      setError(human(e, 'That invite did not send.'));
    }
    setBusy(false);
  }

  /**
   * The trigger stays put while the dialog is open.
   *
   * Returning only the overlay took the button out of the header, and a
   * header that reflows when you click something in it is the same class of
   * bug as the one this component started with.
   */
  return (
    <>
      <Button variant="ghost" onClick={() => { setOpen(true); setSent(''); setError(''); }}>
        Invite someone
      </Button>
      {open && (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(16,17,20,.34)',
        display: 'grid', placeItems: 'start center',
        padding: '10vh 20px 20px',
      }}
    >
      <div
        ref={box}
        role="dialog"
        aria-label="Invite someone"
        style={{
          width: '100%', maxWidth: 480, background: C.panel,
          border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '20px 22px 22px', boxShadow: '0 24px 60px rgba(0,0,0,.18)',
          textAlign: 'left',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 600, color: C.text }}>
          Invite someone to {orgName && !/^untitled/i.test(orgName) ? orgName : 'this business'}
        </div>
        <p style={{ fontSize: 13, color: C.faint, margin: '4px 0 16px' }}>
          They get an email with a link to set their own password. If they already have a
          login, this adds this business to it.
        </p>

        <div style={{ position: 'relative' }}>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPicked(false); setEmail(e.target.value); }}
            placeholder="Start typing a name, or paste an email"
            style={inputStyle}
            autoFocus
          />
          {hits.length > 0 && (
            <div
              style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2,
                marginTop: 4, background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: 9, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,.12)',
              }}
            >
              {hits.map((s) => (
                <button
                  key={s.id}
                  onClick={() => choose(s)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '8px 11px', fontFamily: 'inherit',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <div style={{ fontSize: 13.5, color: C.text }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: C.faint }}>
                    {s.email}{s.company ? ` · ${s.company}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {picked && (
          <p style={{ fontSize: 12, color: C.faint, margin: '6px 0 0' }}>
            Inviting {name} at {email}.
          </p>
        )}

        <div style={{ display: 'grid', gap: 6, marginTop: 14 }}>
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              style={{
                textAlign: 'left',
                background: role === r.id ? C.panelAlt : 'transparent',
                border: `1px solid ${role === r.id ? C.ink : C.border}`,
                borderRadius: 9, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 500, color: C.text }}>{r.label}</div>
              <div style={{ fontSize: 12, color: C.faint, marginTop: 1 }}>{r.note}</div>
            </button>
          ))}
        </div>

        {error && <p style={{ fontSize: 12.5, color: C.red, margin: '12px 0 0' }}>{error}</p>}

        {sent && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 12.5, color: emailed ? C.green : C.amber, margin: 0 }}>
              {emailed
                ? `Sent to ${sent}. They set their own password from the email.`
                : `Account ready for ${sent}, but the email did not send. Copy the link and send it yourself.`}
            </p>
            {link && (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <input
                    readOnly
                    value={link}
                    onFocus={(e) => e.currentTarget.select()}
                    style={{ ...inputStyle, fontSize: 11.5 }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(link).then(() => {
                        setCopied(true); setTimeout(() => setCopied(false), 1400);
                      }).catch(() => {});
                    }}
                    style={{ background: 'transparent', border: 'none', padding: '0 4px', color: C.blue, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                  >
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
                <p style={{ fontSize: 11.5, color: C.faint, margin: '6px 0 0' }}>
                  Works once, expires in about a day.
                </p>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 18 }}>
          <Button onClick={send} disabled={busy || !(email || q).trim()}>
            {busy ? 'Sending…' : sent ? 'Invite somebody else' : 'Send the invite'}
          </Button>
          <button
            onClick={() => setOpen(false)}
            style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {sent ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
      )}
    </>
  );
}
