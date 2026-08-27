'use client';

/**
 * Nautilus spine — UI primitives.
 *
 * Everything the new modules need, in one file. No animation library, no
 * token indirection, no shared-component web. If a primitive isn't used by
 * at least two screens, it doesn't belong here.
 */

import React from 'react';

import { C, SERIF, radius } from '@/lib/spine/tokens';

export { C, SERIF, radius };

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

export function Page({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
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
          <h1 style={{ fontSize: phone ? 19 : 21, fontWeight: 500, margin: 0, color: C.text }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 13, color: C.faint, margin: '6px 0 0', maxWidth: 640 }}>
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{action}</div>
        )}
      </div>
      {children}
    </div>
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
        fontSize: 10,
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
    primary: { background: C.blue, color: '#fff', border: `1px solid ${C.blue}` },
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
        fontSize: 13,
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

export function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: PillTone }) {
  const t = PILL_TONE[tone];
  return (
    <span
      style={{
        background: t.bg,
        color: t.fg,
        fontSize: 10.5,
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
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.faint, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 500, color, marginTop: 8, letterSpacing: '-0.01em' }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>{hint}</div>}
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
      <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 6, fontWeight: 500 }}>{label}</div>
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
  fontSize: 13,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '28px 4px', color: C.faint, fontSize: 13, textAlign: 'center' }}>
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
}: {
  cols: string;
  children: React.ReactNode;
  header?: boolean;
  onClick?: () => void;
}) {
  const phone = useIsPhone();

  if (phone && header) return null;

  return (
    <div
      onClick={onClick}
      style={{
        display: phone ? 'flex' : 'grid',
        flexWrap: phone ? 'wrap' : undefined,
        gridTemplateColumns: phone ? undefined : cols,
        gap: phone ? 8 : 12,
        alignItems: 'center',
        padding: header ? '9px 14px' : phone ? '14px' : '12px 14px',
        borderBottom: `1px solid ${C.border}`,
        fontSize: header ? 10 : 13,
        textTransform: header ? 'uppercase' : 'none',
        letterSpacing: header ? '0.07em' : 'normal',
        color: header ? C.faint : C.text,
        fontWeight: header ? 600 : 400,
        background: header ? C.panelAlt : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        background: C.panel,
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
        bottom: 16,
        zIndex: 30,
        padding: '15px',
        borderRadius: 11,
        border: 'none',
        background: C.blue,
        color: '#fff',
        fontSize: 15,
        fontWeight: 600,
        fontFamily: 'inherit',
        boxShadow: '0 6px 20px rgba(0,0,0,.45)',
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
