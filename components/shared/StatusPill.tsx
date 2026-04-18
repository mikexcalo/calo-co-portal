'use client';

import { useTheme } from '@/lib/theme';

type StatusPillStatus = 'active' | 'paused' | 'archived' | 'paid' | 'overdue' | 'draft' | 'sent' | 'accepted' | 'declined';

interface StatusPillProps {
  status: StatusPillStatus;
  label?: string;
}

const colorMap: Record<StatusPillStatus, { dot: string; bg: string; text: string }> = {
  active:   { dot: '#00C9A0', bg: '#E6FAF5', text: '#054D3D' },
  paid:     { dot: '#00C9A0', bg: '#E6FAF5', text: '#054D3D' },
  accepted: { dot: '#00C9A0', bg: '#E6FAF5', text: '#054D3D' },
  sent:     { dot: '#006AFF', bg: '#E6F1FB', text: '#042C53' },
  draft:    { dot: '#9b9b9f', bg: '#f0f0f2', text: '#111113' },
  paused:   { dot: '#F59E0B', bg: '#FEF3C7', text: '#78350F' },
  archived: { dot: '#9b9b9f', bg: '#f0f0f2', text: '#6b6b6f' },
  overdue:  { dot: '#DC2626', bg: '#FEE2E2', text: '#7F1D1D' },
  declined: { dot: '#DC2626', bg: '#FEE2E2', text: '#7F1D1D' },
};

export function StatusPill({ status, label }: StatusPillProps) {
  const colors = colorMap[status] || colorMap.draft;
  const displayLabel = label ?? (status.charAt(0).toUpperCase() + status.slice(1));

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px 3px 8px', borderRadius: 12,
      fontSize: 12, fontWeight: 500, background: colors.bg, color: colors.text, lineHeight: 1.4,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.dot, flexShrink: 0 }} aria-hidden />
      {displayLabel}
    </span>
  );
}
