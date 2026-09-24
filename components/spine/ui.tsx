'use client';

/**
 * Nautilus spine — UI primitives.
 *
 * Everything the new modules need, in one file. No animation library, no
 * token indirection, no shared-component web. If a primitive isn't used by
 * at least two screens, it doesn't belong here.
 */

import { readableOn } from '@/lib/spine/brandkit';
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { C, DISPLAY, SERIF, radius } from '@/lib/spine/tokens';
import { Glyph, type IconName } from './icons';
import { useOrg } from '@/lib/spine/org';
import { pathAllowed } from '@/lib/spine/modules';

export { C, DISPLAY, SERIF, radius };

/**
 * Breakpoint hook. Used to collapse layouts rather than to hide things —
 * a contractor in a driveway needs the same capabilities as at a desk.
 */
export function useIsPhone(): boolean {
  const [phone, setPhone] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return phone;
}

/**
 * The modifier key this person actually has.
 *
 * Every shortcut hint in the product was written as a command glyph, and the
 * handlers behind them have always accepted metaKey OR ctrlKey — so the
 * shortcuts worked everywhere and the labels only told the truth on a Mac.
 * Anybody on Windows read a symbol that is not on their keyboard and
 * concluded the feature was not for them.
 *
 * Starts as Ctrl and corrects on mount, rather than the other way round: it
 * has to be decided in the browser, and guessing Mac would mean the larger
 * group is the one that sees the wrong thing flash.
 */
export function useModKey(): string {
  const [mod, setMod] = React.useState('Ctrl');
  React.useEffect(() => {
    const mac = /mac|iphone|ipad|ipod/i.test(
      navigator.platform || navigator.userAgent || ''
    );
    if (mac) setMod('\u2318');
  }, []);
  return mod;
}

export interface PageTab {
  label: string;
  href: string;
  /** Recognized rather than read. A four-tab strip of words is a paragraph. */
  icon: IconName;
}

export function Page({
  title,
  subtitle,
  action,
  tabs,
  back,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /**
   * Where this page came from.
   *
   * Detail screens had no way back to their list. The browser button works,
   * but only if you arrived by clicking — anybody who opened a link, or hit
   * refresh, was stranded on a record with no route to the thing it belongs
   * to except the sidebar, which is a different mental operation.
   *
   * Sits above the title rather than beside it, so it reads as a location
   * rather than as another action competing with the buttons.
   */
  back?: { label: string; href: string };
  /** Sibling screens within one section. Rendered under the header, never
      beside it — the previous attempt let them collide with the buttons. */
  tabs?: readonly PageTab[];
  children: React.ReactNode;
}) {
  const phone = useIsPhone();
  return (
    <div
      style={{
        padding: phone ? '18px 16px 90px' : '28px 32px',
        maxWidth: 1100,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: phone ? 'stretch' : 'flex-start',
          flexDirection: phone ? 'column' : 'row',
          justifyContent: 'space-between',
          gap: phone ? 12 : 16,
          marginBottom: phone ? 18 : 24,
        }}
      >
        <div>
          {back && <BackLink {...back} />}
          {/* Figtree. Every heading in the product runs through here or
              through SectionLabel, so the face is set in two places. */}
          <h1 style={{ ...DISPLAY, fontSize: phone ? 20 : 23, margin: 0, color: C.text }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 14, color: C.faint, margin: '6px 0 0', maxWidth: 640 }}>
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{action}</div>
        )}
      </div>

      {tabs && tabs.length > 1 && <PageTabs tabs={tabs} phone={phone} />}

      {children}
    </div>
  );
}

/**
 * Only the tabs this business can actually open.
 *
 * Digital listed Site requests to everybody, and an agency does not have that
 * module — so clicking it was bounced home by pathAllowed and looked like a
 * dead link. The sidebar has always filtered; the tab strips never did.
 */
function PageTabs({ tabs }: { tabs: readonly PageTab[]; phone: boolean }) {
  const { org } = useOrg();
  const allowed = tabs.filter((t) => pathAllowed(org, t.href));
  if (allowed.length < 2) return null;

  /*
    This was a second copy of the same strip.

    It predated Tabs and was the better of the two — it is where the exact-match
    rule was learned — so Tabs took that rule and this now renders through it.
    One strip in the product, and the filtering that belongs to a page-level
    strip stays here where it belongs: Digital listed Site requests to
    everybody, and an agency does not have that module, so clicking it was
    bounced home by pathAllowed and looked like a dead link.
  */
  return <Tabs items={allowed} style={{ marginBottom: 24 }} />;
}

