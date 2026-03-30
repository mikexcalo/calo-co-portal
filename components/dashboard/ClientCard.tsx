import React from 'react';
import { Client } from '@/lib/types';
import { initials } from '@/lib/utils';
import { DB } from '@/lib/database';

interface ClientCardProps {
  client: Client;
  onNavigate: () => void;
}

export default function ClientCard({ client, onNavigate }: ClientCardProps) {
  const contacts = DB.contacts[client.id] || [];
  const primary = contacts.find((c) => c.isPrimary) || contacts[0] || null;
  const logoUrl = client.logo;

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div className="cc-row-avatar" style={logoUrl ? { background: 'transparent' } : undefined}>
        {logoUrl ? (
          <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : initials(client.company || client.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f2e', lineHeight: 1.3 }}>
          {client.company || client.name}
        </div>
        {primary && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {primary.name}{primary.role ? ` · ${primary.role}` : ''}
          </div>
        )}
      </div>
      <button onClick={onNavigate} style={{
        background: 'none', border: 'none', padding: 0,
        color: '#2563eb', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        fontFamily: 'Inter, sans-serif', flexShrink: 0, whiteSpace: 'nowrap',
      }}>Manage →</button>
    </div>
  );
}
