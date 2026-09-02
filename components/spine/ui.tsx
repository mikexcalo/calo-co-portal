'use client';

/**
 * Nautilus spine — UI primitives.
 *
 * Everything the new modules need, in one file. No animation library, no
 * token indirection, no shared-component web. If a primitive isn't used by
 * at least two screens, it doesn't belong here.
 */

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { C, DISPLAY, SERIF, radius } from '@/lib/spine/tokens';

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

export interface PageTab {
  label: string;
  href: string;
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
          <h1 style={{ fontSize: phone ? 19 : 21, fontWeight: 500, margin: 0, color: C.text }}>
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

function PageTabs({ tabs, phone }: { tabs: readonly PageTab[]; phone: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        marginBottom: 24,
        borderBottom: `1px solid ${C.border}`,
        overflowX: phone ? 'auto' : 'visible',
      }}
    >
      {tabs.map((t) => {
        // Exact match only. Prefix matching is what lit every Library tab at
        // once, because /pricing, /records and /brand-kit all belong to it.
        const active = pathname === t.href;
        return (
          <button
            key={t.href}
            onClick={() => router.push(t.href)}
            style={{
              padding: '9px 15px',
              border: 'none',
              borderBottom: `2px solid ${active ? C.accent : 'transparent'}`,
              background: 'transparent',
              color: active ? C.text : C.dim,
              fontSize: 14.5,
              fontWeight: active ? 500 : 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
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
  { label: 'Business', href: '/business' },
  { label: 'Price list', href: '/pricing' },
  { label: 'Records', href: '/records' },
];

/**
 * Being findable, as one thing.
 *
 * Reviews, the search checklist and the directory list are three views of one
 * job: whether somebody looking for this business finds it and believes it.
 * They were three ideas that happened to ship on different days, and shipping
 * order is not a reason to organize a product.
 *
 * Reviews in particular is not a place you live. It is a switch you set once
 * and a queue you glance at, which is a tab.
 */
export const PRESENCE_TABS: readonly PageTab[] = [
  { label: 'Setup', href: '/seo' },
  { label: 'Reviews', href: '/reviews' },
];

/**
 * Receipts feed overheads and job costs. Nobody browses receipts.
 */
export const MONEY_TABS: readonly PageTab[] = [
  { label: 'Overheads', href: '/expenses' },
  { label: 'Receipts', href: '/documents' },
];

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

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
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
      style={{
        ...styles[variant],
        padding: '9px 16px',
        borderRadius: radius.md,
        fontSize: 14,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        transition: 'opacity .15s',
      }}
    >
      {children}
    </button>
  );
}

const PILL_TONE = {
  neutral: { bg: C.panelAlt, fg: C.dim },
  blue: { bg: C.blueSoft, fg: C.blue },
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

export function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: 'green' | 'amber' | 'red' | 'blue';
  hint?: string;
}) {
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
      <div style={{ fontSize: 24, fontWeight: 500, color, marginTop: 8, letterSpacing: '-0.01em' }}>
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
        borderRadius: 11,
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

export const money = (n: number | null | undefined): string =>
  `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Whole dollars — for dashboard tiles where cents are noise. */
export const money0 = (n: number | null | undefined): string =>
  `$${Math.round(n ?? 0).toLocaleString('en-US')}`;

export const hours = (n: number | null | undefined): string =>
  `${(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 1 })}h`;

export function shortDate(d: string | null | undefined): string {
  if (!d) return '—';
  // Date-only strings must not be parsed as UTC or they shift a day backward
  // in western timezones.
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return '—';
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
export function Avatar({
  src,
  name,
  size = 40,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = React.useState(false);

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
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          border: `1px solid ${C.border}`,
          background: C.panelAlt,
        }}
      />
    );
  }

  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: C.panelAlt,
        border: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: C.faint,
        fontSize: size * 0.36,
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    >
      {initials || '·'}
    </div>
  );
}
