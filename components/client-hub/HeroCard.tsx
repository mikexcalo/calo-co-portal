'use client';

import { useState } from 'react';
import { Client, Contact } from '@/lib/types';
import ContactChips from './ContactChips';

interface HeroCardProps {
  client: Client;
  contacts: Contact[];
  isClient: boolean;
  onClientUpdate: (client: Client) => void;
}

export default function HeroCard({
  client,
  contacts,
  isClient,
  onClientUpdate,
}: HeroCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  const addressLine = [client.address, client.city].filter(Boolean).join(', ');
  const isIncomplete = !client.company || !client.email || !client.phone;

  const clientLogo = client.logo ? (
    <img src={client.logo} alt={client.name} style={{ width: 56, height: 56, borderRadius: 8 }} />
  ) : (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 8,
        background: '#e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        fontWeight: 700,
        color: '#475569',
      }}
    >
      {(client.company || client.name).charAt(0).toUpperCase()}
    </div>
  );

  return (
    <div className="client-hd-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        {clientLogo}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="client-hd-name">{client.company || client.name}</div>

          {isIncomplete && (
            <div
              onClick={() => setIsEditOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                marginTop: '4px',
              }}
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: '#cbd5e1',
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 400 }}>
                Profile incomplete
              </span>
            </div>
          )}

          {addressLine && <div className="client-hd-detail">{addressLine}</div>}
        </div>

        {!isClient && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setIsEditOpen(true)}
              style={{ marginLeft: 'auto', flexShrink: 0 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Client
            </button>
          </div>
        )}
      </div>

      {/* Contact chips section */}
      <ContactChips contacts={contacts} clientId={client.id} isClient={isClient} />
    </div>
  );
}
