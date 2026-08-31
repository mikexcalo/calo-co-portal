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
import { PRODUCT } from '@/lib/brand';
import {
  confirmEnrolment,
  disable as disableMfa,
  isEnabled,
  recoveryCodesRemaining,
  startEnrolment,
  type EnrolStart,
} from '@/lib/spine/mfa';

type Stage = 'idle' | 'explain' | 'scan' | 'codes' | 'done';

const icon = (d: React.ReactNode) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
);

/**
 * Written as sentences someone would say, not as a specification. Each one
 * leads with what it means for the reader and only then explains the
 * mechanism, because "a bug on a page cannot show you someone else's books"
 * is the part a contractor actually cares about.
 */
const DATA_FACTS = [
  {
    title: 'Everything is encrypted, both moving and sitting still',
    body:
      'Your information is scrambled travelling between your browser and our servers, and stays scrambled on the disks it rests on. Someone who walked out with the hardware would have nothing readable.',
    icon: icon(
      <>
        <rect x="3" y="7" width="10" height="6.5" rx="1.4" />
        <path d="M5.4 7V5.1a2.6 2.6 0 0 1 5.2 0V7" />
      </>
    ),
  },
  {
    title: 'Your business is walled off from every other business',
    body:
      'The separation lives in the database, not in the screens on top of it. Protection never depends on the app being written perfectly. A mistake on a page still can’t pull up another company’s customers, prices or invoices, because the request is refused before it reaches the screen.',
    icon: icon(
      <>
        <path d="M8 1.9 2.9 4v3.4c0 2.9 2 5.5 5.1 6.7 3-1.2 5.1-3.8 5.1-6.7V4z" />
        <path d="M8 3v10.4" />
      </>
    ),
  },
  {
    title: 'We never store card numbers',
    body:
      `When a customer pays you by card, the number goes straight to Stripe and never passes through ${PRODUCT} at all. Stripe holds card data for millions of businesses and is certified at the highest level the payments industry has, so it is safer in their hands than in ours.`,
    icon: icon(
      <>
        <rect x="1.8" y="3.6" width="12.4" height="8.8" rx="1.5" />
        <path d="M1.8 6.6h12.4" />
      </>
    ),
  },
  {
    title: 'We never store bank account or routing numbers',
    body:
      `This one is a deliberate design decision rather than something we have not got to. The only payment details kept here are the handles you already give out freely — a Venmo username, a PayPal address. Knowing one lets somebody send you money, not take it. When a customer needs your real account details, ${PRODUCT} tells them to ask you directly instead of storing them.`,
    icon: icon(
      <>
        <path d="M2.2 6.2 8 3l5.8 3.2" />
        <path d="M3.6 6.9v5.4M7 6.9v5.4M10.4 6.9v5.4M13.8 6.9v5.4" />
        <path d="M2.2 13.2h11.6" />
      </>
    ),
  },
  {
    title: 'The servers underneath are independently audited',
    body:
      `${PRODUCT} runs on Supabase and Vercel, both of which pay outside auditors every year to verify how they handle customer data, to the SOC 2 Type II standard. Your records are held in the United States on Amazon Web Services.`,
    icon: icon(
      <>
        <rect x="2" y="2.4" width="12" height="4.4" rx="1.2" />
        <rect x="2" y="9.2" width="12" height="4.4" rx="1.2" />
        <path d="M4.6 4.6h.01M4.6 11.4h.01" />
      </>
    ),
  },
];

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
      subtitle="How your account is protected, and how to get back in if you lose your phone."
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
            Your phone is now the only thing that can produce your sign-in codes. If it&apos;s lost, stolen, replaced or wiped, these eight codes get you back in.
          </p>
          <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.7, margin: '0 0 12px', maxWidth: 560 }}>
            Enter one at sign-in and two-factor turns off, so your password works on its own. Set it up fresh on your new phone. Each code works once.
          </p>
          <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.7, margin: '0 0 16px', maxWidth: 560 }}>
            Store them somewhere other than the phone you just set up. A password manager works, so does printing them and filing them with your business paperwork. They can&apos;t be looked up again, and no one at {PRODUCT} can retrieve them for you.
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
            You&apos;re done. Next time you sign in, {PRODUCT} asks for your password as usual, then the six-digit code from your authenticator app.
          </p>
          <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.7, margin: '0 0 18px', maxWidth: 560 }}>
            Your sign-in on this device keeps working. You won&apos;t be logged out.
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
            An <strong>authenticator app</strong> on your phone generates a six-digit code that changes every 30 seconds. From then on, signing in to {PRODUCT} takes your password and that code. Anyone who gets your password still can&apos;t get in, because they don&apos;t have your phone.
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
              You may already have one. iPhone and Android both build it into the password manager, and 1Password, Bitwarden and LastPass all do it too.
            </p>
            <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.7, margin: 0 }}>
              If not, search your app store for <strong>Google Authenticator</strong>. It&apos;s free, installs in a minute, and works on every other site that offers this.
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

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
            Open your authenticator app, choose to add an account, and point your camera at this square. It&apos;ll start showing a six-digit code for {PRODUCT}.
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
              Type the six digits your app is showing for {PRODUCT}. They change every 30 seconds, so use whatever is on screen.
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
                    ? 'Signing in takes your password plus a six-digit code from your phone. Someone with your password still gets nowhere without it.'
                    : `Adds a second step when you sign in: after your password, ${PRODUCT} asks for a six-digit code that only your phone can produce. It means a stolen or guessed password is not enough on its own — which is how most business accounts are lost.`}
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
                        ? 'None left. If your phone is lost or replaced now, there is no way back into this account. Generate a new set and save them.'
                        : 'Your way in if your phone is lost, stolen or replaced. Entering one at sign-in turns two-factor off so your password works alone. Each code works once.'}
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
                    Generating a new set cancels the old one. Any codes you saved or printed before will stop working.
                  </p>
                )}
              </Card>
            </div>
          )}

          <div style={{ marginTop: 26 }}>
            <SectionLabel>How your data is held</SectionLabel>
            <Card>
              {/* Five separate ideas. As a bullet list they ran together into
                  one grey paragraph and you had to read all of it to find the
                  one you cared about. An icon and a heading per idea means you
                  can find the one you came for without reading the rest. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {DATA_FACTS.map((f) => (
                  <div key={f.title} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                    <span
                      aria-hidden
                      style={{
                        flexShrink: 0,
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: C.panelAlt,
                        border: `1px solid ${C.border}`,
                        color: C.dim,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 1,
                      }}
                    >
                      {f.icon}
                    </span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                        {f.title}
                      </div>
                      <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.75, margin: 0, maxWidth: 560 }}>
                        {f.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
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
