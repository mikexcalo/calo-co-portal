import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Client } from '@/lib/types';
import { initials } from '@/lib/utils';
import { DB } from '@/lib/database';

interface ClientCardProps {
  client: Client;
  onNavigate: () => void;
  expanded: boolean;
  onToggle: () => void;
}

export interface HealthResult {
  color: string;
  issues: { label: string; href: string }[];
}

/** Health: stale-based + mandatory fields (#7) */
export function getClientHealth(client: Client, staleDays = 7): HealthResult {
  const issues: { label: string; href: string }[] = [];
  const contacts = DB.contacts[client.id] || [];
  const primary = contacts.find((c) => c.isPrimary) || contacts[0];

  const nameParts = (primary?.name || '').split(/\s+/);
  if (!nameParts[0]) issues.push({ label: 'First Name', href: `/clients/${client.id}` });
  if (!nameParts[1]) issues.push({ label: 'Last Name', href: `/clients/${client.id}` });
  if (!primary?.email && !client.email) issues.push({ label: 'Email', href: `/clients/${client.id}` });

  const bk = client.brandKit;
  const hasLogos = bk && Object.values(bk.logos || {}).some((a: any) => a?.length > 0);
  const hasColors = bk?.colors?.length > 0;
  if (!hasLogos) issues.push({ label: 'Brand Kit logos', href: `/clients/${client.id}/brand-kit` });
  if (!hasColors) issues.push({ label: 'Brand colors', href: `/clients/${client.id}/brand-kit` });

  const hasMandatory = !!nameParts[0] && !!nameParts[1] && !!(primary?.email || client.email);

  // Stale check
  const lastAct = DB.activityLog
    .filter((e) => e.clientId === client.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const daysSince = lastAct ? (Date.now() - new Date(lastAct.createdAt).getTime()) / 86400000 : Infinity;

  let color: string;
  if (!hasMandatory || daysSince > staleDays) {
    color = '#ef4444';
  } else if (daysSince > staleDays - 2 || !hasLogos || !hasColors) {
    color = '#f59e0b';
  } else {
    color = '#22c55e';
  }
  return { color, issues };
}

export default function ClientCard({ client, onNavigate, expanded, onToggle }: ClientCardProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  const contacts = DB.contacts[client.id] || [];
  const primary = contacts.find((c) => c.isPrimary) || contacts[0] || null;
  const health = getClientHealth(client);
  const logoUrl = client.logo;
  const bk = client.brandKit;
  const hasLogos = bk && Object.values(bk.logos || {}).some((a: any) => a?.length > 0);
  const hasColors = bk?.colors?.length > 0;
  const hasInvoices = DB.invoices.some((i) => i.clientId === client.id);
  const hasSig = !!client.emailSignatureHtml || !!(client.signatureFields as any)?.name;

  const lastAct = DB.activityLog
    .filter((e) => e.clientId === client.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const lastStr = lastAct
    ? new Date(lastAct.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  useEffect(() => {
    if (contentRef.current) setHeight(contentRef.current.scrollHeight);
  }, [expanded]);

  const modules = [
    { label: 'Brand Kit', started: hasLogos || hasColors },
    { label: 'Invoices', started: hasInvoices },
    { label: 'Email Sig', started: hasSig },
    { label: 'Financials', started: hasInvoices },
    { label: 'Builder', started: false },
  ];

  const actions: { label: string; href: string }[] = [];
  if (!hasLogos && !hasColors) actions.push({ label: 'Start Brand Kit', href: `/clients/${client.id}/brand-kit` });
  actions.push({ label: 'Create Invoice', href: `/clients/${client.id}/invoices/new` });
  actions.push({ label: 'Edit Info', href: `/clients/${client.id}` });

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      overflow: 'hidden', gridColumn: expanded ? '1 / -1' : undefined,
    }}>
      {/* Card header */}
      <div onClick={onToggle} style={{
        padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div className="cc-row-avatar" style={logoUrl ? { background: 'transparent' } : undefined}>
          {logoUrl ? (
            <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : initials(client.company || client.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {client.company || client.name}
          </div>
          {primary && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
              {primary.name}{primary.role ? ` · ${primary.role}` : ''}
            </div>
          )}
        </div>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: health.color, flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{lastStr}</span>
        <span style={{
          color: '#94a3b8', fontSize: 9, transition: 'transform 0.25s ease',
          transform: expanded ? 'rotate(180deg)' : 'none', flexShrink: 0,
        }}>▼</span>
      </div>

      {/* Accordion */}
      <div style={{ maxHeight: expanded ? height : 0, overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
        <div ref={contentRef} style={{ padding: '0 14px 12px', fontSize: 12, borderTop: '1px solid #f1f5f9' }}>
          {/* Contact */}
          <div style={{ display: 'flex', gap: 14, color: '#64748b', margin: '10px 0 8px', flexWrap: 'wrap' }}>
            <span>Email: {primary?.email || client.email || '—'}</span>
            <span>Phone: {primary?.phone || '—'}</span>
            <span>Business: {client.phone || '—'}</span>
          </div>
          {/* Modules */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            {modules.map((m) => (
              <span key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748b' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.started ? '#22c55e' : '#d1d5db' }} />
                {m.label}
              </span>
            ))}
          </div>
          {/* Actions + Open */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {actions.map((a) => (
              <a key={a.label} onClick={(e) => { e.stopPropagation(); router.push(a.href); }}
                style={{ fontSize: 11, color: '#2563eb', cursor: 'pointer', textDecoration: 'none', fontWeight: 500 }}>
                {a.label}
              </a>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={(e) => { e.stopPropagation(); onNavigate(); }} style={{
              padding: '5px 14px', fontSize: 11, fontWeight: 600,
              border: '1.5px solid #d1d5db', borderRadius: 6,
              background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>Open</button>
          </div>
        </div>
      </div>
    </div>
  );
}
