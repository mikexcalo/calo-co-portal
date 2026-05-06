'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DB, loadClients, createContact, createContactNote } from '@/lib/database';
import supabase from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { formatPhone } from '@/lib/utils';
import { PageShell, PageHeader, DataCard, TableHeader, TableRow, TableCell, CtaButton } from '@/components/shared/Brand';
import { AddContactWithClientPicker } from '@/components/shared/AddContactWithClientPicker';
import { StatusPill, colorMap } from '@/components/shared/StatusPill';
import { DropNotesPanel } from '@/components/shared/DropNotesPanel';
import type { ParsedContact } from '@/lib/api';

interface ContactRow {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  clientId: string | null;
  kind: string;
  isPrimaryContact: boolean;
}

const avatarBgs = ['#e8d5b7', '#c4d4c8', '#d4c4d8', '#c4cdd8', '#d8c4c4'];
const avatarFgs = ['#6b4a1a', '#2d4a3a', '#4a2d4a', '#2d3a4a', '#4a2d2d'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

function avatarColor(name: string): { bg: string; fg: string } {
  const idx = (name.charCodeAt(0) || 0) % 5;
  return { bg: avatarBgs[idx], fg: avatarFgs[idx] };
}

export default function ContactsPage() {
  const router = useRouter();
  const { t } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [addingContact, setAddingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [kindFilter, setKindFilter] = useState<string>('all');

  useEffect(() => {
    const init = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();

      const nameMap: Record<string, string> = {};
      for (const c of DB.clients) {
        nameMap[c.id] = c.company || c.name;
      }
      setClientNames(nameMap);

      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, role, email, phone, client_id, kind, is_primary_contact')
        .order('name', { ascending: true });

      if (error) {
        console.error('[ContactsPage] load error:', error);
      }

      setContacts(
        (data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          role: c.role ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          clientId: c.client_id ?? null,
          kind: c.kind ?? 'lead',
          isPrimaryContact: c.is_primary_contact ?? false,
        }))
      );
      setIsLoading(false);
    };
    init();
  }, []);

  if (isLoading) return null;

  return (
    <PageShell>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <DropNotesPanel
              onAdd={async (parsed: ParsedContact[]) => {
                for (const p of parsed) {
                  try {
                    const created = await createContact({ name: p.name, role: p.role || undefined, email: p.email || undefined, phone: p.phone || undefined, kind: p.kind });
                    if (p.note) {
                      try { await createContactNote(created.id, p.note); } catch (e) { console.error('Failed to save contact note:', e); }
                    }
                    setContacts((prev) => [...prev, {
                      id: created.id, name: created.name, role: created.role, email: created.email,
                      phone: created.phone, clientId: created.clientId, kind: created.kind, isPrimaryContact: created.isPrimaryContact,
                    }]);
                  } catch (e) { console.error('Failed to create contact:', e); }
                }
                setContacts((prev) => [...prev].sort((a, b) => a.name.localeCompare(b.name)));
              }}
            />
            <CtaButton onClick={() => setAddingContact(true)}>+ Add Contact</CtaButton>
          </div>
        }
      />

      {addingContact && (
        <AddContactWithClientPicker
          clients={DB.clients.map((c) => ({ id: c.id, name: c.company || c.name })).sort((a, b) => a.name.localeCompare(b.name))}
          saving={savingContact}
          onCancel={() => setAddingContact(false)}
          onSave={async (clientId, data) => {
            setSavingContact(true);
            try {
              const created = await createContact({ ...data, clientId });
              setContacts((prev) => [...prev, {
                id: created.id,
                name: created.name,
                role: created.role,
                email: created.email,
                phone: created.phone,
                clientId: created.clientId,
                kind: created.kind,
                isPrimaryContact: created.isPrimaryContact,
              }].sort((a, b) => a.name.localeCompare(b.name)));
              setAddingContact(false);
            } catch (e) {
              console.error('Failed to create contact:', e);
              alert('Failed to create contact. Please try again.');
            }
            setSavingContact(false);
          }}
        />
      )}

      {/* Kind filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([
          { key: 'all', label: 'All' },
          { key: 'lead', label: 'Lead' },
          { key: 'prospect', label: 'Prospect' },
          { key: 'client_contact', label: 'Client contact' },
          { key: 'vendor', label: 'Vendor' },
          { key: 'talent', label: 'Talent' },
          { key: 'friend', label: 'Friend' },
        ] as const).map((chip) => {
          const count = chip.key === 'all' ? contacts.length : contacts.filter((c) => c.kind === chip.key).length;
          const isActive = kindFilter === chip.key;
          const chipColors = chip.key !== 'all' ? (colorMap as any)[chip.key] : null;
          return (
            <button
              key={chip.key}
              onClick={() => setKindFilter(isActive && chip.key !== 'all' ? 'all' : chip.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 12, fontSize: 12, fontWeight: 500,
                fontFamily: 'inherit', cursor: 'pointer', transition: 'all 150ms',
                border: isActive ? 'none' : `1px solid ${t.border.default}`,
                background: isActive ? (chipColors?.bg || t.text.primary) : 'transparent',
                color: isActive ? (chipColors?.text || t.bg.surface) : t.text.secondary,
              }}
            >
              {chip.label} ({count})
            </button>
          );
        })}
      </div>

      <DataCard noPadding>
        <TableHeader columns={[
          { label: '', flex: 0.3 },
          { label: 'Name', flex: 2 },
          { label: 'Type', flex: 0.8 },
          { label: 'Client', flex: 1.5 },
          { label: 'Email', flex: 1.5 },
          { label: 'Phone', flex: 1.2 },
          { label: '', flex: 0.3 },
        ]} />

        {(kindFilter === 'all' ? contacts : contacts.filter((c) => c.kind === kindFilter)).map((contact) => {
          const { bg, fg } = avatarColor(contact.name);
          const parentName = contact.clientId ? clientNames[contact.clientId] : null;

          return (
            <TableRow key={contact.id} onClick={() => router.push(`/contacts/${contact.id}`)}>
              <div style={{ flex: 0.3, display: 'flex', alignItems: 'center', marginRight: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 16, overflow: 'hidden',
                  background: bg, color: fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>
                  {getInitials(contact.name)}
                </div>
              </div>

              <TableCell flex={2} primary>
                <div style={{ minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.name}</div>
                  {contact.role && (
                    <div style={{ fontSize: 11, color: t.text.tertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {contact.role}
                    </div>
                  )}
                </div>
              </TableCell>

              <div style={{ flex: 0.8 }}>
                <StatusPill status={contact.kind as any} />
              </div>

              <TableCell flex={1.5}>
                {parentName ? (
                  <span style={{ color: t.text.secondary }}>{parentName}</span>
                ) : (
                  <span style={{ color: t.text.tertiary }}>—</span>
                )}
              </TableCell>

              <TableCell flex={1.5}>
                <span style={{ color: contact.email ? t.text.secondary : t.text.tertiary }}>
                  {contact.email || '—'}
                </span>
              </TableCell>

              <TableCell flex={1.2}>{formatPhone(contact.phone || '')}</TableCell>

              <div style={{ flex: 0.3, display: 'flex', justifyContent: 'flex-end' }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.5"><path d="M6 4l4 4-4 4"/></svg>
              </div>
            </TableRow>
          );
        })}

        {(kindFilter === 'all' ? contacts : contacts.filter((c) => c.kind === kindFilter)).length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: t.text.tertiary, fontSize: 13 }}>
            {kindFilter !== 'all' ? 'No contacts match this filter' : 'No contacts yet'}
          </div>
        )}
      </DataCard>
    </PageShell>
  );
}