/** The Library's three screens. One place so nav and tabs cannot drift. */
/**
 * Library is the things you look up while working: what you charge, and the
 * paperwork you have to be able to produce. Brand Kit moved out to Grow — a
 * logo and a QR code for a yard sign are not reference material, they are what
 * you reach for when you are trying to get hired.
 */
/**
 * Things you fill in once and then leave alone.
 *
 * A price list is not somewhere you go. You write it, and from then on it
 * feeds estimates. Same for records and for what you charge. Each of these had
 * a sidebar row, which put "the VAT number I typed in March" at the same level
 * as "who owes me money".
 *
 * The test that sorts them: do you open this to find something out, or did you
 * open it once so that something else would work? The second kind belongs
 * behind a tab.
 */
export const SETUP_TABS: readonly PageTab[] = [
  { label: 'Settings', href: '/business', icon: 'business' },
  // Yours, the same way Access is theirs.
  { label: 'What You See', href: '/what-you-see', icon: 'layers' },
  // Was reachable only by typing the URL, which made inviting anybody a thing
  // you had to be told how to do.
  { label: 'Team', href: '/team', icon: 'people' },
  { label: 'Security', href: '/security', icon: 'activity' },
];

/**
 * Everything about being found online, as one thing.
 *
 * Was PRESENCE_TABS under a row called "Being found", which named one of the
 * four things behind it. Somebody looking for their visitor numbers does not
 * think "being found", they think analytics, or website, or digital, so the
 * search checklist was discoverable and the traffic screen was not.
 *
 * Overview first, because the row now leads somewhere that says what state all
 * four are in. It used to open straight into the search checklist, which is
 * one tab of four and the most tedious, so the module read as a chore.
 */
/**
 * The client module, as three views of one subject.
 *
 * Clients are the companies, People are the humans in them, and Access is who
 * is on what. Access was a tab on a single client's record, which could only
 * ever show one row of an answer that is a grid.
 */
export const CLIENT_TABS: readonly PageTab[] = [
  { label: 'Clients', href: '/customers', icon: 'business' },
  { label: 'Access', href: '/access', icon: 'layers' },
];

/**
 * Access is ours, not theirs.
 *
 * Access hands somebody a login to this platform. On the agency side that is
 * the point — it is how a client of ours gets in to see their own work. Sitting
 * on Mark's Customers screen it offered him something entirely different: a way
 * to give a homeowner a seat in Nautilus.
 *
 * What his customers should ever see is a specific and much shorter list —
 * an invoice, an estimate, the things that need them to do something — and
 * none of that is a login to the whole platform. So it is not a tab a
 * contractor has, and typing the URL does not get you there either.
 */
export function clientTabs(kind: string | null | undefined): readonly PageTab[] {
  return kind === 'agency' ? CLIENT_TABS : [CLIENT_TABS[0]];
}

export const DIGITAL_TABS: readonly PageTab[] = [
  { label: 'Overview', href: '/digital', icon: 'globe' },
  { label: 'Site Requests', href: '/site-requests', icon: 'brief' },
  { label: 'Search', href: '/seo', icon: 'search' },
  { label: 'Traffic', href: '/traffic', icon: 'chart' },
  { label: 'Reviews', href: '/reviews', icon: 'star' },
];


/**
 * The money picture, as one thing.
 *
 * Profit and loss is the answer; overheads and receipts are two of its inputs.
 * They were three sidebar rows, which put "the receipt I photographed on
 * Tuesday" at the same level as "did this month make money".
 */
/**
 * Empty on purpose, and kept so the import sites do not all have to change.
 *
 * Overheads, Receipts and Price list were tabs of Profit & Loss, which made
 * three ordinary tasks reachable only by opening a fourth screen and noticing
 * a strip. None of them is a view of Profit & Loss; they are different jobs
 * that happen to be money-shaped. They have rows now.
 */
export const MONEY_TABS: readonly PageTab[] = [
  { label: 'Profit & Loss', href: '/pl', icon: 'chart' },
];

/*
  Invoices, both directions.

  Bills to You was its own row directly under Invoices, and both are a list of
  invoices — one you raised, one raised at you. Two invoice-shaped rows eight
  pixels apart means working out which is which every time you look.
*/
export const INVOICE_TABS: readonly PageTab[] = [
  { label: 'Owed to You', href: '/billing', icon: 'receipt' },
  { label: 'You Owe', href: '/account', icon: 'card' },
];

