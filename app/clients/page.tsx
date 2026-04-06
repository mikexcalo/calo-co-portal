'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DB, loadClients, loadContacts, loadInvoices } from '@/lib/database';
import { Client, Contact } from '@/lib/types';
import { useTheme } from '@/lib/theme';
import HelmSpinner from '@/components/shared/HelmSpinner';
import { invTotal } from '@/lib/utils';
import { motion } from 'framer-motion';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } } };

export default function ClientsPage() {
  const router = useRouter();
  const { t } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact[]>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    const init = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      for (const c of DB.clients) {
        if (!DB.contacts[c.id]) await loadContacts(c.id);
        const hasInv = DB.invoices.some((i) => i.clientId === c.id);
        if (!hasInv) await loadInvoices(c.id).catch(() => {});
      }
      setClients(DB.clients);
      setContacts({ ...DB.contacts });
      setIsLoading(false);
    };
    init();
  }, []);

  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 0 }}><HelmSpinner size={32} /></div>;

  const sorted = [...clients].sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name));

  const filtered = search.trim()
    ? sorted.filter((c) => {
        const q = search.toLowerCase();
        const ct = contacts[c.id] || [];
        const primary = ct.find((x) => x.isPrimary) || ct[0];
        return (c.company || c.name || '').toLowerCase().includes(q) || (primary?.name || '').toLowerCase().includes(q);
      })
    : sorted;

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* Header */}
        <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Clients</h1>
            <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => router.push('/clients/new')} style={{
            background: t.accent.primary, color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'background 150ms',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = t.accent.primaryHover}
          onMouseLeave={(e) => e.currentTarget.style.background = t.accent.primary}
          >+ Add Client</button>
        </motion.div>

        {/* Search */}
        <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            style={{
              width: 300, padding: '10px 14px', fontSize: 14,
              background: t.bg.surface, border: `1px solid ${t.border.default}`,
              borderRadius: 8, color: t.text.primary, fontFamily: 'inherit', outline: 'none',
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = t.border.active}
            onBlur={(e) => e.currentTarget.style.borderColor = t.border.default}
          />
        </motion.div>

        {/* Client list */}
        <motion.div variants={fadeUp}>
          <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 24px',
              padding: '10px 16px', gap: 12,
              borderBottom: `1px solid ${t.border.default}`,
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Company</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
              <span />
            </div>

            {/* Client rows */}
            {filtered.map((client, i) => {
              const ct = contacts[client.id] || [];
              const primary = ct.find((c) => c.isPrimary) || ct[0];
              const clientInvs = DB.invoices.filter((inv) => inv.clientId === client.id);
              const unpaid = clientInvs.filter((inv) => inv.status === 'unpaid' || inv.status === 'overdue');
              const brandColor = (typeof client.brandKit?.colors?.[0] === 'string' ? client.brandKit.colors[0] : null) || t.text.tertiary;

              let statusText = 'No invoices';
              let statusColor = t.text.tertiary;
              if (unpaid.length > 0) {
                statusText = `${unpaid.length} inv due`;
                statusColor = t.status.warning;
              } else if (clientInvs.length > 0) {
                statusText = 'All paid';
                statusColor = t.status.success;
              }

              return (
                <div key={client.id}
                  onClick={() => router.push(`/clients/${client.id}`)}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 24px',
                    padding: '14px 16px', gap: 12, alignItems: 'center',
                    borderBottom: i < filtered.length - 1 ? `1px solid ${t.border.default}` : 'none',
                    cursor: 'pointer', transition: 'background 150ms',
                  }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = t.bg.surfaceHover}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  {/* Company */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                      background: client.logo ? 'transparent' : brandColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 13, fontWeight: 700,
                    }}>
                      {client.logo
                        ? <img src={client.logo} alt="" style={{ width: 36, height: 36, objectFit: 'cover' }} />
                        : (client.company || client.name).charAt(0).toUpperCase()
                      }
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.company || client.name}
                    </span>
                  </div>

                  {/* Contact */}
                  <div style={{ minWidth: 0 }}>
                    {primary ? (
                      <>
                        <div style={{ fontSize: 13, color: t.text.primary }}>{primary.name}</div>
                        {(primary.title || primary.role) && <div style={{ fontSize: 12, color: t.text.secondary }}>{primary.title || primary.role}</div>}
                        {(primary.phone || primary.email) && <div style={{ fontSize: 12, color: t.text.tertiary }}>{primary.phone || primary.email}</div>}
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: t.text.tertiary }}>No contact</span>
                    )}
                  </div>

                  {/* Status */}
                  <div style={{ fontSize: 12, color: statusColor }}>{statusText}</div>

                  {/* Chevron */}
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.5">
                    <polyline points="6 4 10 8 6 12"/>
                  </svg>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: t.text.tertiary }}>
                {search ? `No clients match "${search}"` : 'No clients yet'}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
