'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Client, Contact, BrandKit } from '@/lib/types';
import { DB, loadClients, loadContacts, loadAllBrandKits, saveClient } from '@/lib/database';
import SignatureFields from '@/components/email-signature/SignatureFields';
import SignaturePreview from '@/components/email-signature/SignaturePreview';
import styles from './email-signature.module.css';

export default function EmailSignaturePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);

      if (DB.clientsState !== 'loaded') {
        await loadClients();
      }

      if (!DB.contacts[clientId]) {
        await loadContacts(clientId);
      }

      await loadAllBrandKits();

      const foundClient = DB.clients.find((c) => c.id === clientId);
      if (foundClient) {
        setClient(foundClient);
        setContacts(DB.contacts[clientId] || []);
      } else {
        router.push('/clients');
      }

      setIsLoading(false);
    };

    initData();
  }, [clientId, router]);

  const handleSignatureSave = async (updates: any) => {
    if (!client) return;

    setIsSaving(true);
    try {
      const updatedClient = {
        ...client,
        ...updates,
      };

      await saveClient(updatedClient);
      setClient(updatedClient);
    } catch (error) {
      console.error('Error saving signature:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page">
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          Loading email signature...
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="page">
        <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
          Client not found.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <button
        onClick={() => router.push(`/clients/${clientId}`)}
        style={{
          background: 'none', border: 'none', color: '#6366f1', fontSize: '13px',
          fontWeight: 500, cursor: 'pointer', padding: 0, marginBottom: '16px',
          display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'Inter, sans-serif',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back to {client.company || client.name}
      </button>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px', color: '#0f172a' }}>Email Signature</h1>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>{client.company || client.name}</p>
      </div>

      <div className={styles.esigLayout}>
        <SignatureFields
          clientId={clientId}
          client={client}
          contacts={contacts}
          brandKit={client.brandKit}
          onSave={handleSignatureSave}
          isSaving={isSaving}
        />

        <SignaturePreview
          client={client}
          contacts={contacts}
          brandKit={client.brandKit}
          signatureFields={client.signatureFields || {}}
          emailSignatureHtml={client.emailSignatureHtml || ''}
        />
      </div>
    </div>
  );
}