/**
 * Everything about how a brand looks, says and proves itself.
 *
 * Four rows for four views of one job. The framework decides what it says, the
 * kit holds what it looks like, case studies are what it can prove, and the
 * website is where all three land.
 */
/**
 * Brand is your brand. Nothing here belongs to a client.
 *
 * It used to hold four things and two of them were somebody else's. The
 * framework is a method applied to a client, so it belongs on that client's
 * record next to their kit, not in a grid of everybody at once. Case studies
 * are proof of work you send to win more work, which is a sales object; they
 * sit with Pitches now, which is what they get pasted into.
 *
 * What is left is the two things that actually are yours: your kit, and your
 * site.
 */
/**
 * Client brands is an agency's row.
 *
 * It sat on every brand screen, so Mammoth — a contractor with no clients of
 * its own inside Nautilus — was offered a tab to manage identities it does not
 * hold, leading to a list built from CALO&CO's book of work. Pass the org kind
 * and it appears only where there is something behind it.
 */
export function brandTabsFor(kind: string | null | undefined): readonly PageTab[] {
  return BRAND_TABS.filter((t) => t.href !== '/brands' || kind === 'agency');
}

/*
  Brand is one row again.

  It held four tabs: Brand, Client Brands, Messaging and Card. Card is a
  growth tool and went to Pitches with the email signature. Messaging is not
  a sibling of the brand, it is part of it, so it became a tab inside the
  brand itself next to Colors and Logos. Client Brands was a list you reached
  past your own brand to get to somebody else's — a client's brand belongs on
  the client, and there is a tile for it on their record now.

  What is left does not need a strip over it.
*/
export const BRAND_TABS: readonly PageTab[] = [
  { label: 'Brand', href: '/brand-kit', icon: 'palette' },
];


/**
 * A pitch and the proof that goes in it.
 *
 * Case studies were filed under Brand, beside the logo files, which said they
 * were about identity. They are about evidence, and the only reason to keep
 * them is to reuse them, which happens at the moment you write a pitch.
 */
/*
  Growth, with the things you send in it.

  A business card and an email signature are not brand assets you file, they
  are how you get introduced — the same job as a pitch and a case study. They
  were tabs of Brand, two clicks from the funnel that uses them.
*/
export const PITCH_TABS: readonly PageTab[] = [
  { label: 'Pitches', href: '/pitches', icon: 'send' },
  { label: 'Case Studies', href: '/stories', icon: 'book' },
  { label: 'Card', href: '/card', icon: 'card' },
  { label: 'Email Signature', href: '/signature', icon: 'mail' },
];

/**
 * One funnel, not two rows.
 *
 * A target is a company you want. A pitch is what you send it. They were
 * separate rows describing consecutive steps of the same motion, which is how
 * somebody ends up with a pipeline nobody pitched and pitches with no pipeline
 * behind them.
 */
/**
 * A brand's two screens, built from its id.
 *
 * The only tab strip that cannot be a constant, and so the only one that was
 * written out twice, on the two pages it appears on. Written twice is how the
 * labels drifted apart everywhere else.
 */
export function brandTabs(id: string): readonly PageTab[] {
  return [
    { label: 'Framework', href: `/brands/${id}/messaging`, icon: 'layers' },
    // Was "Intel", which reads as a spy word and told you nothing about the
    // screen. It holds what the client gave us and what was read out of it.
    { label: 'Source Material', href: `/brands/${id}/intel`, icon: 'documents' },
  ];
}


