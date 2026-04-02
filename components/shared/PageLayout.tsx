'use client';

import React from 'react';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

// Full-width page (like Settings, Financials)
export function PageLayout({ title, subtitle, action, children }: PageLayoutProps) {
  return (
    <div style={{ padding: '24px 32px', maxWidth: '960px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 500, margin: '0 0 2px', color: '#111827' }}>{title}</h1>
          {subtitle && <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}

// Two-column page (like Client Hub, Dashboard)
interface TwoColumnLayoutProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  left: React.ReactNode;
  right: React.ReactNode;
  rightWidth?: string;
  header?: React.ReactNode;
}

export function TwoColumnLayout({ title, subtitle, action, left, right, rightWidth = '320px', header }: TwoColumnLayoutProps) {
  return (
    <div style={{ padding: '24px 32px', maxWidth: '960px' }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 500, margin: '0 0 2px', color: '#111827' }}>{title}</h1>
            {subtitle && <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {header && <div style={{ marginBottom: '24px' }}>{header}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: `1fr ${rightWidth}`, gap: '24px' }}>
        <div style={{ minWidth: 0 }}>{left}</div>
        <div style={{ minWidth: 0 }}>{right}</div>
      </div>
    </div>
  );
}

// Section label
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>
      {children}
    </p>
  );
}

// Metric card
interface MetricCardProps {
  label: string;
  value: string;
  color?: string;
  onClick?: () => void;
}

export function MetricCard({ label, value, color = '#111827', onClick }: MetricCardProps) {
  return (
    <div onClick={onClick} style={{ background: '#ffffff', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '12px', cursor: onClick ? 'pointer' : 'default' }}>
      <p style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px', margin: '0 0 2px' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '20px', fontWeight: 500, color, margin: 0 }}>{value}</p>
        {onClick && <span style={{ fontSize: '12px', color: '#9ca3af' }}>→</span>}
      </div>
    </div>
  );
}
