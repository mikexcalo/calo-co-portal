import React from 'react';
import { Client } from '@/lib/types';
import { initials, tintColor, currency } from '@/lib/utils';
import { DB } from '@/lib/database';

interface ClientCardProps {
  client: Client;
  onNavigate: () => void;
}

export default function ClientCard({ client, onNavigate }: ClientCardProps) {
  // Get primary contact
  const contacts = DB.contacts[client.id] || [];
  const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0] || null;

  // Check completeness
  const hasBrandKit =
    client.brandKit.colors.length > 0 ||
    Object.values(client.brandKit.logos).some((a) => a.length > 0) ||
    client.brandKit.fonts.heading;
  const hasContact = primaryContact !== null;

  // Client invoices for stats
  const clientInvoices = DB.invoices.filter((i) => i.clientId === client.id);
  const outstanding = clientInvoices
    .filter((i) => i.status !== 'paid' && !i.isReimbursement)
    .reduce((sum, i) => {
      const total = (i.items || []).reduce((s, item) => s + item.qty * item.price, 0) + (i.tax || 0) + (i.shipping || 0);
      return sum + total;
    }, 0);

  const paid = clientInvoices
    .filter((i) => i.status === 'paid' && !i.isReimbursement)
    .reduce((sum, i) => {
      const total = (i.items || []).reduce((s, item) => s + item.qty * item.price, 0) + (i.tax || 0) + (i.shipping || 0);
      return sum + total;
    }, 0);

  // Get last activity date
  const lastActivity = DB.activityLog
    .filter((e) => e.clientId === client.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const lastActiveStr = lastActivity
    ? new Date(lastActivity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  // Incomplete indicator
  const issues = [];
  if (!hasBrandKit) issues.push('Brand Kit not started');
  if (!hasContact) issues.push('No contact added');
  if (clientInvoices.length === 0) issues.push('No invoices yet');

  // Get brand color for tint
  const brandColor = client.brandKit.colors[0];
  const tintedColor = tintColor(brandColor);

  // Get logo or initials
  const logoUrl = client.logo;
  const avatar = logoUrl ? (
    <img src={logoUrl} alt={client.company} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  ) : (
    initials(client.company || client.name)
  );

  // Engagement status styling
  const statusMap = {
    active: { label: 'Active', className: 'st-active' },
    paused: { label: 'Paused', className: 'st-paused' },
    closed: { label: 'Archived', className: 'st-archived' },
  };
  const statusInfo = statusMap[client.engagementStatus as keyof typeof statusMap] || statusMap.active;

  return (
    <div
      className="cc-row"
      onClick={onNavigate}
      style={{ cursor: 'pointer', borderTopColor: tintedColor }}
    >
      <div className="cc-row-avatar">{avatar}</div>
      <div className="cc-row-info">
        <span className="cc-row-name">
          {client.company || client.name}
          {issues.length > 0 && (
            <span className="cc-row-attn-dot" title={issues.join(' · ')}></span>
          )}
        </span>
        {primaryContact && (
          <span className="cc-row-contact">
            {primaryContact.name}
            {primaryContact.role ? ` · ${primaryContact.role}` : ''}
          </span>
        )}
      </div>
      <div className="cc-row-right">
        <span className={`cc-row-badge ${statusInfo.className}`}>
          {statusInfo.label}
        </span>
        <span className="cc-row-date">{lastActiveStr}</span>
        <span
          className="cc-row-link"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
        >
          Open →
        </span>
      </div>
    </div>
  );
}
