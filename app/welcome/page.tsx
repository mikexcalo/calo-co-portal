'use client';

/**
 * First-login setup.
 *
 * Configuration, not a tutorial — Learn already handles teaching. This asks
 * only what the app genuinely cannot work without, and asks it in the order
 * someone would naturally answer.
 *
 * WHAT THE AUDIT FOUND (backlog #23) AND WHAT CHANGED
 *
 * It welcomed people to CALO&CO. Nobody is here for CALO&CO; they are here
 * because somebody handed them their business. It says the business's name
 * now, with their mark above it, in the same shell as their own sign-in door,
 * and CALO&CO is the small line at the foot.
 *
 * It said "3 quick questions", and then, the moment you answered the third,
 * said "6 quick questions". The length is the one promise a setup flow makes.
 * So the first question is now the one that decides the length, no count is
 * shown until it is answered, and from then on the count can only move if the
 * person changes that answer themselves.
 *
 * It asked for a password whether or not you had one, and when somebody typed
 * the password they already use, GoTrue said "New password should be different
 * from the old password" and the screen said "Nothing was saved. We could not
 * tell why. Check your connection and try again." The step is skipped outright
 * for anybody who signed in with a password, and every refusal the sign-in
 * service gives now has words of its own (`BY_AUTH` in errors.ts).
 *
 * It pre-filled "where customers reply" with the address you sign in on. Those
 * are the same thing for roughly nobody, and it is printed on every invoice.
 * It is asked, plainly, and the sign-in address is one tap rather than the
 * answer.
 *
 * Its checkboxes were thirteen pixels across on a phone, and its two ways out
 * read alike: "I'll do this later" beside "Skip for now". One skips the
 * question in front of you, one ends setup, and they say which.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { getCurrentOrg, updateOrg } from '@/lib/spine/db';
import { METHODS, looksLikeAccountNumber, type PaymentMethod } from '@/lib/spine/payments';
import type { Org } from '@/lib/spine/types';
import { Skeleton } from '@/components/spine/ui';
import { PRODUCT } from '@/lib/brand';
import { human } from '@/lib/spine/errors';
import { save as saveOrFail } from '@/lib/spine/save';
import { clientFace } from '@/lib/spine/client-face';
import { Door, type DoorWorkspace, PROSE_WRAP, noWidow } from '@/components/public/Door';
import { studioFor } from '@/lib/spine/workin';

const INK = '#141414';
const BORDER = '#e4e4e0';
const TEXT = '#1a1a1a';
const DIM = '#363634';
const FAINT = '#55554f';
const ACCENT = '#141414';
const AMBER = '#b45309';
const RED = '#b91c1c';
/** The one selected-thing fill on these screens. Grey, not a blue. */
const PICKED = '#f4f5f6';

