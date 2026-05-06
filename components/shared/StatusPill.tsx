'use client';

import { useTheme } from '@/lib/theme';

type StatusPillStatus = 'active' | 'paused' | 'archived' | 'paid' | 'overdue' | 'draft' | 'sent' | 'accepted' | 'declined' | 'lead' | 'churned' | 'prospect' | 'client_contact' | 'vendor' | 'talent' | 'friend';

interface StatusPillProps {
  status: StatusPillStatus;
  label?: string;
}

export const colorMap: Record<StatusPillStatus, { dot: string; bg: string; text: string }> = {
  active:   { dot: '#00C9A0', bg: '#E6FAF5', text: '#054D3D' },
  paid:     { dot: '#00C9A0', bg: '#E6FAF5', text: '#054D3D' },
  accepted: { dot: '#00C9A0', bg: '#E6FAF5', text: '#054D3D' },
  lead:     { dot: '#3B82F6', bg: '#EFF6FF', text: '#1E3A5F' },
  sent:     { dot: '#006AFF', bg: '#E6F1FB', text: '#042C53' },
  draft:    { dot: '#9b9b9f', bg: '#f0f0f2', text: '#111113' },
  paused:   { dot: '#F59E0B', bg: '#FEF3C7', text: '#78350F' },
  archived: { dot: '#9b9b9f', bg: '#f0f0f2', text: '#6b6b6f' },
  overdue:  { dot: '#DC2626', bg: '#FEE2E2', text: '#7F1D1D' },
  declined: { dot: '#DC2626', bg: '#FEE2E2', text: '#7F1D1D' },
  churned:  { dot: '#DC2626', bg: '#FEE2E2', text: '#7F1D1D' },
  prospect: { dot: '#8B5CF6', bg: '#F3EEFF', text: '#4C1D95' },
  client_contact: { dot: '#00C9A0', bg: '#E6FAF5', text: '#054D3D' },
  vendor:   { dot: '#F59E0B', bg: '#FEF3C7', text: '#78350F' },
  talent:   { dot: '#EC4899', bg: '#FDF2F8', text: '#831843' },
  friend:   { dot: '#06B6D4', bg: '#ECFEFF', text: '#164E63' },
};

const prettyLabels: Partial<Record<StatusPillStatus, string>> = {
  client_contact: 'Client contact',
};

export function StatusPill({ status, label }: StatusPillProps) {
  const colors = colorMap[status] || colorMap.draft;
  const displayLabel = label ?? prettyLabels[status] ?? (status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '));

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
