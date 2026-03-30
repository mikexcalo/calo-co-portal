import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Client } from '@/lib/types';
import { initials, tintColor } from '@/lib/utils';
import { DB } from '@/lib/database';

interface ClientCardProps {
  client: Client;
  onNavigate: () => void;
}

function getHealth(client: Client): { color: string; issues: { label: string; href: string }[] } {
  const issues: { label: string; href: string }[] = [];
  const contacts = DB.contacts[client.id] || [];
  const primary = contacts.find((c) => c.isPrimary) || contacts[0];

  // Mandatory contact fields only
  const nameParts = (primary?.name || '').split(/\s+/);
  if (!nameParts[0]) issues.push({ label: 'First Name', href: `/clients/${client.id}` });
  if (!nameParts[1]) issues.push({ label: 'Last Name', href: `/clients/${client.id}` });
  if (!primary?.email && !client.email) issues.push({ label: 'Email', href: `/clients/${client.id}` });

  // Module-level completeness
  const bk = client.brandKit;
  const hasLogos = bk && Object.values(bk.logos || {}).some((a: any) => a?.length > 0);
  if (!hasLogos) issues.push({ label: 'Brand Kit logos', href: `/clients/${client.id}/brand-kit` });
  if (!bk?.colors?.length) issues.push({ label: 'Brand colors', href: `/clients/${client.id}/brand-kit` });

  const hasSig = !!client.emailSignatureHtml || !!(client.signatureFields as any)?.name;
  if (!hasSig) issues.push({ label: 'Email Signature', href: `/clients/${client.id}/email-signature` });

  const color = issues.length === 0 ? '#22c55e' : issues.length <= 3 ? '#f59e0b' : '#ef4444';
  return { color, issues };
}

export default function ClientCard({ client, onNavigate }: ClientCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const contacts = DB.contacts[client.id] || [];
  const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0] || null;

  const health = getHealth(client);
  const brandColor = client.brandKit?.colors?.[0];
  const tintedColor = tintColor(brandColor);
  const logoUrl = client.logo;

  const lastActivity = DB.activityLog
    .filter((e) => e.clientId === client.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const lastActiveStr = lastActivity
    ? new Date(lastActivity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  return (
    <div style={{ borderTopColor: tintedColor }} className="cc-row-wrap">
      {/* Main row — click toggles expand */}
      <div
        className="cc-row"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className="cc-row-avatar" style={logoUrl ? { background: 'transparent' } : undefined}>
          {logoUrl ? (
            <img src={logoUrl} alt={client.company} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initials(client.company || client.name)
          )}
        </div>
        <div className="cc-row-info">
          <span className="cc-row-name">{client.company || client.name}</span>
          {primaryContact && (
            <span className="cc-row-contact">
              {primaryContact.name}
              {primaryContact.role ? ` · ${primaryContact.role}` : ''}
            </span>
          )}
        </div>
        <div className="cc-row-right">
          {/* Health dot */}
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: health.color,
            flexShrink: 0, display: 'inline-block',
          }} title={health.issues.length === 0 ? 'Fully set up' : `${health.issues.length} items missing`} />
          <span className="cc-row-date">{lastActiveStr}</span>
          {/* Expand chevron */}
          <span style={{
            color: '#94a3b8', fontSize: 10, transition: 'transform 0.15s',
            transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block',
          }}>▼</span>
          {/* Open button — styled, with stopPropagation */}
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
            style={{
              padding: '4px 12px', fontSize: 12, fontWeight: 600,
              border: '1.5px solid #d1d5db', borderRadius: 6,
              background: '#fff', color: '#475569', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
            }}
          >
            Open
          </button>
        </div>
      </div>
      {/* Expandable detail — default collapsed */}
      {expanded && (
        <div style={{
          padding: '8px 14px 10px 52px', background: '#f8fafc',
          borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#64748b',
          display: 'flex', flexWrap: 'wrap', gap: '6px 16px',
        }}>
          {health.issues.length === 0 ? (
            <span style={{ color: '#22c55e', fontWeight: 600 }}>All set up</span>
          ) : (
            <>
              <span style={{ fontWeight: 600, color: '#475569' }}>Missing:</span>
              {health.issues.map((issue, i) => (
                <a key={i} onClick={(e) => { e.stopPropagation(); router.push(issue.href); }}
                  style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'none' }}>
                  {issue.label}
                </a>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
