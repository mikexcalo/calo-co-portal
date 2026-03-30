import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Client } from '@/lib/types';
import { initials, tintColor } from '@/lib/utils';
import { DB } from '@/lib/database';

interface ClientCardProps {
  client: Client;
  onNavigate: () => void;
}

export interface HealthResult {
  color: string;
  issues: { label: string; href: string }[];
}

/** Shared health calculation — exported so dashboard can use it for sorting/banner */
export function getClientHealth(client: Client): HealthResult {
  const issues: { label: string; href: string }[] = [];
  const contacts = DB.contacts[client.id] || [];
  const primary = contacts.find((c) => c.isPrimary) || contacts[0];

  // Mandatory contact fields
  const nameParts = (primary?.name || '').split(/\s+/);
  if (!nameParts[0]) issues.push({ label: 'First Name', href: `/clients/${client.id}` });
  if (!nameParts[1]) issues.push({ label: 'Last Name', href: `/clients/${client.id}` });
  if (!primary?.email && !client.email) issues.push({ label: 'Email', href: `/clients/${client.id}` });

  // Module-level: Brand Kit only. Email Signature excluded (#4).
  const bk = client.brandKit;
  const hasLogos = bk && Object.values(bk.logos || {}).some((a: any) => a?.length > 0);
  const hasColors = bk?.colors?.length > 0;
  if (!hasLogos) issues.push({ label: 'Brand Kit logos', href: `/clients/${client.id}/brand-kit` });
  if (!hasColors) issues.push({ label: 'Brand colors', href: `/clients/${client.id}/brand-kit` });

  // Health formula (#6)
  const hasMandatoryContact = !!nameParts[0] && !!nameParts[1] && !!(primary?.email || client.email);
  const hasBrandStarted = hasLogos || hasColors;
  let color: string;
  if (!hasMandatoryContact || (!hasLogos && !hasColors)) {
    color = '#ef4444'; // red
  } else if (!hasLogos || !hasColors) {
    color = '#f59e0b'; // orange
  } else {
    color = '#22c55e'; // green
  }

  return { color, issues };
}

export default function ClientCard({ client, onNavigate }: ClientCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  const contacts = DB.contacts[client.id] || [];
  const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0] || null;
  const health = getClientHealth(client);
  const logoUrl = client.logo;
  const bk = client.brandKit;
  const hasLogos = bk && Object.values(bk.logos || {}).some((a: any) => a?.length > 0);
  const hasColors = bk?.colors?.length > 0;
  const hasInvoices = DB.invoices.some((i) => i.clientId === client.id);
  const hasSig = !!client.emailSignatureHtml || !!(client.signatureFields as any)?.name;

  const lastActivity = DB.activityLog
    .filter((e) => e.clientId === client.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const lastActiveStr = lastActivity
    ? new Date(lastActivity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  // Measure content height for smooth animation
  useEffect(() => {
    if (contentRef.current) setContentHeight(contentRef.current.scrollHeight);
  }, [expanded]);

  // Module status data
  const modules = [
    { label: 'Brand Kit', started: hasLogos || hasColors },
    { label: 'Invoices', started: hasInvoices },
    { label: 'Email Sig', started: hasSig },
  ];

  // Quick actions (#11)
  const quickActions: { label: string; href: string }[] = [];
  if (!hasLogos && !hasColors) quickActions.push({ label: 'Start Brand Kit', href: `/clients/${client.id}/brand-kit` });
  quickActions.push({ label: 'Create Invoice', href: `/clients/${client.id}/invoices/new` });
  quickActions.push({ label: 'Edit Info', href: `/clients/${client.id}` });

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      overflow: 'hidden', marginBottom: 6,
    }}>
      {/* Header row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          cursor: 'pointer',
        }}
      >
        <div className="cc-row-avatar" style={logoUrl ? { background: 'transparent' } : undefined}>
          {logoUrl ? (
            <img src={logoUrl} alt={client.company} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initials(client.company || client.name)
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {client.company || client.name}
          </div>
          {primaryContact && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
              {primaryContact.name}{primaryContact.role ? ` · ${primaryContact.role}` : ''}
            </div>
          )}
        </div>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: health.color,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{lastActiveStr}</span>
        <span style={{
          color: '#94a3b8', fontSize: 9, transition: 'transform 0.25s ease',
          transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block', flexShrink: 0,
        }}>▼</span>
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          style={{
            padding: '4px 12px', fontSize: 11, fontWeight: 600,
            border: '1.5px solid #d1d5db', borderRadius: 6,
            background: '#fff', color: '#475569', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >Open</button>
      </div>

      {/* Accordion expanded area (#3) */}
      <div style={{
        maxHeight: expanded ? contentHeight : 0,
        overflow: 'hidden',
        transition: 'max-height 0.25s ease',
      }}>
        <div ref={contentRef} style={{ padding: '0 14px 12px 52px', fontSize: 12 }}>
          {/* Contact row */}
          <div style={{ display: 'flex', gap: 16, color: '#64748b', marginBottom: 8, flexWrap: 'wrap' }}>
            <span>Email: {primaryContact?.email || client.email || '—'}</span>
            <span>Phone: {primaryContact?.phone || '—'}</span>
            <span>Business: {client.phone || '—'}</span>
          </div>

          {/* Missing alerts — only if any (#4) */}
          {health.issues.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#475569', fontSize: 11 }}>Missing:</span>
              {health.issues.map((issue, i) => (
                <a key={i} onClick={(e) => { e.stopPropagation(); router.push(issue.href); }}
                  style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'none', fontSize: 11 }}>
                  {issue.label}
                </a>
              ))}
            </div>
          )}

          {/* Module status row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            {modules.map((m) => (
              <span key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: m.started ? '#22c55e' : '#d1d5db', flexShrink: 0,
                }} />
                {m.label}
              </span>
            ))}
          </div>

          {/* Quick actions (#11) */}
          <div style={{ display: 'flex', gap: 12 }}>
            {quickActions.map((a) => (
              <a key={a.label}
                onClick={(e) => { e.stopPropagation(); router.push(a.href); }}
                style={{ fontSize: 11, color: '#2563eb', cursor: 'pointer', textDecoration: 'none', fontWeight: 500 }}>
                {a.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