function BackLink({ label, href }: { label: string; href: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        background: 'transparent',
        border: 'none',
        padding: 0,
        marginBottom: 7,
        color: C.faint,
        fontSize: 13.5,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>←</span>
      {label}
    </button>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A section heading with its action beside it.
 *
 * Every one of these was hand-built as a flex row holding a SectionLabel and a
 * Button, and SectionLabel carries its own marginBottom. Inside a flex line
 * that margin applies WITHIN the row rather than under it — so the label was
 * nudged up off the button's centre line, and the row itself had no gap
 * underneath at all. The result is what Mike saw: Log hours, Add cost and New
 * estimate sitting directly on top of the table beneath them, on every
 * section, on every job.
 *
 * One component, so the gap belongs to the header instead of to the label, and
 * there is nowhere left to get it wrong.
 */
export function SectionHead({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 12,
      }}
    >
      {/* The label's own margin is cancelled; this row owns the spacing. */}
      <div style={{ marginBottom: -10 }}>
        <SectionLabel>{children}</SectionLabel>
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: C.faint,
        fontWeight: 600,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const styles: Record<string, React.CSSProperties> = {
    // The brand blue itself on a filled button, where white text clears the
    // contrast floor against it. C.blue is the darkened variant and belongs to
    // text, not to fills.
    primary: { background: C.accent, color: '#fff', border: `1px solid ${C.accent}` },
    ghost: { background: 'transparent', color: C.dim, border: `1px solid ${C.border}` },
    danger: { background: 'transparent', color: C.red, border: `1px solid ${C.red}44` },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      /*
        Buttons that behave like buttons.

        The only interaction in the product was `transition: opacity .15s`,
        which does nothing unless something changes the opacity, and nothing
        did. So every button on every screen sat completely inert: no hover, no
        press, no sign it had registered the click. A control that does not
        move under the pointer reads as a label somebody drew.

        Hover and press cannot be done in an inline style, which is why they
        were never there. The class carries them; the inline styles stay for
        the colours, which vary by variant.
      */
      className={`btn btn-${variant}`}
      style={{
        ...styles[variant],
        /**
         * A pill, and a thin one.
         *
         * Rounded rectangles read as software chrome; a fully rounded end reads
         * as something to press, which is the whole job. Thin because a button
         * at nine pixels of vertical padding with a full radius stops looking
         * like a pill and starts looking like a lozenge, and because these sit
         * beside 13.5px text everywhere and were quietly the heaviest thing on
         * most screens.
         */
        padding: '6px 15px',
        borderRadius: 999,
        fontSize: 13.5,
        fontWeight: 500,
        lineHeight: 1.45,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

const PILL_TONE = {
  neutral: { bg: C.panelAlt, fg: C.dim },
  /**
   * Informational, and no longer blue.
   *
   * This pill said "3 open engagements" in the brand's blue, which put the
   * same visual weight on a neutral count as on money being overdue. It is
   * grey now, which is what it always meant.
   */
  blue: { bg: C.panelAlt, fg: C.dim },
  green: { bg: C.greenSoft, fg: C.green },
  amber: { bg: C.amberSoft, fg: C.amber },
  red: { bg: C.redSoft, fg: C.red },
} as const;

export type PillTone = keyof typeof PILL_TONE;

/**
 * A completed / not-completed marker.
 *
 * Shared because it appeared three times, drawn three different ways: a solid
 * filled circle here, a bordered circle there, a green disc on the trust page.
 * Solid fills are the loudest thing this interface does and a checklist is not
 * the loudest thing on its screen — the rest of the app states status with a
 * soft background and coloured text, and this now does the same.
 */
export function Check({ done, size = 20 }: { done: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius.md,
        background: done ? C.greenSoft : 'transparent',
        border: `1px solid ${done ? `${C.green}55` : C.border}`,
        color: C.green,
        fontSize: Math.round(size * 0.55),
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
      }}
    >
      {done ? '✓' : ''}
    </span>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: PillTone }) {
  const t = PILL_TONE[tone];
  return (
    <span
      style={{
        background: t.bg,
        color: t.fg,
        fontSize: 11.5,
        fontWeight: 600,
        padding: '3px 9px',
        borderRadius: 20,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/**
 * A number, or nothing at all.
 *
 * A metric earns its place by changing. One pinned at zero is furniture: read
 * every time somebody opens the screen, answering nothing, and crowding out
 * the numbers that do move. Five cards reading $0 across the top of a page is
 * the single most repeated mistake in this product.
 *
 * `zero` opts a card out when its value is nothing, so the row grows as the
 * business does instead of standing at full width from day one.
 */
/**
 * A switch. On or off, and it looks like the thing it is.
 *
 * Access was a grid of identical grey dots that cycled through five states on
 * click. Nothing about a dot says it is pressable, nothing says which way it is
 * pointing, and fourteen columns of them scrolled off the side of the screen.
 * You cannot read a switchboard you have to hover to understand.
 */
export function Switch({
  on,
  onChange,
  disabled,
  tone = 'green',
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  tone?: 'green' | 'amber';
}) {
  const active = tone === 'amber' ? C.amber : C.green;
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        width: 38,
        height: 22,
        flexShrink: 0,
        borderRadius: 999,
        border: `1px solid ${on ? active : C.borderStrong}`,
        background: on ? active : C.panelAlt,
        position: 'relative',
        cursor: disabled ? 'default' : 'pointer',
        padding: 0,
        opacity: disabled ? 0.4 : 1,
        transition: 'background .15s, border-color .15s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,.25)',
          transition: 'left .15s',
        }}
      />
    </button>
  );
}

/**
 * A row of numbers, not a wall of cards.
 *
 * Metric draws a bordered card with 16px of padding and a 25px figure. Five of
 * those across the top of a screen is a dashboard. Two of them, reading 3 and
 * 0, is a third of the visible page spent on eight characters — which is what
 * Home looked like once the zeroes started hiding and only a couple were left.
 *
 * Cards are right when the numbers are the point of the screen, as on Profit
 * and Loss. On a screen whose point is a list of things to do, the numbers are
 * context, and context is a line.
 *
 * Same rule as Metric: a figure pinned at zero is furniture, so it is dropped
 * rather than drawn.
 */
export function Figures({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: 'green' | 'amber' | 'red'; hideAtZero?: boolean }>;
}) {
  const shown = items.filter(
    (i) => !(i.hideAtZero && /^(\$?0(\.00)?|0|—|–|-)$/.test(i.value.trim()))
  );
  if (shown.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: '10px 26px',
        padding: '12px 2px 14px',
        marginBottom: 20,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {shown.map((i) => (
        <span key={i.label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: C.faint, fontWeight: 600 }}>
            {i.label}
          </span>
          <span
            style={{
              ...DISPLAY,
              fontSize: 19,
              color:
                i.tone === 'green' ? C.green
                : i.tone === 'amber' ? C.amber
                : i.tone === 'red' ? C.red
                : C.text,
            }}
          >
            {i.value}
          </span>
        </span>
      ))}
    </div>
  );
}

export function Metric({
  label,
  value,
  tone,
  hint,
  hideAtZero,
}: {
  label: string;
  value: string;
  tone?: 'green' | 'amber' | 'red' | 'blue';
  hint?: string;
  /** Drop the card entirely when the value reads as nothing. */
  hideAtZero?: boolean;
}) {
  if (hideAtZero && /^(\$?0(\.00)?|0|, |-)$/.test(value.trim())) return null;
  const color =
    tone === 'green' ? C.green
    : tone === 'amber' ? C.amber
    : tone === 'red' ? C.red
    : tone === 'blue' ? C.blue
    : C.text;
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.faint, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ ...DISPLAY, fontSize: 25, color, marginTop: 8 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>{hint}</div>}
    </Card>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 6, fontWeight: 500 }}>{label}</div>
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.panelAlt,
  border: `1px solid ${C.border}`,
  borderRadius: 7,
  padding: '9px 11px',
  color: C.text,
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

