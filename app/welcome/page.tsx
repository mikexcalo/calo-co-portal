'use client';

/**
 * First-login setup.
 *
 * Configuration, not a tutorial — Learn already handles teaching. This asks
 * only what the app genuinely cannot work without, and asks it in the order
 * someone would naturally answer.
 *
 * The rewrite after first review fixed the things that made it feel like a
 * form rather than a welcome: headings that named the section instead of
 * asking the question, an hourly rate demanded of people who do not bill by
 * the hour, and a wall of fee percentages competing with the actual choice.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { getCurrentOrg, updateOrg } from '@/lib/spine/db';
import { METHODS, looksLikeAccountNumber, type PaymentMethod } from '@/lib/spine/payments';
import type { Org } from '@/lib/spine/types';
import { PRODUCT } from '@/lib/brand';

const INK = '#141414';
const BORDER = '#e4e4e0';
const TEXT = '#1a1a1a';
const DIM = '#363634';
const FAINT = '#55554f';
const ACCENT = '#006AFF';
const AMBER = '#b45309';
const RED = '#b91c1c';

const field: React.CSSProperties = {
  width: '100%',
  background: '#fbfbfa',
  border: `1px solid ${BORDER}`,
  borderRadius: 7,
  padding: '11px 13px',
  fontSize: 14,
  color: TEXT,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const label: React.CSSProperties = { fontSize: 12.5, color: DIM, marginBottom: 6, fontWeight: 500 };
const optional = <span style={{ color: FAINT, fontWeight: 400 }}> · optional</span>;

/**
 * Recognisable color and initial per method rather than the real brand
 * marks — those are trademarked artwork, and a coloured badge does the same
 * job of making the list scannable without borrowing anyone's logo.
 */
const BADGE: Record<string, { bg: string; fg: string; ch: string }> = {
  stripe:  { bg: '#635BFF', fg: '#fff', ch: '⌗' },
  venmo:   { bg: '#008CFF', fg: '#fff', ch: 'V' },
  paypal:  { bg: '#003087', fg: '#fff', ch: 'P' },
  zelle:   { bg: '#6D1ED4', fg: '#fff', ch: 'Z' },
  check:   { bg: '#E4E4E0', fg: '#444', ch: '✓' },
  bank:    { bg: '#1F2D48', fg: '#fff', ch: '⌂' },
  cash:    { bg: '#15803D', fg: '#fff', ch: '$' },
};

const BILLING_STYLES = [
  { id: 'hourly',   label: 'By the hour',        hint: 'Time and materials. You log hours and bill them.' },
  { id: 'fixed',    label: 'A fixed price per job', hint: 'You quote a number up front and bill that.' },
  { id: 'both',     label: 'Both, depending',    hint: 'Some jobs hourly, some quoted flat.' },
  { id: 'retainer', label: 'A monthly retainer', hint: 'Same amount each period, regardless of hours.' },
] as const;

const STEPS = 4;

/**
 * Does this business already hold real work? Cheap head-count queries — we
 * only need to know whether any row exists, never what it says.
 */
