'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Client, Contact, Invoice } from '@/lib/types';
import { DB, loadClients, loadContacts, loadInvoices, loadAllBrandKits } from '@/lib/database';
import { clientStats, currency, initials } from '@/lib/utils';
import HeroCard from '@/components/client-hub/HeroCard';
import ContactChips from '@/components/client-hub/ContactChips';
import ManageAccess from '@/components/client-hub/ManageAccess';
import ModulesGrid from '@/components/client-hub/ModulesGrid';

export default function ClientHubPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);

      // Load clients
      if (DB.clientsState !== 'loaded') {
        await loadClients();
      }

      // Load contacts for this client
      if (!DB.contacts[clientId]) {
        await loadContacts(clientId);
      }

      // Load invoices for this client
      await loadInvoices(clientId);

      // Load brand kits
      await loadAllBrandKits();

      // Find the client
      const foundClient = DB.clients.find((c) => c.id === clientId);
      if (foundClient) {
        setClient(foundClient);
        setContacts(DB.contacts[clientId] || []);
        setInvoices(DB.invoices.filter((i) => i.clientId === clientId));
      } else {
        // Client not found, redirect to clients
        router.push('/clients');
      }

      // Check if viewing as client
      // TODO: Get actual view mode from context/auth
      setIsClient(false);

      setIsLoading(false);
    };

    initData();
  }, [clientId, router]);

  if (isLoading) {
    return (
      <div className="page">
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          Loading client data...
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

  const stats = clientStats(invoices, clientId);
  const invoiceCount = invoices.length;
  const invMeta =
    invoiceCount === 0
      ? 'No invoices yet'
      : `${invoiceCount} invoice${invoiceCount !== 1 ? 's' : ''} · ${currency(stats.outstanding)} outstanding`;

  return (
    <div className="page">
      <button
        onClick={() => router.push('/')}
        style={{
          background: 'none', border: 'none', color: '#6366f1', fontSize: '13px',
          fontWeight: 500, cursor: 'pointer', padding: 0, marginBottom: '16px',
          display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'Inter, sans-serif',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back to Dashboard
      </button>
      <HeroCard
        client={client}
        contacts={contacts}
        isClient={isClient}
        onClientUpdate={(updatedClient) => setClient(updatedClient)}
      />

      {!isClient && <ManageAccess clientId={clientId} client={client} />}

      <div className="section-hd" style={{ marginTop: '28px' }}>
        <div className="section-title">Modules</div>
      </div>

      <ModulesGrid
        client={client}
        clientId={clientId}
        invoices={invoices}
        isClient={isClient}
        stats={stats}
      />
    </div>
  );
}
