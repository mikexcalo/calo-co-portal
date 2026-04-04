'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DB, loadClients, loadContacts } from '@/lib/database';
import { Client, Contact } from '@/lib/types';
import { PageLayout, Section, CardGrid, Card } from '@/components/shared/PageLayout';

export default function ClientsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact[]>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    const init = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      for (const c of DB.clients) {
        if (!DB.contacts[c.id]) await loadContacts(c.id);
      }
      setClients(DB.clients);
      setContacts({ ...DB.contacts });
      setIsLoading(false);
    };
    init();
  }, []);

  if (isLoading) {
    return <div style={{ padding: 32, color: '#6b7280', fontSize: 13 }}>Loading clients...</div>;
  }

  const sorted = [...clients]
    .sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name));

  const filtered = search.trim()
    ? sorted.filter((c) => {
        const q = search.toLowerCase();
        const ct = contacts[c.id] || [];
        const primary = ct.find((x) => x.isPrimary) || ct[0];
        return (
          (c.company || c.name || '').toLowerCase().includes(q) ||
          (primary?.name || '').toLowerCase().includes(q)
        );
      })
    : sorted;

  return (
    <PageLayout
      title="Clients"
      subtitle={`${clients.length} client${clients.length !== 1 ? 's' : ''}`}
      action={
        <button
          onClick={() => router.push('/clients/new')}
          style={{
            background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + Add Client
        </button>
      }
    >
      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          style={{
            width: '100%', maxWidth: 360, padding: '10px 14px',
            border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14,
            color: '#111827', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Client grid */}
      <CardGrid columns={3}>
        {filtered.map((client) => {
          const ct = contacts[client.id] || [];
          const primary = ct.find((c) => c.isPrimary) || ct[0];
          return (
            <Card key={client.id} onClick={() => router.push(`/clients/${client.id}`)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {client.logo ? (
                  <img src={client.logo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: '#f1f3f5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, color: '#475569', flexShrink: 0,
                  }}>
                    {(client.company || client.name).charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {client.company || client.name}
                  </div>
                  {primary && (
                    <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 1 }}>{primary.name}</div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </CardGrid>

      {filtered.length === 0 && search && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          No clients match "{search}"
        </div>
      )}
    </PageLayout>
  );
}