async function alreadyInUse(o: Org): Promise<boolean> {
  /**
   * Work, not decoration. An earlier version also treated a brand kit as
   * proof the account was in use, which was wrong: a business can be set up
   * for someone with their logo and colors already loaded and still have
   * never been touched by the person it belongs to. Mammoth was exactly that
   * — fully branded, zero customers — and the check would have skipped Mark
   * past his own setup.
   */
  const counts = await Promise.all(
    ['customers', 'jobs', 'estimates'].map((t) =>
      supabase.from(t).select('id', { count: 'exact', head: true }).eq('org_id', o.id)
    )
  );
  return counts.some((c) => (c.count ?? 0) > 0);
}

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feesOpen, setFeesOpen] = useState(false);

  const [fullName, setFullName] = useState('');
  const [bizName, setBizName] = useState('');
  const [bizEmail, setBizEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [billingStyle, setBillingStyle] = useState<string>('');
  const [rate, setRate] = useState('');
  const [markup, setMarkup] = useState('');
  const [tax, setTax] = useState('');
  const [chargesMarkup, setChargesMarkup] = useState(false);
  const [chargesTax, setChargesTax] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>(
    METHODS.map((m) => ({ id: m.id, enabled: false, handle: '' }))
  );

  useEffect(() => {
    (async () => {
      try {
        const [{ data: auth }, initial] = await Promise.all([
          supabase.auth.getUser(),
          getCurrentOrg(),
        ]);

        /**
         * Self-heal a missing profile.
         *
         * getCurrentOrg() reads active_org_id off the profile row. No profile
         * means no business — and the old code carried on regardless: the
         * whole setup flow ran, every question got an answer, and `finish()`
         * silently skipped every write because `org` was null. Somebody spends
         * four screens setting up their business and lands on an empty
         * dashboard with none of it saved and no error to explain why.
         *
         * The invite route does create a profile, so this should not happen —
         * but "should not happen" is not a reason to lose someone's setup when
         * it does.
         */
        let o = initial;
        if (!o && auth?.user) {
          const membership = await supabase
            .from('memberships')
            .select('org_id')
            .eq('user_id', auth.user.id)
            .limit(1)
            .maybeSingle();

          if (membership.data?.org_id) {
            await supabase
              .from('profiles')
              .upsert({ id: auth.user.id, active_org_id: membership.data.org_id }, { onConflict: 'id' });
            o = await getCurrentOrg();
          }
        }

        if (o?.onboarded_at) {
          router.replace('/');
          return;
        }

        /**
         * A business that already holds real work is not a new business — it
         * just predates this column. Never ask it to set itself up: the
         * answers overwrite what is already there, and the first field is the
         * business name, so a wrong answer renames someone else's company.
         * Stamp it as done and get out of the way.
         */
        if (o && (await alreadyInUse(o))) {
          await updateOrg(o.id, { onboarded_at: new Date().toISOString() } as Partial<Org>);
          router.replace('/');
          return;
        }

        if (auth?.user) {
          const p = await supabase.from('profiles').select('full_name').eq('id', auth.user.id).maybeSingle();
          setFullName(p.data?.full_name ?? '');
          setBizEmail(auth.user.email ?? '');
        }
        if (o) {
          setOrg(o);
          setBizName(o.name);
          const s = (o.settings ?? {}) as Record<string, string>;
          setAddress(s.address ?? '');
          setPhone(s.phone ?? '');
          if (Number(o.default_labor_rate)) setRate(String(o.default_labor_rate));
          if (Number(o.default_material_markup_pct)) {
            setMarkup(String(o.default_material_markup_pct));
            setChargesMarkup(true);
          }
          if (Number(o.tax_rate)) {
            setTax(String(o.tax_rate));
            setChargesTax(true);
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const finish = useCallback(
    async (skipped = false) => {
      setBusy(true);
      setError(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (auth?.user && fullName.trim()) {
          await supabase.from('profiles').upsert(
            { id: auth.user.id, full_name: fullName.trim() },
            { onConflict: 'id' }
          );
        }
        if (!org) {
          // Everything typed would be thrown away. Say so rather than
          // pretending it worked.
          throw new Error(
            "We couldn't work out which business to save this to, so nothing has been saved. Refresh and try again, or get in touch and we'll sort it out."
          );
        }

        {
          const settings = { ...((org.settings ?? {}) as Record<string, unknown>) };
          if (address.trim()) settings.address = address.trim();
          if (phone.trim()) settings.phone = phone.trim();
          if (bizEmail.trim()) settings.email = bizEmail.trim();

          await updateOrg(org.id, {
            name: bizName.trim() || org.name,
            settings,
            billing_style: billingStyle || null,
            default_labor_rate: parseFloat(rate) || 0,
            default_material_markup_pct: chargesMarkup ? parseFloat(markup) || 0 : 0,
            tax_rate: chargesTax ? parseFloat(tax) || 0 : 0,
            payment_methods: methods.filter((m) => m.enabled) as unknown as Record<string, unknown>[],
            onboarded_at: new Date().toISOString(),
          } as Partial<Org>);
        }
        router.replace('/');
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
    },
    [org, fullName, bizName, bizEmail, address, phone, billingStyle, rate, markup, tax, chargesMarkup, chargesTax, methods, router]
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f5', color: FAINT, fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  const needsRate = billingStyle === 'hourly' || billingStyle === 'both';
  const last = step === STEPS - 1;

  const nextBtn = (disabled?: boolean) => (
    <button
      onClick={() => (last ? finish() : setStep((s) => s + 1))}
      disabled={busy || disabled}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: INK,
        color: '#fff',
        border: 'none',
        borderRadius: 7,
        padding: '12px',
        fontSize: 14,
        fontWeight: 500,
        cursor: busy || disabled ? 'not-allowed' : 'pointer',
        opacity: busy || disabled ? 0.45 : 1,
        fontFamily: 'inherit',
      }}
    >
      {busy ? 'Saving…' : last ? 'Finish setup' : 'Next'}
      {!busy && <span aria-hidden style={{ fontSize: 15 }}>→</span>}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f5', padding: '36px 20px 60px' }}>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: INK, letterSpacing: '-0.3px' }}>
            Welcome to {PRODUCT}
          </div>
          <div style={{ fontSize: 13.5, color: FAINT, marginTop: 6 }}>
            Four quick questions and you&apos;re set up.
          </div>
          {/* Which business these answers land on. Without this, someone with
              access to more than one can fill the whole thing in for the
              wrong one and only find out from the sidebar afterwards. */}
          {org && (
            <div style={{ fontSize: 12, color: DIM, marginTop: 10 }}>
              Setting up{' '}
              <strong style={{ color: TEXT }}>{org.name}</strong>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? ACCENT : BORDER }} />
          ))}
        </div>

        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 26 }}>
          <div style={{ fontSize: 11, color: FAINT, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
            Step {step + 1} of {STEPS}
          </div>

          {error && (
            <div style={{ background: '#fbeded', border: `1px solid ${RED}33`, borderRadius: 7, padding: '10px 12px', fontSize: 12.5, color: RED, margin: '14px 0 0' }}>
              {error}
            </div>
          )}

          {step === 0 && (
            <>
              <h1 style={{ fontSize: 19, fontWeight: 600, color: TEXT, margin: '8px 0 6px' }}>
                What should we call you?
              </h1>
              <p style={{ fontSize: 13.5, color: DIM, margin: '0 0 18px', lineHeight: 1.6 }}>
                Your full name. It appears on the work you log, so a customer reading an invoice
                knows who did what.
              </p>
              <label style={{ display: 'block' }}>
                <div style={label}>Full name</div>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={field}
                  placeholder="Mark Mesedahl"
                  autoComplete="name"
                  autoFocus
                />
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>{nextBtn(!fullName.trim())}</div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 style={{ fontSize: 19, fontWeight: 600, color: TEXT, margin: '8px 0 6px' }}>
                What&apos;s the name of your brand or business?
              </h1>
              <p style={{ fontSize: 13.5, color: DIM, margin: '0 0 18px', lineHeight: 1.6 }}>
                This appears on every estimate and invoice you send.
              </p>
              <label style={{ display: 'block', marginBottom: 14 }}>
                <div style={label}>Business name</div>
                <input value={bizName} onChange={(e) => setBizName(e.target.value)} style={field} autoFocus />
              </label>
              <label style={{ display: 'block', marginBottom: 14 }}>
                <div style={label}>Business email</div>
                <input
                  type="email"
                  value={bizEmail}
                  onChange={(e) => setBizEmail(e.target.value)}
                  style={field}
                  placeholder="hello@yourbusiness.com"
                />
                <div style={{ fontSize: 11.5, color: FAINT, marginTop: 5 }}>
                  Where customers reply when they get an estimate or invoice.
                </div>
              </label>
              <label style={{ display: 'block', marginBottom: 14 }}>
                <div style={label}>Phone{optional}</div>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={field} placeholder="714-271-4837" />
              </label>
              <label style={{ display: 'block' }}>
                <div style={label}>Business address{optional}</div>
                <input value={address} onChange={(e) => setAddress(e.target.value)} style={field} placeholder="Leave blank if you work remotely" />
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
                <BackBtn onClick={() => setStep((s) => s - 1)} />
                {nextBtn()}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 style={{ fontSize: 19, fontWeight: 600, color: TEXT, margin: '8px 0 6px' }}>
                How do you charge?
              </h1>
              <p style={{ fontSize: 13.5, color: DIM, margin: '0 0 18px', lineHeight: 1.6 }}>
                So the right fields show up when you build an estimate. You can change any of
                this per job.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {BILLING_STYLES.map((b) => {
                  const on = billingStyle === b.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setBillingStyle(b.id)}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        borderRadius: 8,
                        border: `1px solid ${on ? ACCENT : BORDER}`,
                        background: on ? '#E8F1FF' : '#fff',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: on ? 600 : 500, color: TEXT }}>{b.label}</div>
                      <div style={{ fontSize: 12, color: FAINT, marginTop: 2 }}>{b.hint}</div>
                    </button>
                  );
                })}
              </div>

              {needsRate && (
                <label style={{ display: 'block', marginBottom: 14 }}>
                  <div style={label}>Your hourly rate</div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: FAINT, fontSize: 14, pointerEvents: 'none' }}>
                      $
                    </span>
                    <input
                      type="number"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      style={{ ...field, paddingLeft: 26 }}
                      placeholder="85"
                    />
                  </div>
                  {!parseFloat(rate) && (
                    <div style={{ fontSize: 11.5, color: AMBER, marginTop: 6, lineHeight: 1.55 }}>
                      Leave this blank and hourly invoices come out at zero.
                    </div>
                  )}
                </label>
              )}

              {/* Off by default. Plenty of businesses mark up nothing and
                  charge no sales tax, and asking them to type 0 twice is a
                  small insult. */}
              <Toggle
                on={chargesMarkup}
                onChange={setChargesMarkup}
                title="I mark up materials"
                hint="A percentage added when you bill a receipt on to a customer."
              >
                <div style={{ position: 'relative', maxWidth: 160 }}>
                  <input
                    type="number"
                    value={markup}
                    onChange={(e) => setMarkup(e.target.value)}
                    style={{ ...field, paddingRight: 28 }}
                    placeholder="15"
                  />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: FAINT, fontSize: 14 }}>%</span>
                </div>
              </Toggle>

              <Toggle
                on={chargesTax}
                onChange={setChargesTax}
                title="I charge sales tax"
                hint="Added to invoice totals."
              >
                <div style={{ position: 'relative', maxWidth: 160 }}>
                  <input
                    type="number"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    style={{ ...field, paddingRight: 28 }}
                    placeholder="8.25"
                  />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: FAINT, fontSize: 14 }}>%</span>
                </div>
              </Toggle>

              <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
                <BackBtn onClick={() => setStep((s) => s - 1)} />
                {nextBtn(!billingStyle)}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 style={{ fontSize: 19, fontWeight: 600, color: TEXT, margin: '8px 0 6px' }}>
                How do you want to get paid?
              </h1>
              <p style={{ fontSize: 13.5, color: DIM, margin: '0 0 6px', lineHeight: 1.6 }}>
                Pick everything you accept. These appear on your invoices so customers know
                where to send money.
              </p>

              {/* Fees behind a toggle. They matter, but a column of
                  percentages next to every option buries the actual choice. */}
              <button
                onClick={() => setFeesOpen((v) => !v)}
                style={{ background: 'none', border: 'none', padding: 0, color: ACCENT, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}
              >
                {feesOpen ? 'Hide what each one costs' : 'What does each one cost me?'}
              </button>

              {feesOpen && (
                <div style={{ background: '#f7f7f5', borderRadius: 8, padding: 13, marginBottom: 16, fontSize: 12, color: DIM, lineHeight: 1.7 }}>
                  {METHODS.map((m) => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span>{m.label}</span>
                      <span style={{ color: FAINT, textAlign: 'right' }}>{m.costLabel}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {methods.map((m, i) => {
                  const spec = METHODS.find((x) => x.id === m.id)!;
                  const badge = BADGE[m.id];
                  const warn = m.handle ? looksLikeAccountNumber(m.handle) : false;
                  return (
                    <div
                      key={m.id}
                      style={{
                        border: `1px solid ${m.enabled ? ACCENT : BORDER}`,
                        borderRadius: 8,
                        padding: '11px 13px',
                        background: m.enabled ? '#fbfcff' : '#fff',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={(e) => setMethods((p) => p.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))}
                        />
                        <span
                          aria-hidden
                          style={{
                            width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                            background: badge.bg, color: badge.fg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700,
                          }}
                        >
                          {badge.ch}
                        </span>
                        <span style={{ fontSize: 14, color: TEXT }}>{spec.label}</span>
                      </label>

                      {m.enabled && spec.handleLabel && (
                        <div style={{ marginTop: 10, marginLeft: 37 }}>
                          <div style={label}>{spec.handleLabel}</div>
                          <input
                            value={m.handle ?? ''}
                            onChange={(e) => setMethods((p) => p.map((x, j) => (j === i ? { ...x, handle: e.target.value } : x)))}
                            style={{ ...field, borderColor: warn ? RED : BORDER }}
                            placeholder={spec.placeholder}
                            autoFocus
                          />
                          {warn && (
                            <div style={{ fontSize: 11.5, color: RED, marginTop: 5, lineHeight: 1.5 }}>
                              That looks like an account number. Don&apos;t put one here, because this
                              text appears on invoices your customers can see.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
                <BackBtn onClick={() => setStep((s) => s - 1)} />
                {nextBtn()}
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${BORDER}`, fontSize: 11.5, color: FAINT, lineHeight: 1.7 }}>
                <strong style={{ color: DIM }}>Your information stays yours.</strong> Everything
                is encrypted in transit and at rest, and each business&apos;s data is walled off
                at the database so nobody else can read it. {PRODUCT} never stores card numbers
                or bank account numbers. Card payments go straight to Stripe, and the handles
                above are the public ones you already share to receive money.
              </div>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => finish(true)}
            disabled={busy}
            style={{ background: 'transparent', border: 'none', color: FAINT, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Skip for now. Anything missing will be waiting on the Today screen
          </button>
        </div>
      </div>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 7,
        padding: '11px 16px', fontSize: 14, color: DIM, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <span aria-hidden>←</span> Back
    </button>
  );
}

/** A yes/no that reveals its field only when the answer is yes. */
function Toggle({
  on, onChange, title, hint, children,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          <span style={{ fontSize: 13.5, color: TEXT }}>{title}</span>
          <span style={{ display: 'block', fontSize: 11.5, color: FAINT, marginTop: 1 }}>{hint}</span>
        </span>
      </label>
      {on && <div style={{ marginTop: 9, marginLeft: 26 }}>{children}</div>}
    </div>
  );
}
