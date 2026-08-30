'use client';

/**
 * Security — turning two-factor on, and the backup codes that make it safe to
 * do so.
 *
 * The hard part is not the cryptography, it is that people refuse to switch it
 * on. They refuse because losing the phone means losing the business, and they
 * are right to worry. So backup codes are not an afterthought: they are shown
 * once, during setup, and the flow will not let you past without seeing them.
 *
 * The copy went through a rewrite after a real run-through, which is worth
 * recording so it does not drift back. The first version explained the
 * mechanism to someone who already knew what a second factor was, and said
 * "nobody can let you in, including me" — the author's voice, in a product
 * a stranger is meant to trust. Now: say what the thing is before asking
 * anyone to set it up, call them backup codes rather than recovery codes
 * because that is what people say out loud, and finish with a screen that
 * confirms it worked instead of leaving someone staring at a grid of codes
 * wondering what happens next.
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

type Stage = 'idle' | 'explain' | 'scan' | 'codes' | 'done';

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
      setNotice('Two-factor is off. Signing in now takes only your password.');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = () => {
    navigator.clipboard?.writeText(codes.join('\n'));
    setNotice('Copied to your clipboard. Paste them somewhere safe now.');
  };

  return (
    <Page
      title="Security"
      subtitle="How your account is protected, and what happens if you lose your phone."
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
          <SectionLabel>Step 3 of 3 — save your backup codes</SectionLabel>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: C.text, margin: '8px 0 10px' }}>
            These are how you get in if you lose your phone
          </h2>
          <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.7, margin: '0 0 12px', maxWidth: 560 }}>
            Your phone is now the only thing that can produce your sign-in codes. If it is lost,
            stolen, replaced or wiped, these eight codes are the way back into your account.
          </p>
          <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.7, margin: '0 0 12px', maxWidth: 560 }}>
            Enter one on the sign-in screen and it switches two-factor off, so your password works
            on its own again. Then you set it up fresh on your new phone. Each code works once.
          </p>
          <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.7, margin: '0 0 16px', maxWidth: 560 }}>
            Keep them somewhere other than the phone you just set up — a password manager, or
            printed and filed with your business paperwork. They cannot be looked up again later,
            and no one at Nautilus can retrieve them for you.
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
              onClick={() => {
                setCodes([]);
                setStage('done');
                setNotice(null);
              }}
            >
              I&apos;ve saved them — finish
            </Button>
          </div>

          <p style={{ fontSize: 11.5, color: C.faint, marginTop: 14, lineHeight: 1.6 }}>
            This is the only time these are shown on screen.
          </p>
        </Card>
      ) : stage === 'done' ? (
        /* A finish line. Without one, the last thing someone sees is a wall of
           codes and no confirmation that any of it worked. */
        <Card>
          <div style={{ fontSize: 17, fontWeight: 600, color: C.text, marginBottom: 10 }}>
            Two-factor is on. You&apos;re done.
          </div>
          <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.7, margin: '0 0 14px', maxWidth: 560 }}>
            Nothing else to do now. The next time you sign in, Nautilus will ask for your
            password as usual, and then for the six-digit code showing in your authenticator app.
          </p>
          <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.7, margin: '0 0 18px', maxWidth: 560 }}>
            Your existing sign-in on this device keeps working — you will not be logged out.
          </p>
          <Button onClick={() => setStage('idle')}>Back to security settings</Button>
        </Card>
      ) : stage === 'explain' ? (
        /* Nobody should be asked to scan a QR code before being told what it
           is for, what an authenticator app is, or how long this takes.
           Skipping this screen is why people abandon halfway and end up with
           a half-enrolled account. */
        <Card>
          <SectionLabel>Before you start</SectionLabel>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: C.text, margin: '8px 0 12px' }}>
            What you&apos;re setting up
          </h2>
          <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.7, margin: '0 0 16px', maxWidth: 580 }}>
            An <strong>authenticator app</strong> on your phone that produces a six-digit code,
            changing every 30 seconds. From now on, signing in to Nautilus takes your password
            and then that code. Anyone who gets hold of your password still cannot get in,
            because they do not have your phone.
          </p>

          <div
            style={{
              background: C.panelAlt,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '14px 16px',
              marginBottom: 16,
              maxWidth: 580,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              You&apos;ll need an authenticator app
            </div>
            <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.7, margin: '0 0 8px' }}>
              You may already have one. iPhone and Android both have it built into the password
              manager, and 1Password, Bitwarden and LastPass all do it too.
            </p>
            <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.7, margin: 0 }}>
              If not, search your app store for <strong>Google Authenticator</strong>. It is free,
              takes a minute to install, and works for every other site that offers this.
            </p>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
            Three steps, about two minutes
          </div>
          <ol style={{ margin: '0 0 20px', paddingLeft: 20, fontSize: 13.5, color: C.dim, lineHeight: 1.9, maxWidth: 580 }}>
            <li>Point your authenticator app at a square barcode on the next screen.</li>
            <li>Type the six digits it starts showing, to prove it worked.</li>
            <li>Save eight backup codes — your way in if the phone is ever lost.</li>
          </ol>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={begin} disabled={busy}>
              {busy ? 'One moment…' : 'I have an authenticator app — continue'}
            </Button>
            <Button variant="ghost" onClick={() => setStage('idle')}>Not now</Button>
          </div>
        </Card>
      ) : stage === 'scan' && enrol ? (
        <Card>
          <SectionLabel>Step 1 of 3 — scan this</SectionLabel>
          <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, margin: '8px 0 14px', maxWidth: 560 }}>
            Open your authenticator app, choose to add an account, and point your camera at this
            square. Your app will start showing a six-digit code for Nautilus.
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
            <SectionLabel>Step 2 of 3 — prove it worked</SectionLabel>
            <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, margin: '8px 0 12px' }}>
              Type the six digits your app is now showing for Nautilus. They change every 30
              seconds, so use whichever is on screen when you type.
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
                <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.7, margin: 0 }}>
                  {enabled
                    ? 'Signing in now takes your password and a six-digit code from your phone. Someone who steals your password still cannot get in without your phone.'
                    : 'Adds a second step when you sign in: after your password, Nautilus asks for a six-digit code that only your phone can produce. It means a stolen or guessed password is not enough on its own — which is how most business accounts are lost.'}
                </p>
              </div>
              <div>
                {enabled ? (
                  <Button variant="danger" onClick={() => setConfirmOff(true)}>Turn off</Button>
                ) : (
                  <Button onClick={() => setStage('explain')} disabled={busy}>
                    Set it up
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
                        Backup codes
                      </span>
                      <Pill tone={remaining === 0 ? 'red' : remaining <= 2 ? 'amber' : 'neutral'}>
                        {remaining} left
                      </Pill>
                    </div>
                    <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, margin: 0 }}>
                      {remaining === 0
                        ? 'You have none left. If your phone is lost or replaced now, there is no way back into this account. Generate a new set and save them.'
                        : 'Your way in if your phone is lost, stolen or replaced. Entering one on the sign-in screen switches two-factor off so your password works alone again, and each code can only be used once.'}
                    </p>
                  </div>
                  <div>
                    <Button variant={remaining === 0 ? 'primary' : 'ghost'} onClick={regenerate} disabled={busy}>
                      {remaining === 0 ? 'Generate backup codes' : 'Replace with a new set'}
                    </Button>
                  </div>
                </div>
                {remaining > 0 && (
                  <p style={{ fontSize: 11.5, color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
                    Generating a new set cancels the old one — any codes you saved or printed
                    before will stop working.
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
          body="Signing in will go back to just your password. Your backup codes will stop working, and you can set two-factor up again at any time."
          confirmLabel="Turn it off"
          busy={busy}
          onConfirm={turnOff}
          onCancel={() => setConfirmOff(false)}
        />
      )}
    </Page>
  );
}
