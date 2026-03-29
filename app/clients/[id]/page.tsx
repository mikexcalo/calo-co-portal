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

  // Listen for view mode changes from the nav toggle
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('viewMode') : null;
    setIsClient(stored === 'client');

    const handler = (e: Event) => {
      const mode = (e as CustomEvent).detail;
      setIsClient(mode === 'client');
    };
    window.addEventListener('viewModeChange', handler);
    return () => window.removeEventListener('viewModeChange', handler);
  }, []);

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);

      if (DB.clientsState !== 'loaded') await loadClients();
      if (!DB.contacts[clientId]) await loadContacts(clientId);

      // Only reload invoices if not already cached for this client
      const hasInvoices = DB.invoices.some((i) => i.clientId === clientId);
      if (!hasInvoices) await loadInvoices(clientId);

      // Brand kits: skip if any client already has brand kit data loaded
      const hasBk = DB.clients.some((c) => c.brandKit?._id);
      if (!hasBk) await loadAllBrandKits();

      const foundClient = DB.clients.find((c) => c.id === clientId);
      if (foundClient) {
        setClient(foundClient);
        setContacts(DB.contacts[clientId] || []);
        setInvoices(DB.invoices.filter((i) => i.clientId === clientId));
      } else {
        router.push('/');
      }

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
