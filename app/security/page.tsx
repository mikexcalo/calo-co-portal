'use client';

/**
 * Security — turning two-factor on, and the recovery codes that make it safe
 * to do so.
 *
 * The hard part of two-factor is not the cryptography, it is that people
 * refuse to switch it on. They refuse because losing the phone means losing
 * the business, and they are right to worry. So recovery codes are not an
 * afterthought here: they are shown once, at the moment of enrolment, before
 * the switch is thrown, and the flow will not let you past without seeing
 * them.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import {
  Button,
  C,
  Card,
  Field,
  Page,
  Pill,
  SectionLabel,
  inputStyle,
} from '@/components/spine/ui';
import { Confirm } from '@/components/spine/Confirm';
import {
  confirmEnrolment,
  disable as disableMfa,
  isEnabled,
  recoveryCodesRemaining,
  startEnrolment,
  type EnrolStart,
} from '@/lib/spine/mfa';

type Stage = 'idle' | 'scan' | 'codes';

export default function SecurityPage() {
  const [enabled, setEnabled] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>('idle');
  const [enrol, setEnrol] = useState<EnrolStart | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const refresh = useCallback(async () => {
    const [on, left] = await Promise.all([isEnabled(), recoveryCodesRemaining()]);
    setEnabled(on);
    setRemaining(left);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch((e) => {
      setError((e as Error).message);
      setLoading(false);
    });
  }, [refresh]);

  /** The authenticated fetch the codes route expects. */
  const codesFetch = async (method: 'POST' | 'DELETE') => {
    const { data } = await supabase.auth.getSession();
    const res = await fetch('/api/auth/mfa/codes', {
      method,
      headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Something went wrong');
    return payload;
  };

  const begin = async () => {
    setBusy(true);
    setError(null);
    try {
      setEnrol(await startEnrolment());
      setCode('');
      setStage('scan');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!enrol) return;
    setBusy(true);
    setError(null);
    try {
      await confirmEnrolment(enrol.factorId, code);
      const { codes: fresh } = await codesFetch('POST');
      setCodes(fresh ?? []);
      setStage('codes');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const { codes: fresh } = await codesFetch('POST');
      setCodes(fresh ?? []);
      setStage('codes');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setError(null);
    try {
      await disableMfa();
      setConfirmOff(false);
      setStage('idle');
      setNotice('Two-factor is off. Your password is now the only thing protecting this account.');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = () => {
    navigator.clipboard?.writeText(codes.join('\n'));
    setNotice('Copied. Put them somewhere that is not this computer.');
  };

  return (
    <Page
      title="Security"
      subtitle="How this account is protected, and what happens if you lose your phone."
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}
      {notice && (
        <Card style={{ borderColor: C.blue, marginBottom: 16 }}>
          <div style={{ color: C.blue, fontSize: 13 }}>{notice}</div>
        </Card>
      )}

      {loading ? (
        <Card><div style={{ fontSize: 13, color: C.faint }}>Loading…</div></Card>
      ) : stage === 'codes' ? (
        <Card>
          <SectionLabel>Save these now</SectionLabel>
          <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, margin: '8px 0 16px', maxWidth: 560 }}>
            Each of these works once, and only to <strong>switch two-factor off</strong> — never
            to sign in on its own. If your phone is lost or wiped, one of these plus your
            password gets you back in. Without one, nobody can let you in, including me.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 8,
              background: C.panelAlt,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 14,
              marginBottom: 14,
            }}
          >
            {codes.map((c) => (
              <code
                key={c}
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 13.5,
                  letterSpacing: '.06em',
                  color: C.text,
                }}
              >
                {c}
              </code>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button onClick={copyCodes}>Copy all</Button>
            <Button variant="ghost" onClick={() => window.print()}>Print</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCodes([]);
                setStage('idle');
                setNotice(null);
              }}
            >
              I&apos;ve saved them
            </Button>
          </div>

          <p style={{ fontSize: 11.5, color: C.faint, marginTop: 14, lineHeight: 1.6 }}>
            This is the only time they are shown. They are stored scrambled, so they cannot be
            looked up later — if you lose them, generate a new set.
          </p>
        </Card>
      ) : stage === 'scan' && enrol ? (
        <Card>
          <SectionLabel>Step 1 — scan this</SectionLabel>
          <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, margin: '8px 0 14px', maxWidth: 560 }}>
            Open an authenticator app and point it at this square. Google Authenticator, 1Password,
            Authy and the password manager built into your phone all work. If you don&apos;t have
            one, Google Authenticator is free and takes a minute to install.
          </p>

          {/* Supabase hands back an SVG data URI. It is a QR code, so it must
              stay square — a stretched one will not scan. */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enrol.qr}
              alt="Two-factor setup code"
              width={190}
              height={190}
              style={{
                width: 190,
                height: 190,
                display: 'block',
                background: '#fff',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 10,
              }}
            />
          </div>

          <button
            onClick={() => setShowSecret((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: C.blue,
              fontSize: 12.5,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {showSecret ? 'Hide the code' : "Can't scan it? Type this instead"}
          </button>

          {showSecret && (
            <div
              style={{
                marginTop: 10,
                background: C.panelAlt,
                border: `1px solid ${C.border}`,
                borderRadius: 7,
                padding: '10px 12px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 13,
                letterSpacing: '.08em',
                wordBreak: 'break-all',
                color: C.text,
              }}
            >
              {enrol.secret}
            </div>
          )}

          <div style={{ marginTop: 22 }}>
            <SectionLabel>Step 2 — prove it worked</SectionLabel>
            <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, margin: '8px 0 12px' }}>
              Type the six digits your app is showing right now. They change every 30 seconds.
            </p>
            <div style={{ maxWidth: 200 }}>
              <Field label="Six-digit code">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && code.length === 6) confirm();
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                  style={{
                    ...inputStyle,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 18,
                    letterSpacing: '.3em',
                    textAlign: 'center',
                  }}
                />
              </Field>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <Button onClick={confirm} disabled={busy || code.length !== 6}>
              {busy ? 'Checking…' : 'Turn on two-factor'}
            </Button>
            <Button variant="ghost" onClick={() => { setStage('idle'); setError(null); }}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 560 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 500, color: C.text }}>
                    Two-factor sign-in
                  </span>
                  <Pill tone={enabled ? 'green' : 'amber'}>{enabled ? 'On' : 'Off'}</Pill>
                </div>
                <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, margin: 0 }}>
                  {enabled
                    ? 'Signing in asks for a code from your phone as well as your password. Someone who steals the password still cannot get in.'
                    : 'Right now your password is the only thing between anyone and every customer, rate and invoice in here. Passwords get reused and leaked. A code from your phone fixes that in about two minutes.'}
                </p>
              </div>
              <div>
                {enabled ? (
                  <Button variant="danger" onClick={() => setConfirmOff(true)}>Turn off</Button>
                ) : (
                  <Button onClick={begin} disabled={busy}>
                    {busy ? 'One moment…' : 'Turn it on'}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {enabled && (
            <div style={{ marginTop: 10 }}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ maxWidth: 560 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 500, color: C.text }}>
                        Recovery codes
                      </span>
                      <Pill tone={remaining === 0 ? 'red' : remaining <= 2 ? 'amber' : 'neutral'}>
                        {remaining} left
                      </Pill>
                    </div>
                    <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, margin: 0 }}>
                      {remaining === 0
                        ? 'You have none left. If you lose your phone now, there is no way back into this account — not even for me. Generate a set.'
                        : 'Your way back in if the phone is lost. Each works once, and only to switch two-factor off — never to sign in by itself.'}
                    </p>
                  </div>
                  <div>
                    <Button variant={remaining === 0 ? 'primary' : 'ghost'} onClick={regenerate} disabled={busy}>
                      {remaining === 0 ? 'Generate codes' : 'Generate new set'}
                    </Button>
                  </div>
                </div>
                {remaining > 0 && (
                  <p style={{ fontSize: 11.5, color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
                    Generating a new set cancels the old one, so anything you printed before stops
                    working.
                  </p>
                )}
              </Card>
            </div>
          )}

          <div style={{ marginTop: 26 }}>
            <SectionLabel>How your data is held</SectionLabel>
            <Card>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.dim, lineHeight: 1.85 }}>
                <li>Encrypted travelling to and from this site, and encrypted on the disks it sits on.</li>
                <li>
                  Each business is walled off in the database itself, not just in the app — so a
                  bug on a page cannot show you someone else&apos;s books.
                </li>
                <li>
                  No card numbers are stored here, ever. Card payments go straight to Stripe, who
                  are certified to hold them.
                </li>
                <li>
                  No bank account or routing numbers either. That is deliberate: the payment
                  details kept here are the public handles you already hand out to get paid.
                </li>
                <li>Hosted on infrastructure independently audited to SOC 2 Type II.</li>
              </ul>
            </Card>
          </div>
        </>
      )}

      {confirmOff && (
        <Confirm
          title="Turn off two-factor?"
          body="Your password becomes the only thing protecting every customer, rate and invoice in this account. Your recovery codes will be destroyed."
          confirmLabel="Turn it off"
          busy={busy}
          onConfirm={turnOff}
          onCancel={() => setConfirmOff(false)}
        />
      )}
    </Page>
  );
}