const field: React.CSSProperties = {
  width: '100%',
  background: '#fbfbfa',
  border: `1px solid ${BORDER}`,
  borderRadius: 7,
  padding: '11px 13px',
  fontSize: 15,
  color: TEXT,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const label: React.CSSProperties = { fontSize: 13.5, color: DIM, marginBottom: 6, fontWeight: 500 };
const optional = <span style={{ color: FAINT, fontWeight: 400 }}> · optional</span>;

/**
 * Forty-eight pixels, on a phone, for anything you have to hit.
 *
 * A native checkbox draws itself at thirteen pixels and no inline style moves
 * it, so the hit area is a box around it rather than the box itself, and the
 * row it sits in is at least as tall. The option buttons and the buttons at
 * the foot get the same floor. Written as a stylesheet because a media query
 * is the only way to say "on a phone" without measuring the window in
 * JavaScript and re-rendering on every resize.
 */
const TAPS = `
.wz-check { width: 26px; height: 26px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.wz-check input { width: 17px; height: 17px; margin: 0; accent-color: ${INK}; cursor: pointer; }
.wz-row { display: flex; align-items: center; gap: 9px; cursor: pointer; }
.wz-actions { display: flex; gap: 8px; align-items: center; margin-top: 22px; }
.wz-actions .wz-primary { flex: 1; }
@media (max-width: 560px) {
  .wz-check { width: 48px; height: 48px; }
  .wz-check input { width: 24px; height: 24px; }
  .wz-row { min-height: 48px; }
  .wz-opt { min-height: 48px; }
  .wz-btn { min-height: 48px; }
  /*
    Three controls do not fit across a phone.

    Back, Skip this question and Save and carry on shared one row, and at
    390px the browser did what it had to: it squeezed "Save and carry on"
    into a circle four words tall and turned Back into a disc. The one that
    matters gets the full width, on its own line, and the two quieter ones
    sit under it.
  */
  .wz-actions { flex-wrap: wrap; }
  .wz-actions .wz-primary { flex: 1 0 100%; order: -1; }
}
`;

/**
 * One glyph per method, on black.
 *
 * They were the brands' own colors: Venmo blue, PayPal navy, Zelle purple,
 * Cash green. Four saturated colors on the first screen of a product whose
 * rulebook allows two, none of them ours and none of them the workspace's.
 * The glyph is what makes the list scannable; the color was only decoration,
 * and it was somebody else's.
 */
const BADGE: Record<string, string> = {
  stripe: '⌗',
  venmo: 'V',
  paypal: 'P',
  zelle: 'Z',
  check: '✓',
  bank: '⌂',
  cash: '$',
};

const BILLING_STYLES = [
  { id: 'hourly',   label: 'By the hour',           hint: 'Time and materials. You log hours, and bill them.' },
  { id: 'fixed',    label: 'A fixed price per job', hint: 'You quote a number up front and bill that.' },
  { id: 'both',     label: 'Both, depending',       hint: 'Some jobs hourly, and some quoted flat.' },
  { id: 'retainer', label: 'A monthly retainer',    hint: 'Same amount each period, regardless of hours.' },
] as const;

/**
 * Which questions each role actually gets asked.
 *
 * One fixed run of five was the problem: it asked everybody about pricing,
 * payment handles and business details, whoever they were. Somebody on the
 * tools does not set rates. Somebody having a look does not own the business.
 * Being asked anyway is the clearest way a product tells you it was built for
 * a different person.
 *
 * Named steps rather than numbered ones, because the moment the path branches,
 * "step 3" stops meaning anything and the index becomes a bug waiting to
 * happen.
 *
 * `role` is first in every one of them. It was third, which is why the count
 * jumped: the flow could not know its own length until the question that
 * decides it had been answered, so it guessed, and then corrected itself in
 * front of the person.
 */
type StepKey = 'role' | 'name' | 'password' | 'business' | 'charge' | 'pay' | 'craft' | 'goal';

const PLANS: Record<string, StepKey[]> = {
  owner:    ['role', 'name', 'password', 'business', 'charge', 'pay'],
  admin:    ['role', 'name', 'password', 'business', 'charge', 'pay'],
  finance:  ['role', 'name', 'password', 'business', 'charge', 'pay'],
  // Does the work: never asked what to charge, asked what they actually do.
  delivery: ['role', 'name', 'password', 'craft'],
  // Having a look: asked the one thing worth knowing from a visitor.
  looking:  ['role', 'name', 'password', 'goal'],
};

/** Before the first answer, the only two things we know we will ask. */
const DEFAULT_PLAN: StepKey[] = ['role', 'name', 'password'];

/**
 * Who you are to this business.
 *
 * Every question after this one assumed the person answering owns the place:
 * "your business", "what you charge", "the work you log". A bookkeeper, a
 * creative director or somebody's wife having a look are all going to be sat
 * in front of this, and being asked to set an hourly rate when you do not bill
 * anybody is how a product tells you it was not built for you.
 *
 * The role is also the honest answer to what to show afterwards. Somebody who
 * does not touch money should not open on a screen about money.
 */
const ROLES: { id: string; label: string; blurb: string; skipsMoney?: boolean }[] = [
  { id: 'owner',    label: 'I own or run it',     blurb: 'The business is yours.' },
  { id: 'admin',    label: 'I keep it running',   blurb: 'Scheduling, invoices, chasing, and the day to day.' },
  { id: 'delivery', label: 'I do the work',       blurb: 'On the tools, or on the creative.', skipsMoney: true },
  { id: 'finance',  label: 'I handle the money',  blurb: 'Billing, receipts, and what the month made.' },
  { id: 'looking',  label: 'I am having a look',  blurb: 'Helping somebody out, or seeing whether this fits.', skipsMoney: true },
];

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

/**
 * Did this person sign in with a password?
 *
 * The obvious test is whether the account has one, and it is useless: every
 * account in this product does. `new_auth_user()` writes a bcrypt of a UUID
 * nobody will ever see, and the invite route's createUser writes one too, so
 * `encrypted_password is not null` is true of somebody who has never chosen a
 * password in their life.
 *
 * What we can know is how they got here. GoTrue stamps the session with the
 * method used to open it, in the access token's `amr` claim. `password` is
 * proof they have one and know it. `recovery`, `magiclink`, `invite` and `otp`
 * all mean they followed a link, which proves nothing either way, so those get
 * asked. Anything unreadable gets asked as well: one question too many is a
 * cost, and locking somebody out of their own account is not.
 */
function signedInWithPassword(accessToken: string | null | undefined): boolean {
  if (!accessToken) return false;
  try {
    const body = accessToken.split('.')[1];
    if (!body) return false;
    const json = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
    const amr = (JSON.parse(json) as { amr?: Array<{ method?: string }> }).amr;
    return Array.isArray(amr) && amr.some((a) => a?.method === 'password');
  } catch {
    return false;
  }
}

const UNNAMED = (name: string | undefined | null) => !name?.trim() || /^untitled/i.test(name.trim());

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feesOpen, setFeesOpen] = useState(false);

  const [fullName, setFullName] = useState('');
  const [pw, setPw] = useState('');
  const [pwSaved, setPwSaved] = useState(false);
  const [pwErr, setPwErr] = useState('');
  const [role, setRole] = useState<string>('');
  const [craft, setCraft] = useState('');
  const [goal, setGoal] = useState('');
  const [bizName, setBizName] = useState('');
  const [bizEmail, setBizEmail] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
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

  /**
   * Two facts settled before the first question and never revisited, because
   * both of them change the length of the run. Working either out later is how
   * a count moves under somebody.
   */
  const [askPassword, setAskPassword] = useState(true);
  const [orgDone, setOrgDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: auth }, { data: sess }, initial] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
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
          const membership = await saveOrFail(supabase
            .from('memberships')
            .select('org_id')
            .eq('user_id', auth.user.id)
            .limit(1)
            .maybeSingle());

          if (membership.data?.org_id) {
            /* Same silence, same fix: a refused heal must not look like a heal. */
            const healed = await saveOrFail(supabase
              .from('profiles')
              .upsert({ id: auth.user.id, active_org_id: membership.data.org_id }, { onConflict: 'id' }));
            if (healed.error) throw healed.error;
            o = await getCurrentOrg();
          }
        }

        let me: { full_name?: string | null; role?: string | null } | null = null;
        if (auth?.user) {
          const p = await supabase.from('profiles').select('full_name, role').eq('id', auth.user.id).maybeSingle();
          me = p.data ?? null;
        }

        /**
         * WHO IS FINISHED, AND WHO ONLY LOOKS IT.
         *
         * This used to leave the moment the business had an `onboarded_at`,
         * and that is the wrong subject. AppShell sends people here on the
         * person's own answers - have you told us your name and what you do -
         * so somebody invited into a business that was set up years ago
         * arrived, was bounced to Home, was sent straight back, and went round
         * until they closed the tab. The whole "joining" half of this file,
         * `alreadySetUp` and the plan filter and the copy, was unreachable
         * because of it.
         *
         * Being done is a fact about the person. Being set up is a fact about
         * the business, and it only decides which questions are worth asking.
         */
        if (me?.full_name?.trim() && me?.role) {
          router.replace('/');
          return;
        }

        let done = Boolean(o?.onboarded_at);

        /**
         * A business that already holds real work is not a new business — it
         * just predates this column. Never ask it to set itself up: the
         * answers overwrite what is already there, and the first field is the
         * business name, so a wrong answer renames someone else's company.
         * Stamp it, and ask this person only about themselves.
         */
        if (o && !done && (await alreadyInUse(o))) {
          await updateOrg(o.id, { onboarded_at: new Date().toISOString() } as Partial<Org>);
          done = true;
        }
        setOrgDone(done);

        setAskPassword(!signedInWithPassword(sess?.session?.access_token));

        if (auth?.user) {
          setFullName(me?.full_name ?? '');
          /*
            The sign-in address, kept for the one-tap answer and deliberately
            not written into the field. It used to be the field's value, which
            made the address a customer replies to on every invoice into
            whatever inbox the person happens to sign in from, silently,
            because a pre-filled field is an answer nobody gave.
          */
          setLoginEmail(auth.user.email ?? '');
        }
        if (o) {
          setOrg(o);
          setBizName(o.name);
          const s = (o.settings ?? {}) as Record<string, string>;
          setAddress(s.address ?? '');
          setPhone(s.phone ?? '');
          if (s.email) setBizEmail(s.email);
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
        setError(human((e as Error).message));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const finish = useCallback(
    async () => {
      setBusy(true);
      setError(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          throw new Error(
            'Your sign-in has expired, so nothing was saved. Reload the page, sign in again, and your answers will still be here.'
          );
        }
        if (fullName.trim() || role) {
          // The role is on the person, not the business: two people in one
          // workspace do different jobs and should not be told they do the same
          // one.
          const wrote = await saveOrFail(supabase.from('profiles').upsert(
            {
              id: auth.user.id,
              ...(fullName.trim() ? { full_name: fullName.trim() } : {}),
              ...(role ? { role } : {}),
              ...(craft.trim() ? { craft: craft.trim() } : {}),
              ...(goal.trim() ? { goal: goal.trim() } : {}),
            },
            { onConflict: 'id' }
          ));
          /*
            save() announces a refused write rather than throwing it, and what
            listens for that announcement is AppShell. This page is bare: there
            is no AppShell on it, so the announcement went into an empty room.

            It is the reason this flow looked as though it worked while saving
            nothing about the person. The business half wrote fine, the profile
            half was refused for want of an INSERT policy (fixed in
            20261029000027), and the shell then sent them back to question one
            because they still had no name. Every answer accepted, every time,
            and setup never finished.

            Raised here so it lands in the banner at the top of the card.
          */
          if (wrote.error) throw wrote.error;
        }
        if (!org) {
          // Everything typed would be thrown away. Say so rather than
          // pretending it worked.
          throw new Error(
            "We couldn't work out which business to save this to, so nothing has been saved. Refresh and try again, or get in touch and we'll sort it out."
          );
        }

        /*
          A business that was already set up is not written to at all.

          It was: the same updateOrg ran either way, so somebody joining an
          existing workspace would have pushed their own blank answers over
          its name, its rate and its payment handles on the way in. Nothing
          on those steps was even asked of them.
        */
        if (!orgDone) {
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

        /*
          A whole page load, not a client-side replace.

          The shell reads "has this person introduced themselves" once, when it
          mounts, and it mounted before any of this was answered. Handing it
          the route back with router.replace leaves it holding that first
          answer: it sees somebody with no name, sends them to /welcome, this
          page reads the profile properly and sends them to Home, and the two
          of them do that to each other until the tab is closed. Everything is
          saved by this point; the cost is one reload and the shell starts from
          what is actually in the database.
        */
        window.location.assign('/');
      } catch (e) {
        setError(human((e as Error).message));
        setBusy(false);
      }
    },
    [org, orgDone, fullName, role, craft, goal, bizName, bizEmail, address, phone, billingStyle, rate, markup, tax, chargesMarkup, chargesTax, methods, router]
  );

  if (loading) {
    /*
      Setting up is the first screen anybody sees, so it is the worst place
      for the product to say "Loading…" and nothing else. The card that is
      coming has a heading and a run of fields; this is that, at the size it
      will be.
    */
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f5' }}>
        <div style={{ width: 'min(520px, calc(100vw - 32px))' }} role="status" aria-label="Loading">
          <Skeleton w={210} h={24} style={{ marginBottom: 10, maxWidth: '100%' }} />
          <Skeleton w={280} h={12} style={{ marginBottom: 26, maxWidth: '100%' }} />
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <Skeleton w={92} h={10} style={{ marginBottom: 7 }} />
              <Skeleton w="100%" h={38} r={8} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const needsRate = billingStyle === 'hourly' || billingStyle === 'both';

  /**
   * The run of questions this person gets.
   *
   * Three things decide it, and two of them were settled before the first
   * screen drew: whether we have to ask for a password, and whether the
   * business is already set up. The third is the person's own answer to the
   * first question. So the number can only move when they move it, which is
   * the whole point of asking that one first.
   */
  const plan: StepKey[] = (() => {
    const base = role ? (PLANS[role] ?? DEFAULT_PLAN) : DEFAULT_PLAN;
    return base.filter((k) => {
      if (k === 'password') return askPassword;
      if (k === 'business' || k === 'charge' || k === 'pay') return !orgDone;
      return true;
    });
  })();

  const total = plan.length;
  const key: StepKey = plan[Math.min(step, total - 1)] ?? 'role';
  const last = step >= total - 1;
  /* Nothing about the length is claimed until the question that sets it is answered. */
  const lengthKnown = Boolean(role);

  /**
   * Skipping a question is allowed. Leaving is a different act.
   *
   * These were "I'll do this later" and "Skip for now", ten pixels apart, and
   * one of them ended setup. Somebody who did not know their hourly rate yet
   * had no way to tell which was which, and making them invent a number to
   * get past a screen is how a plausible wrong figure ends up on an invoice.
   * Both of these are asked again, in Settings, at the moment they matter.
   */
  const skipBtn = !last && (
    <button
      onClick={() => setStep((v) => v + 1)}
      disabled={busy}
      className="wz-btn"
      style={{
        padding: '11px 16px', borderRadius: 999, border: 'none',
        background: 'transparent', color: FAINT, fontSize: 14,
        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}
    >
      Skip this question
    </button>
  );

  const nextBtn = (disabled?: boolean) => (
    <button
      onClick={() => (last ? void finish() : setStep((s) => s + 1))}
      disabled={busy || disabled}
      className="wz-btn wz-primary"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: INK,
        color: '#fff',
        border: 'none',
        borderRadius: 999,
        padding: '12px',
        fontSize: 15,
        fontWeight: 500,
        cursor: busy || disabled ? 'not-allowed' : 'pointer',
        opacity: busy || disabled ? 0.45 : 1,
        fontFamily: 'inherit',
      }}
    >
      {busy ? 'Saving…' : last ? 'Finish setup' : 'Next'}
      {!busy && <span aria-hidden style={{ fontSize: 16 }}>→</span>}
    </button>
  );

  /**
   * Their business, above their setup, in the shell of their own sign-in door.
   *
   * A workspace still called "Untitled business" is not named yet, and
   * "Welcome to Untitled business" reads as a bug in the first screen somebody
   * sees, so that one falls back to ours.
   */
  /*
    Who set this workspace up, for the line under the card.

    Somebody on this screen is signed in - that is how they got here - so the
    same RPC the rest of the product uses works.
  */
  const [studioHouse, setStudioHouse] = useState<string | null>(null);
  useEffect(() => {
    if (!org?.id) return;
    let off = false;
    void studioFor(org.id).then((h) => { if (!off) setStudioHouse(h.studio?.name ?? null); });
    return () => { off = true; };
  }, [org?.id]);

  const named = org && !UNNAMED(org.name);
  const face = named ? clientFace(org as Parameters<typeof clientFace>[0]) : null;
  const workspace: DoorWorkspace | null = named && face
    ? { name: org!.name, logo: face.logo, initials: face.initials, studio: studioHouse }
    : null;

  const heading = named ? `Welcome to ${org!.name}` : `Welcome to ${PRODUCT}`;
  const subline = lengthKnown
    ? `${total} questions in all${orgDone ? ', and none of them about the business' : ''}.`
    : 'First, who you are here. Then we will tell you how many questions there are.';

  const bar = lengthKnown ? (
    <div style={{ display: 'flex', gap: 6, marginBottom: 22 }} aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? ACCENT : BORDER }} />
      ))}
    </div>
  ) : null;

  /**
   * Leaving, once there is enough to let somebody in.
   *
   * It cannot come earlier and mean anything: the shell sends people here
   * until it has a name and a role, so "finish later" pressed before both
   * would land on Home and be sent straight back, which is worse than not
   * offering it. It says where the rest is waiting, because an exit that does
   * not is just a way of losing your work.
   */
  const canLeave = Boolean(fullName.trim() && role);

  return (
    <>
      <style>{TAPS}</style>
      <Door
        workspace={workspace}
        heading={heading}
        subline={noWidow(subline)}
        maxWidth={540}
        top
        beforeCard={bar}
        footer={
          canLeave ? (
            <div>
              <button
                onClick={() => void finish()}
                disabled={busy}
                className="wz-btn"
                style={{
                  background: 'transparent', border: 'none', padding: '6px 4px',
                  color: DIM, fontSize: 13.5, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline',
                }}
              >
                Finish setup later
              </button>
              <div style={{ fontSize: 12.5, color: FAINT, marginTop: 4, ...PROSE_WRAP }}>
                {noWidow('What you have answered is kept. The rest waits on Today, and in Settings.')}
              </div>
            </div>
          ) : null
        }
      >
        {lengthKnown && (
          <div style={{ fontSize: 12, color: FAINT, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
            Question {Math.min(step + 1, total)} of {total}
          </div>
        )}

        {error && (
          <div style={{ background: '#fbeded', border: `1px solid ${RED}33`, borderRadius: 7, padding: '10px 12px', fontSize: 13.5, color: RED, margin: '14px 0 0', lineHeight: 1.6, ...PROSE_WRAP }}>
            {error}
          </div>
        )}

        {key === 'role' && (
          <>
            <h1 style={{ fontSize: 19, fontWeight: 600, color: TEXT, margin: '8px 0 6px' }}>
              What do you do here?
            </h1>
            <p style={{ fontSize: 14.5, color: DIM, margin: '0 0 18px', lineHeight: 1.6, ...PROSE_WRAP }}>
              {noWidow('It decides what the rest of this asks you, so it is the one we ask first.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ROLES.map((r) => {
                const on = role === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className="wz-opt"
                    style={{
                      textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${on ? TEXT : '#E7E8EB'}`,
                      background: on ? PICKED : 'transparent',
                      borderRadius: 10, padding: '11px 14px',
                    }}
                  >
                    <div style={{ fontSize: 15, color: TEXT, fontWeight: on ? 600 : 500 }}>{r.label}</div>
                    <div style={{ fontSize: 13, color: DIM, marginTop: 2 }}>{r.blurb}</div>
                  </button>
                );
              })}
            </div>
            <div className="wz-actions">{nextBtn(!role)}</div>
          </>
        )}

        {key === 'name' && (
          <>
            <h1 style={{ fontSize: 19, fontWeight: 600, color: TEXT, margin: '8px 0 6px' }}>
              What should we call you?
            </h1>
            <p style={{ fontSize: 14.5, color: DIM, margin: '0 0 18px', lineHeight: 1.6, ...PROSE_WRAP }}>
              {noWidow('It appears next to anything you record, so anybody reading it later knows who did what.')}
            </p>
            <label style={{ display: 'block' }}>
              <div style={label}>Full name</div>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={field}
                placeholder="Their name"
                autoComplete="name"
                autoFocus
              />
            </label>
            <div className="wz-actions">
              <BackBtn onClick={() => setStep((s) => s - 1)} />
              {nextBtn(!fullName.trim())}
            </div>
          </>
        )}

        {/*
          Only for somebody who followed a link.

          The invitation said "set your password", and until recently nothing
          ever asked for one. The link signs you in once and expires, so
          somebody who did not set one here had no way back in except another
          link. Anybody who signed in with a password does not see this at all,
          and never has to be told that the password they already use is the
          password they already use.
        */}
        {key === 'password' && (
          <>
            <h1 style={{ fontSize: 19, fontWeight: 600, color: TEXT, margin: '8px 0 6px' }}>
              Pick a password
            </h1>
            <p style={{ fontSize: 14.5, color: DIM, margin: '0 0 18px', lineHeight: 1.6, ...PROSE_WRAP }}>
              {noWidow('The link that brought you here works once. This is how you get back in.')}
            </p>
            <label style={{ display: 'block' }}>
              <div style={label}>Password</div>
              <input
                type="password"
                value={pw}
                onChange={(e) => { setPw(e.target.value); setPwErr(''); setPwSaved(false); }}
                style={field}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                autoFocus
              />
            </label>
            {pwErr && (
              <p style={{ fontSize: 13, color: '#E01B1B', margin: '10px 0 0', lineHeight: 1.6, ...PROSE_WRAP }}>{pwErr}</p>
            )}
            {pwSaved && <p style={{ fontSize: 13, color: '#008738', margin: '10px 0 0' }}>Saved.</p>}
            <div className="wz-actions">
              <BackBtn onClick={() => setStep((s) => s - 1)} />
              {skipBtn}
              <button
                onClick={async () => {
                  if (pw.length < 8) { setPwErr('Eight characters or more.'); return; }
                  const res = await supabase.auth.updateUser({ password: pw });
                  if (res.error) { setPwErr(human(res.error)); return; }
                  setPwSaved(true);
                  if (last) void finish(); else setStep((v) => v + 1);
                }}
                disabled={busy || pw.length < 8}
                className="wz-btn wz-primary"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: '11px 18px', borderRadius: 999, border: 'none',
                  background: pw.length < 8 ? '#9198A1' : INK, color: '#fff',
                  fontSize: 14.5, fontWeight: 500, cursor: pw.length < 8 ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Save and carry on
              </button>
            </div>
          </>
        )}

        {/*
          For somebody on the tools or on the creative.

          They will never set a rate, so the useful thing to know is what
          they actually do, which is what the vocabulary and the empty states
          key off later.
        */}
        {key === 'craft' && (
          <>
            <h1 style={{ fontSize: 19, fontWeight: 600, color: TEXT, margin: '8px 0 6px' }}>
              What do you actually do?
            </h1>
            <p style={{ fontSize: 14.5, color: DIM, margin: '0 0 18px', lineHeight: 1.6, ...PROSE_WRAP }}>
              {noWidow('In your own words. It decides what this calls things, and what it stops asking you.')}
            </p>
            <label style={{ display: 'block' }}>
              <div style={label}>Your work</div>
              <input
                value={craft}
                onChange={(e) => setCraft(e.target.value)}
                style={field}
                placeholder="Site carpentry. Or brand design, or plumbing."
                autoFocus
              />
            </label>
            <div className="wz-actions">
              <BackBtn onClick={() => setStep((s) => s - 1)} />
              {skipBtn}
              {nextBtn(false)}
            </div>
          </>
        )}

        {/*
          For somebody having a look.

          The one thing worth knowing from a visitor is what they came to find
          out, because it is also the thing that decides whether they come
          back. Asked once, at the only moment they will answer honestly.
        */}
        {key === 'goal' && (
          <>
            <h1 style={{ fontSize: 19, fontWeight: 600, color: TEXT, margin: '8px 0 6px' }}>
              What are you hoping to work out?
            </h1>
            <p style={{ fontSize: 14.5, color: DIM, margin: '0 0 18px', lineHeight: 1.6, ...PROSE_WRAP }}>
              {noWidow('One line. It tells us what to show you first, and whether we managed it.')}
            </p>
            <label style={{ display: 'block' }}>
              <div style={label}>What you are here for</div>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                style={field}
                placeholder="Whether this would actually save time on a small services business."
                autoFocus
              />
            </label>
            <div className="wz-actions">
              <BackBtn onClick={() => setStep((s) => s - 1)} />
              {skipBtn}
              {nextBtn(false)}
            </div>
          </>
        )}

        {key === 'business' && (
          <>
            <h1 style={{ fontSize: 19, fontWeight: 600, color: TEXT, margin: '8px 0 6px' }}>
              {role === 'owner'
                ? "What's the name of your brand or business?"
                : 'Which business is this?'}
            </h1>
            <p style={{ fontSize: 14.5, color: DIM, margin: '0 0 18px', lineHeight: 1.6, ...PROSE_WRAP }}>
              {noWidow('The name, the address, and the phone number appear on every proposal and invoice you send.')}
            </p>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <div style={label}>Business name</div>
              <input value={bizName} onChange={(e) => setBizName(e.target.value)} style={field} autoFocus />
            </label>

            {/*
              Asked, not assumed.

              This field's value was the address the person signs in on. For
              roughly nobody are those the same inbox, it is printed on every
              document their customers receive, and a pre-filled field is an
              answer nobody gave. The sign-in address is offered, once, as one
              tap.
            */}
            <div style={{ marginBottom: 14 }}>
              <div style={label}>Where should customer replies go?</div>
              <input
                type="email"
                value={bizEmail}
                onChange={(e) => setBizEmail(e.target.value)}
                style={field}
                placeholder="hello@yourbusiness.com"
                autoComplete="off"
              />
              <div style={{ fontSize: 12.5, color: FAINT, marginTop: 5, lineHeight: 1.6, ...PROSE_WRAP }}>
                {noWidow('It goes on proposals and invoices, so this is the inbox a customer answers into.')}
              </div>
              {loginEmail && bizEmail.trim().toLowerCase() !== loginEmail.toLowerCase() && (
                <button
                  onClick={() => setBizEmail(loginEmail)}
                  className="wz-btn"
                  style={{
                    marginTop: 8, padding: '8px 13px', borderRadius: 999,
                    border: `1px solid ${BORDER}`, background: '#fff', color: DIM,
                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  Use {loginEmail}
                </button>
              )}
            </div>

            <label style={{ display: 'block', marginBottom: 14 }}>
              <div style={label}>Phone{optional}</div>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} style={field} placeholder="714-271-4837" />
            </label>
            <label style={{ display: 'block' }}>
              <div style={label}>Business address{optional}</div>
              <input value={address} onChange={(e) => setAddress(e.target.value)} style={field} placeholder="Leave blank if you work remotely" />
            </label>
            <div className="wz-actions">
              <BackBtn onClick={() => setStep((s) => s - 1)} />
              {skipBtn}
              {nextBtn()}
            </div>
          </>
        )}

        {key === 'charge' && (
          <>
            <h1 style={{ fontSize: 19, fontWeight: 600, color: TEXT, margin: '8px 0 6px' }}>
              How do you charge?
            </h1>
            <p style={{ fontSize: 14.5, color: DIM, margin: '0 0 18px', lineHeight: 1.6, ...PROSE_WRAP }}>
              {noWidow('So the right fields show up when you build a proposal. You can change any of this per job.')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {BILLING_STYLES.map((b) => {
                const on = billingStyle === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setBillingStyle(b.id)}
                    className="wz-opt"
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      /* The same corner as the role list above it. These were
                         999, which on a phone turns a two-line option into a
                         lozenge with its text pinched at both ends. */
                      borderRadius: 10,
                      border: `1px solid ${on ? ACCENT : BORDER}`,
                      background: on ? PICKED : '#fff',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: on ? 600 : 500, color: TEXT }}>{b.label}</div>
                    <div style={{ fontSize: 13, color: FAINT, marginTop: 2 }}>{b.hint}</div>
                  </button>
                );
              })}
            </div>

            {needsRate && (
              <label style={{ display: 'block', marginBottom: 14 }}>
                <div style={label}>Your hourly rate</div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: FAINT, fontSize: 15, pointerEvents: 'none' }}>
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
                  <div style={{ fontSize: 12.5, color: AMBER, marginTop: 6, lineHeight: 1.55, ...PROSE_WRAP }}>
                    {noWidow('Leave this blank and hourly invoices come out at zero.')}
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
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: FAINT, fontSize: 15 }}>%</span>
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
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: FAINT, fontSize: 15 }}>%</span>
              </div>
            </Toggle>

            <div className="wz-actions">
              <BackBtn onClick={() => setStep((s) => s - 1)} />
              {skipBtn}
              {nextBtn(!billingStyle)}
            </div>
          </>
        )}

        {key === 'pay' && (
          <>
            <h1 style={{ fontSize: 19, fontWeight: 600, color: TEXT, margin: '8px 0 6px' }}>
              How do you want to get paid?
            </h1>
            <p style={{ fontSize: 14.5, color: DIM, margin: '0 0 6px', lineHeight: 1.6, ...PROSE_WRAP }}>
              {noWidow('Pick everything you accept. These appear on your invoices, so customers know where to send money.')}
            </p>

            {/* Fees behind a toggle. They matter, but a column of
                percentages next to every option buries the actual choice. */}
            <button
              onClick={() => setFeesOpen((v) => !v)}
              style={{ background: 'none', border: 'none', padding: 0, color: ACCENT, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16, textDecoration: 'underline' }}
            >
              {feesOpen ? 'Hide what each one costs' : 'What does each one cost me?'}
            </button>

            {feesOpen && (
              <div style={{ background: '#f7f7f5', borderRadius: 8, padding: 13, marginBottom: 16, fontSize: 13, color: DIM, lineHeight: 1.7 }}>
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
                const glyph = BADGE[m.id] ?? '·';
                const warn = m.handle ? looksLikeAccountNumber(m.handle) : false;
                return (
                  <div
                    key={m.id}
                    style={{
                      border: `1px solid ${m.enabled ? ACCENT : BORDER}`,
                      borderRadius: 8,
                      padding: '7px 13px',
                      background: m.enabled ? PICKED : '#fff',
                    }}
                  >
                    <label className="wz-row">
                      <span className="wz-check">
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={(e) => setMethods((p) => p.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))}
                        />
                      </span>
                      <span
                        aria-hidden
                        style={{
                          width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                          background: INK, color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 700,
                        }}
                      >
                        {glyph}
                      </span>
                      <span style={{ fontSize: 15, color: TEXT }}>{spec.label}</span>
                    </label>

                    {m.enabled && spec.handleLabel && (
                      <div style={{ marginTop: 6, marginBottom: 8 }}>
                        <div style={label}>{spec.handleLabel}</div>
                        <input
                          value={m.handle ?? ''}
                          onChange={(e) => setMethods((p) => p.map((x, j) => (j === i ? { ...x, handle: e.target.value } : x)))}
                          style={{ ...field, borderColor: warn ? RED : BORDER }}
                          placeholder={spec.placeholder}
                          autoFocus
                        />
                        {warn && (
                          <div style={{ fontSize: 12.5, color: RED, marginTop: 5, lineHeight: 1.5, ...PROSE_WRAP }}>
                            {noWidow("That looks like an account number. Don't put one here, because this text appears on invoices your customers can see.")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="wz-actions">
              <BackBtn onClick={() => setStep((s) => s - 1)} />
              {nextBtn()}
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${BORDER}`, fontSize: 12.5, color: FAINT, lineHeight: 1.7, ...PROSE_WRAP }}>
              <strong style={{ color: DIM }}>Your information stays yours.</strong> Everything
              is encrypted in transit and at rest, and each business&apos;s data is walled off
              at the database, so nobody else can read it. {PRODUCT} never stores card numbers
              or bank account numbers. Card payments go straight to Stripe, and the handles
              above are the public ones you already share to receive&nbsp;money.
            </div>
          </>
        )}
      </Door>
    </>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="wz-btn"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 999,
        padding: '11px 16px', fontSize: 15, color: DIM, cursor: 'pointer', fontFamily: 'inherit',
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
      <label className="wz-row" style={{ alignItems: 'flex-start' }}>
        <span className="wz-check" style={{ marginTop: 2 }}>
          <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
        </span>
        <span style={{ paddingTop: 4 }}>
          <span style={{ fontSize: 14.5, color: TEXT }}>{title}</span>
          <span style={{ display: 'block', fontSize: 12.5, color: FAINT, marginTop: 1 }}>{hint}</span>
        </span>
      </label>
      {on && <div style={{ marginTop: 9, marginLeft: 35 }}>{children}</div>}
    </div>
  );
}
