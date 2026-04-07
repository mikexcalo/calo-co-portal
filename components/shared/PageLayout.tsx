'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/lib/theme';

const containerVariants = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

export { itemVariants };

// --- Page wrapper ---
interface PageLayoutProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  padding?: string;
  disableAnimation?: boolean;
}

export function PageLayout({ title, subtitle, action, children, maxWidth = '960px', padding = '24px', disableAnimation = false }: PageLayoutProps) {
  const { t } = useTheme();
  const Wrapper = disableAnimation ? 'div' : motion.div;
  const wrapperProps = disableAnimation ? {} : { variants: containerVariants, initial: 'hidden', animate: 'show' };
  const ItemWrap = disableAnimation ? 'div' : motion.div;
  const itemProps = disableAnimation ? {} : { variants: itemVariants };

  return (
    <Wrapper style={{ padding, maxWidth }} {...(wrapperProps as any)}>
      {title && (
        <ItemWrap {...(itemProps as any)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 2px', color: t.text.primary }}>{title}</h1>
            {subtitle && <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </ItemWrap>
      )}
      {children}
    </Wrapper>
  );
}

// --- Two-column layout ---
interface TwoColumnLayoutProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  left: React.ReactNode;
  right: React.ReactNode;
  rightWidth?: string;
  header?: React.ReactNode;
  maxWidth?: string;
  padding?: string;
  gap?: string;
  disableAnimation?: boolean;
}

export function TwoColumnLayout({ title, subtitle, action, left, right, rightWidth = '320px', header, maxWidth = '960px', padding = '24px', gap = '24px', disableAnimation = false }: TwoColumnLayoutProps) {
  const { t } = useTheme();
  const Wrapper = disableAnimation ? 'div' : motion.div;
  const wrapperProps = disableAnimation ? {} : { variants: containerVariants, initial: 'hidden', animate: 'show' };
  const ItemWrap = disableAnimation ? 'div' : motion.div;
  const itemProps = disableAnimation ? {} : { variants: itemVariants };

  return (
    <Wrapper style={{ padding, maxWidth }} {...(wrapperProps as any)}>
      {title && (
        <ItemWrap {...(itemProps as any)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 2px', color: t.text.primary }}>{title}</h1>
            {subtitle && <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </ItemWrap>
      )}
      {header && <ItemWrap {...(itemProps as any)} style={{ marginBottom: 24 }}>{header}</ItemWrap>}
      <ItemWrap {...(itemProps as any)} style={{ display: 'grid', gridTemplateColumns: `1fr ${rightWidth}`, gap }}>
        <div style={{ minWidth: 0 }}>{left}</div>
        <div style={{ minWidth: 0 }}>{right}</div>
      </ItemWrap>
    </Wrapper>
  );
}

// --- Section with label ---
interface SectionProps {
  label?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Section({ label, children, style }: SectionProps) {
  const { t } = useTheme();
  return (
    <motion.div variants={itemVariants} style={{ marginBottom: 24, ...style }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
          {label}
        </div>
      )}
      {children}
    </motion.div>
  );
}

// --- Section label (standalone) ---
export function SectionLabel({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <motion.p variants={itemVariants} style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>
      {children}
    </motion.p>
  );
}

// --- Card grid ---
interface CardGridProps {
  columns?: 2 | 3;
  children: React.ReactNode;
}

export function CardGrid({ columns = 3, children }: CardGridProps) {
  return (
    <motion.div variants={itemVariants} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 16 }}>
      {children}
    </motion.div>
  );
}

// --- Card with hover ---
interface CardProps {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Card({ onClick, disabled, children, style }: CardProps) {
  const { t } = useTheme();
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: t.bg.surface,
        border: `0.5px solid ${hovered && !disabled ? t.border.hover : t.border.default}`,
        borderRadius: 12, padding: 20, textAlign: 'left' as const,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'border-color 150ms, transform 150ms, box-shadow 150ms',
        transform: hovered && !disabled ? 'translateY(-1px)' : 'none',
        boxShadow: hovered && !disabled ? t.shadow.card : 'none',
        width: '100%', fontFamily: 'inherit', color: t.text.primary,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// --- Info bar ---
export function InfoBar({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <motion.div variants={itemVariants} style={{
      background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 12,
      padding: '12px 20px', marginBottom: 24,
      display: 'flex', alignItems: 'center', gap: 12, color: t.text.secondary,
    }}>
      {children}
    </motion.div>
  );
}

// --- Metric card ---
interface MetricCardProps {
  label: string;
  value: string;
  color?: string;
  onClick?: () => void;
}

export function MetricCard({ label, value, color, onClick }: MetricCardProps) {
  const { t } = useTheme();
  return (
    <div onClick={onClick} style={{
      background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 8,
      padding: 12, cursor: onClick ? 'pointer' : 'default',
    }}>
      <p style={{ fontSize: 10, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px', margin: '0 0 2px' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 20, fontWeight: 500, color: color || t.text.primary, margin: 0 }}>{value}</p>
        {onClick && <span style={{ fontSize: 12, color: t.text.tertiary }}>→</span>}
      </div>
    </div>
  );
}