/* ===========================================================================
   TABS, SHEET, SELECT — the three that were missing.

   This file exported tab DATA (CLIENT_TABS, MONEY_TABS, BRAND_TABS and the
   rest) and no component to render any of it, so 53 files hand-wrote the pill
   strip: each with its own padding, its own radius, its own idea of what an
   active tab looks like. There was no dialog either, so every overlay in the
   product was built from scratch with its own backdrop, its own width and its
   own escape handling — some of which had escape and some of which did not.
   And 29 files dropped a raw browser <select> into the middle of otherwise
   custom controls.

   Three components. They are the difference between a design system and a
   folder of screens that resemble each other.
   =========================================================================== */

export interface TabItem {
  /** For state tabs. Omit when the tab navigates. */
  id?: string;
  label: string;
  icon?: IconName;
  /** For navigating tabs. Omit when the tab switches state. */
  href?: string;
  /** Shown after the label when there is something in there. */
  count?: number;
}

/**
 * One strip, for both kinds of tab.
 *
 * Some tabs go somewhere (Clients, Access) and some change what is under them
 * (Brief, Work, Documents). They looked slightly different from each other on
 * every screen for no reason anybody chose. Pass href and it navigates; pass
 * id and onChange and it switches.
 */
export function Tabs({
  items,
  active,
  onChange,
  style,
}: {
  items: readonly TabItem[];
  /** The active id, for state tabs. Navigating tabs read the path instead. */
  active?: string;
  onChange?: (id: string) => void;
  style?: React.CSSProperties;
}) {
  const pathname = usePathname();
  const router = useRouter();
  if (!items.length) return null;

  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        gap: 3,
        padding: 3,
        borderRadius: radius.pill,
        background: C.panelAlt,
        border: `1px solid ${C.border}`,
        maxWidth: '100%',
        overflowX: 'auto',
        ...style,
      }}
    >
      {items.map((t) => {
        /*
          Exact match, not prefix.

          Prefix matching is what lit every Library tab at once, because
          /pricing, /records and /brand-kit all sit under it, and it lights a
          parent tab on every child route besides. The strip inside Page has
          been exact since that was found; this is the same rule, written
          down in the one place now rather than in each copy.
        */
        const on = t.href ? pathname === t.href : active === t.id;
        return (
          <button
            key={t.id ?? t.href ?? t.label}
            role="tab"
            aria-selected={on}
            onClick={() => (t.href ? router.push(t.href) : onChange?.(t.id as string))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 13px',
              borderRadius: radius.pill,
              border: `1px solid ${on ? C.border : 'transparent'}`,
              background: on ? C.panel : 'transparent',
              boxShadow: on ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
              color: on ? C.text : C.dim,
              fontSize: 13.5,
              fontWeight: on ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {t.icon && <Glyph name={t.icon} color={on ? C.accent : C.faint} />}
            {t.label}
            {!!t.count && t.count > 0 && (
              <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Everything overlay-shaped.
 *
 * Escape closes it, clicking the backdrop closes it, focus moves into it when
 * it opens and goes back where it came from when it closes, and on a phone it
 * comes up from the bottom because that is where a thumb is. Written once so
 * the next one cannot quietly ship without the escape key.
 */
export function Sheet({
  title,
  onClose,
  children,
  width = 460,
}: {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const phone = useIsPhone();
  const card = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // The first thing you can type in, or the panel itself.
    const first = card.current?.querySelector<HTMLElement>(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
    );
    (first ?? card.current)?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      returnTo?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: phone ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
        padding: phone ? 0 : '10vh 20px 20px',
      }}
    >
      <div
        ref={card}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.panel,
          borderRadius: phone ? `${radius.lg}px ${radius.lg}px 0 0` : radius.lg,
          padding: 22,
          width: phone ? '100%' : `min(${width}px, 100%)`,
          maxHeight: phone ? '92vh' : '80vh',
          overflowY: 'auto',
          outline: 'none',
        }}
      >
        {title && (
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16 }}>
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * THE STATE OF THE BUSINESS, AT THE TOP OF A SCREEN.
 *
 * Every list screen had its own version of this and no two agreed. Home had a
 * line of figures, Clients had three of them, Invoices and Proposals used
 * Metric with hideAtZero so the whole row vanished on a quiet morning, and
 * Pitches showed three noughts in three boxes. Four treatments of one idea, so
 * learning to read one screen taught you nothing about the next.
 *
 * They stay at zero. $0 owed is the answer, not the absence of one, and a
 * strip that disappears when things are going well is a strip you cannot
 * learn the position of.
 *
 * Only Home's tiles navigate, and that is deliberate. Home is a launcher: you
 * open it to go somewhere. Everywhere else the tiles describe the screen you
 * are already on, and sending somebody from Clients to Invoices is a sideways
 * jump with no way back — the sidebar took them there, and nothing on the
 * destination says where they came from. Worse, one tile out of four being
 * pressable teaches that none of them are.
 */
export interface TileItem {
  label: string;
  value: string;
  hint?: string;
  icon: IconName;
  /** Set when the number wants attention. Colours the value and the ground. */
  tone?: string;
  href?: string;
}

export function Tiles({ items }: { items: readonly TileItem[] }) {
  const router = useRouter();
  if (!items.length) return null;
  return (
    <div className="tiles">
      {items.map((t) => {
        const inner = (
          <>
            <span className="tileTop">
              <Glyph name={t.icon} size={16} color={t.tone ?? C.faint} />
              <span className="tileLabel">{t.label}</span>
            </span>
            <span className="tileValue" style={t.tone ? { color: t.tone } : undefined}>
              {t.value}
            </span>
            {t.hint && <span className="tileHint">{t.hint}</span>}
          </>
        );
        const cls = `tile${t.tone ? ' tileLive' : ''}`;
        return t.href ? (
          <button key={t.label} className={cls} onClick={() => router.push(t.href as string)}>
            {inner}
          </button>
        ) : (
          <div key={t.label} className={cls} style={{ cursor: 'default' }}>{inner}</div>
        );
      })}
    </div>
  );
}

/**
 * A dropdown that belongs to the same product as everything around it.
 *
 * A raw <select> renders as whatever the operating system feels like, which on
 * a screen of custom pills and custom buttons is the one control the design
 * does not reach. Same box as a text field, because it is the same kind of
 * thing: somewhere you put an answer.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%', ...style }}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...inputStyle,
          appearance: 'none',
          WebkitAppearance: 'none',
          paddingRight: 30,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span
        aria-hidden
        style={{
          position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none', color: C.faint, fontSize: 10, lineHeight: 1,
        }}
      >
        ▼
      </span>
    </div>
  );
}


/**
 * A search box that looks like one.
 *
 * These were plain text inputs with the word "Search" typed into the
 * placeholder, which is indistinguishable from a field waiting to be filled
 * in until you read it. A magnifier is the one icon everybody already knows,
 * and it survives the placeholder being replaced by what somebody typed.
 *
 * Shared rather than repeated: the boxes on People and Clients had drifted to
 * different widths and different placeholder grammar, which is what happens to
 * anything written out twice.
 */
export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  style,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
}) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 260px', ...style }}>
      <span style={{ position: 'absolute', left: 11, display: 'flex', pointerEvents: 'none' }}>
        <Glyph name="search" size={14} color={C.faint} />
      </span>
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingLeft: 33 }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Clear search"
          title="Clear"
          style={{
            position: 'absolute', right: 8, width: 20, height: 20, borderRadius: 999,
            border: 'none', background: 'transparent', color: C.faint,
            fontSize: 14, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
}

/**
 * Nothing here yet.
 *
 * Was 28px of padding and centered text, so an empty section took as much
 * vertical space as a full one. Stack four of those on a record and the
 * things somebody can actually act on end up below the fold, which is the
 * same as not building them.
 *
 * Now a single quiet line, left-aligned with everything else on the page. The
 * `hero` variant keeps the old weight for the handful of places where the
 * empty state IS the screen — a first-run inbox, an untouched module — and
 * where filling it is the only thing to do.
 */
export function Empty({
  children,
  hero,
}: {
  children: React.ReactNode;
  hero?: boolean;
}) {
  return (
    <div
      style={{
        padding: hero ? '28px 4px' : '2px 0',
        color: C.faint,
        fontSize: 14,
        lineHeight: 1.6,
        textAlign: hero ? 'center' : 'left',
      }}
    >
      {children}
    </div>
  );
}

/**
 * On a phone the header row is dropped and each row becomes a stacked block —
 * a five-column grid squeezed to 360px is unreadable, and horizontal scroll
 * inside a table is worse.
 */
export function Row({
  cols,
  children,
  header,
  onClick,
  labels,
}: {
  cols: string;
  children: React.ReactNode;
  header?: boolean;
  onClick?: () => void;
  /**
   * Column headings, for the phone layout only.
   *
   * On a phone the header row is dropped and the cells wrap, which used to
   * leave a run of bare numbers — a date, an amount, a rate and a total with
   * nothing saying which was which. On a billing screen that is not untidy,
   * it is unreadable: you cannot tell the rate from the total.
   *
   * Pass one label per cell and each value gets its own line with its name
   * above it. Tables that have not been given labels fall back to scrolling
   * sideways with the header intact, which is clumsy but never ambiguous.
   */
  labels?: string[];
}) {
  const phone = useIsPhone();

  if (phone && header) return null;

  if (phone && labels) {
    const cells = React.Children.toArray(children);
    return (
      <div
        onClick={onClick}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '14px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 14.5,
          color: C.text,
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        {cells.map((cell, i) => {
          const label = labels[i];
          // A cell with no heading is an action button or a spacer. Giving it
          // a label would invent one.
          if (!label) return <div key={i}>{cell}</div>;
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
              <span
                style={{
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: C.faint,
                  fontWeight: 600,
                  flexShrink: 0,
                  paddingTop: 1,
                }}
              >
                {label}
              </span>
              <span style={{ textAlign: 'right', minWidth: 0 }}>{cell}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: cols,
        gap: 12,
        alignItems: 'center',
        padding: header ? '9px 14px' : '12px 14px',
        borderBottom: `1px solid ${C.border}`,
        fontSize: header ? 10 : 13,
        textTransform: header ? 'uppercase' : 'none',
        letterSpacing: header ? '0.07em' : 'normal',
        color: header ? C.faint : C.text,
        fontWeight: header ? 600 : 400,
        background: header ? C.panelAlt : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        minWidth: 'max-content',
      }}
    >
      {children}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  /**
   * Scrolls sideways rather than squashing. A table narrower than its content
   * either wraps into ambiguity or crushes columns until the numbers collide;
   * scrolling keeps every figure beside its own heading.
   *
   * Rows given `labels` stack instead and never reach this, so the scroll is
   * the fallback rather than the plan.
   */
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        overflowX: 'auto',
        overflowY: 'hidden',
        background: C.panel,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {children}
    </div>
  );
}

/**
 * Big tap target for the primary field action — photographing a receipt.
 * Fixed to the bottom of the screen on a phone, where a thumb actually is.
 */
export function MobileAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const phone = useIsPhone();
  if (!phone) return null;

  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        /**
         * Clear of the navigation bar.
         *
         * This was pinned 16px from the bottom, which is now where the tab bar
         * lives. Two floating controls occupying the same corner is how
         * somebody taps Add meaning to open the camera. Sits above it.
         */
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        zIndex: 29,
        padding: '15px',
        borderRadius: 999,
        border: 'none',
        background: C.accent,
        color: '#fff',
        fontSize: 16,
        fontWeight: 600,
        fontFamily: 'inherit',
        boxShadow: '0 6px 20px rgba(0,0,0,.18)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Figures line up in columns only if the digits are the same width. */
export const numeric: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum"',
};

/*
  The minus goes outside the dollar sign.

  "$-24" is not how anybody writes money. Losses were rendering that way on
  every tile, because the sign came out of toLocaleString in the middle of the
  string rather than being handled.
*/
export const money = (n: number | null | undefined): string => {
  const v = n ?? 0;
  return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Whole dollars — for dashboard tiles where cents are noise. */
export const money0 = (n: number | null | undefined): string => {
  const v = Math.round(n ?? 0);
  return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US')}`;
};

export const hours = (n: number | null | undefined): string =>
  `${(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 1 })}h`;

export function shortDate(d: string | null | undefined): string {
  if (!d) return '–';
  // Date-only strings must not be parsed as UTC or they shift a day backward
  // in western timezones.
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return '–';
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * A face, or initials when there isn't one.
 *
 * People recall a photo instantly and a row of text not at all, which is why
 * this is the largest element on a CRM row.
 */
/**
 * A circle is a person. A rounded square is a company.
 *
 * This started as one shape for both, and the result was Mark's face standing
 * in for Mammoth Construction, which made the client look like a man rather
 * than a business. The shapes now carry the distinction the product is built
 * on: clients are companies, brands and concepts, and people are the humans
 * behind them.
 *
 * Worth having as geometry rather than only as a label, because the shape is
 * read before any text is, and it is the thing that stops a logo and a
 * headshot from looking like the same kind of record.
 */
export function Avatar({
  src,
  name,
  size = 40,
  shape = 'person',
  tint,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  shape?: 'person' | 'company';
  /** The brand's own colour, for a monogram that looks chosen rather than left. */
  tint?: string | null;
}) {
  const [failed, setFailed] = React.useState(false);
  const radius = shape === 'company' ? Math.max(4, Math.round(size * 0.22)) : '50%';

  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ''}
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          // A logo is usually drawn with its own breathing room and a
          // transparent background, so cropping it to fill the box cuts the
          // mark. Contain keeps the whole thing visible; a face wants cover.
          objectFit: shape === 'company' ? 'contain' : 'cover',
          flexShrink: 0,
          border: `1px solid ${C.border}`,
          background: shape === 'company' ? C.panel : C.panelAlt,
        }}
      />
    );
  }

  /*
    A monogram on the brand's own colour.

    Default grey reads as a placeholder nobody got round to replacing. The
    brand's darkest colour reads as a choice — and for CALO&CO that colour is
    Ink, which is near-black, so its tile is black without anything being
    hardcoded to say so.

    The letter flips to white or near-black on the same contrast test the rest
    of the product uses, so a pale brand does not end up with white text on
    cream.
  */
  const ground = (tint && /^#[0-9a-f]{6}$/i.test(tint.trim()) ? tint.trim() : null);
  const ink = ground ? readableOn(ground) : C.faint;

  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        background: ground ?? C.panelAlt,
        border: `1px solid ${ground ?? C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: ink,
        fontSize: size * 0.36,
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    >
      {initials || '·'}
    </div>
  );
}
