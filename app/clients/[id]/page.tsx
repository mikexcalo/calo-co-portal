'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Client, Contact, Invoice, Note, Task, Event as CrmEvent, CrmContact } from '@/lib/types';
import { DB, loadClients, loadContacts, loadInvoices, loadAllBrandKits, saveClient, saveContact, loadClientNotes, createClientNote, deleteNote, loadClientContacts, createClientContact, loadClientTasks, createClientTask, setTaskCompleted, deleteTask, loadClientEvents, createClientEvent, deleteEvent } from '@/lib/database';
import { clientStats, currency, invTotal } from '@/lib/utils';
import { PageLayout, Section, CardGrid, Card, InfoBar } from '@/components/shared/PageLayout';
import { useTheme } from '@/lib/theme';
import { Composer } from '@/components/shared/Composer';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { ContactsList } from '@/components/shared/ContactsList';
import { AddContactInline } from '@/components/shared/AddContactInline';
import { TasksList } from '@/components/shared/TasksList';
import { AddTaskInline } from '@/components/shared/AddTaskInline';
import { EventsList } from '@/components/shared/EventsList';
import { AddEventInline } from '@/components/shared/AddEventInline';
import { TranscriptParser } from '@/components/shared/TranscriptParser';
import { ClientEditPanel } from '@/components/shared/ClientEditPanel';
import type { TranscriptEvent } from '@/lib/api';

export default function ClientHubPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteSaving, setNoteSaving] = useState(false);
  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
  const [addingContact, setAddingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [addingTask, setAddingTask] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [events, setEvents] = useState<CrmEvent[]>([]);
  const [addingEvent, setAddingEvent] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const { t } = useTheme();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

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

      const [loadedNotes, loadedCrmContacts, loadedTasks, loadedEvents] = await Promise.all([
        loadClientNotes(clientId),
        loadClientContacts(clientId),
        loadClientTasks(clientId),
        loadClientEvents(clientId),
      ]);
      setNotes(loadedNotes);
      setCrmContacts(loadedCrmContacts);
      setTasks(loadedTasks);
      setEvents(loadedEvents);

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

  if (isLoading) return null;

  if (!client) {
    return (
      <div style={{ padding: 32, fontSize: 13, color: t.status.danger }}>
        Client not found.
      </div>
    );
  }

  const primary = contacts.find((c) => c.isPrimary) || contacts[0];
  const stats = clientStats(invoices, clientId);
  const nameParts = (primary?.name || '').split(/\s+/);

  // --- Profile completeness ---
  const missing: string[] = [];
  if (!primary?.name || !primary.name.includes(' ')) {
    if (!nameParts[0]) missing.push('First Name');
    if (!nameParts[1]) missing.push('Last Name');
  }
  if (!primary?.email && !client.email) missing.push('Email');
  const bk = client.brandKit;
  const hasLogos = bk && Object.values(bk.logos || {}).some((a: any) => a?.length > 0);
  if (!hasLogos) missing.push('Brand Kit logos');
  if (!bk?.colors?.length) missing.push('Brand colors');

  // --- Module metadata ---
  const logoSlots = client.brandKit?.logos || {};
  const logoCount = (['color', 'light', 'dark', 'icon', 'secondary', 'favicon'] as const).filter(
    (slot) => (logoSlots[slot] || []).length > 0
  ).length;
  const bkColors = client.brandKit?.colors?.length || 0;
  const hasBkFonts = !!(client.brandKit?.fonts?.heading || client.brandKit?.fonts?.body || client.brandKit?.fonts?.accent);
  let bkBits: string[] = [];
  if (logoCount > 0) bkBits.push(`${logoCount} logos`);
  if (bkColors > 0) bkBits.push(`${bkColors} colors`);
  if (hasBkFonts) bkBits.push('Fonts');
  const bkMeta = bkBits.length > 0 ? bkBits.join(' · ') : 'Not started';

  const invCount = invoices.length;
  const invMeta = invCount === 0 ? 'No invoices' : `${invCount} inv · ${currency(stats.outstanding)} due`;

  const finScopeRev = invoices.filter((i) => !i.isReimbursement).reduce((s, i) => s + invTotal(i), 0);
  const finMeta = finScopeRev > 0 ? `${currency(finScopeRev)} rev` : 'Revenue · P&L';

  return (
    <PageLayout>
      {/* Client info bar */}
      <InfoBar>
        {client.logo ? (
          <img src={client.logo} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 10, background: t.bg.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: t.text.secondary, flexShrink: 0 }}>
            {(client.company || client.name).charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: t.text.primary }}>{client.company || client.name}</div>
          {missing.length === 0 ? (
            <span style={{ fontSize: 13, color: t.status.success }}>Profile complete</span>
          ) : (
            <span style={{ fontSize: 13, color: t.status.warning }}>Missing: {missing.join(', ')}</span>
          )}
        </div>
        {!isClient && (
          <button onClick={() => setIsEditOpen(true)} style={{
            background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
            padding: '6px 14px', fontSize: 13, fontWeight: 500, color: t.text.secondary,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Edit Client</button>
        )}
      </InfoBar>

      {isEditOpen && (
        <ClientEditPanel
          client={client}
          primaryContact={primary || null}
          saving={editSaving}
          onCancel={() => setIsEditOpen(false)}
          onSave={async (form) => {
            setEditSaving(true);
            const derivedCode = form.code || (() => {
              const initials = form.company.split(/\s+/).map((w: string) => w[0]).filter(Boolean).join('').toUpperCase();
              return (initials.length >= 2 && initials.length <= 5) ? initials : form.company.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4);
            })();
            const updated = {
              ...client, company: form.company, name: form.company,
              email: form.email, phone: form.businessPhone, website: form.website,
              address_line_1: form.address_line_1, address_line_2: form.address_line_2,
              city: form.city, state: form.state, postal_code: form.postal_code,
              code: derivedCode,
            };
            await saveClient(updated);
            const contactName = `${form.firstName.trim()} ${form.lastName.trim()}`;
            const contactData = { clientId: client.id, name: contactName, role: form.title, email: form.email, phone: form.contactPhone, isPrimary: true };
            if (primary?.id) {
              await saveContact({ id: primary.id, ...contactData });
              const cIdx = (DB.contacts[client.id] || []).findIndex((c) => c.id === primary.id);
              if (cIdx >= 0) DB.contacts[client.id][cIdx] = { ...DB.contacts[client.id][cIdx], ...contactData };
            } else {
              const nc = await saveContact(contactData);
              if (nc) DB.contacts[client.id] = [nc];
            }
            const idx = DB.clients.findIndex((c) => c.id === client.id);
            if (idx >= 0) DB.clients[idx] = updated;
            setClient(updated);
            setContacts([...(DB.contacts[client.id] || [])]);
            setIsEditOpen(false);
            setEditSaving(false);
          }}
        />
      )}

      {/* Two-column: Tasks + Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        <div>
          {/* Transcript parser */}
          <TranscriptParser
            existingEvents={events}
            onAddItems={async (newEvents: TranscriptEvent[], taskData) => {
              // 1. Create events first
              const createdEvents: CrmEvent[] = [];
              for (const ev of newEvents) {
                if (!ev.eventDate) continue;
                try {
                  const created = await createClientEvent(clientId, {
                    title: ev.title,
                    eventDate: ev.eventDate,
                    location: ev.location || undefined,
                    description: ev.description || undefined,
                  });
                  createdEvents.push(created);
                } catch (e) {
                  console.error('Failed to create event from transcript:', e);
                }
              }
              // Update events state
              setEvents((prev) => [...prev, ...createdEvents].sort((a, b) => a.eventDate.localeCompare(b.eventDate)));

              // 2. Build title->id map from both existing and newly created events
              const titleToId: Record<string, string> = {};
              for (const ev of [...events, ...createdEvents]) {
                titleToId[ev.title.toLowerCase()] = ev.id;
              }

              // 3. Create tasks, resolving anchorEventTitle to eventId
              for (const tk of taskData) {
                const anchor = (tk as any).anchorEventTitle;
                let eventId: string | null = null;
                let leadDays: number | null = tk.leadDays;
                if (anchor && typeof anchor === 'string') {
                  eventId = titleToId[anchor.toLowerCase()] || null;
                  if (!eventId) leadDays = null; // can't anchor without a matching event
                }
                try {
                  const created = await createClientTask(clientId, {
                    title: tk.title,
                    dueDate: tk.dueDate,
                    eventId,
                    leadDays: eventId ? leadDays : null,
                  });
                  setTasks((prev) => [created, ...prev]);
                } catch (e) {
                  console.error('Failed to create task from transcript:', e);
                }
              }
            }}
          />

          {/* Events section */}
          <div style={{ marginBottom: 20 }}>
            <EventsList
              events={events}
              taskCountsByEventId={tasks.reduce<Record<string, number>>((acc, tk) => {
                if (tk.eventId) acc[tk.eventId] = (acc[tk.eventId] || 0) + 1;
                return acc;
              }, {})}
              onAddClick={() => setAddingEvent(true)}
              onDelete={async (eventId) => {
                const prevEvents = events;
                setEvents((ev) => ev.filter((e) => e.id !== eventId));
                try {
                  await deleteEvent(eventId);
                  // Re-fetch tasks since anchored tasks lost their event_id (FK ON DELETE SET NULL)
                  const refreshed = await loadClientTasks(clientId);
                  setTasks(refreshed);
                } catch (e) {
                  console.error('Failed to delete event:', e);
                  alert('Failed to delete event.');
                  setEvents(prevEvents);
                }
              }}
            />
            {addingEvent && (
              <AddEventInline
                saving={savingEvent}
                onCancel={() => setAddingEvent(false)}
                onSave={async (data) => {
                  setSavingEvent(true);
                  try {
                    const event = await createClientEvent(clientId, data);
                    setEvents((prev) => [...prev, event].sort((a, b) => a.eventDate.localeCompare(b.eventDate)));
                    setAddingEvent(false);
                  } catch (e) {
                    console.error('Failed to create event:', e);
                    alert('Failed to create event. Please try again.');
                  }
                  setSavingEvent(false);
                }}
              />
            )}
          </div>

          {/* Tasks section */}
          <div style={{ marginBottom: 20 }}>
            <TasksList
              tasks={tasks}
              events={events}
              onAddClick={() => setAddingTask(true)}
              onToggleComplete={async (taskId, completed) => {
                setTasks((prev) => prev.map((tk) =>
                  tk.id === taskId ? { ...tk, completedAt: completed ? new Date().toISOString() : null } : tk
                ));
                try {
                  await setTaskCompleted(taskId, completed);
                } catch (e) {
                  console.error('Failed to toggle task:', e);
                  setTasks((prev) => prev.map((tk) =>
                    tk.id === taskId ? { ...tk, completedAt: completed ? null : new Date().toISOString() } : tk
                  ));
                }
              }}
              onDelete={async (taskId) => {
                const prev = tasks;
                setTasks((tk) => tk.filter((x) => x.id !== taskId));
                try {
                  await deleteTask(taskId);
                } catch (e) {
                  console.error('Failed to delete task:', e);
                  alert('Failed to delete task.');
                  setTasks(prev);
                }
              }}
            />
            {addingTask && (
              <AddTaskInline
                events={events}
                saving={savingTask}
                onCancel={() => setAddingTask(false)}
                onSave={async (data) => {
                  setSavingTask(true);
                  try {
                    const task = await createClientTask(clientId, data);
                    setTasks((prev) => [task, ...prev]);
                    setAddingTask(false);
                  } catch (e) {
                    console.error('Failed to create task:', e);
                    alert('Failed to create task. Please try again.');
                  }
                  setSavingTask(false);
                }}
              />
            )}
          </div>

          {/* Activity section */}
          <Section label="Activity">
            <Composer
              saving={noteSaving}
              onSave={async (content) => {
                setNoteSaving(true);
                try {
                  const note = await createClientNote(clientId, content);
                  setNotes((prev) => [note, ...prev]);
                } catch (e) {
                  console.error('Failed to save note:', e);
                  alert('Failed to save note. Please try again.');
                }
                setNoteSaving(false);
              }}
            />
            <div style={{ marginTop: 16 }}>
              <ActivityTimeline
                notes={notes}
                onDelete={async (noteId) => {
                  try {
                    await deleteNote(noteId);
                    setNotes((prev) => prev.filter((n) => n.id !== noteId));
                  } catch (e) {
                    console.error('Failed to delete note:', e);
                    alert('Failed to delete note.');
                  }
                }}
              />
            </div>
          </Section>
        </div>

        <div>
          <div style={{ marginBottom: 20 }}>
            <ContactsList
              contacts={crmContacts}
              onAddClick={() => setAddingContact(true)}
            />
            {addingContact && (
              <AddContactInline
                saving={savingContact}
                onCancel={() => setAddingContact(false)}
                onSave={async (data) => {
                  setSavingContact(true);
                  try {
                    const contact = await createClientContact(clientId, data);
                    setCrmContacts((prev) => {
                      const updated = [...prev, contact];
                      updated.sort((a, b) => {
                        if (a.isPrimaryContact !== b.isPrimaryContact) return a.isPrimaryContact ? -1 : 1;
                        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                      });
                      return updated;
                    });
                    setAddingContact(false);
                  } catch (e) {
                    console.error('Failed to create contact:', e);
                    alert('Failed to create contact. Please try again.');
                  }
                  setSavingContact(false);
                }}
              />
            )}
          </div>

          <Section label="Quick links">
            <CardGrid columns={2}>
              <Card onClick={() => router.push(`/design?client=${clientId}`)}>
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke={t.text.secondary} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}><path d="M10.5 2L14 5.5 5.5 14H2v-3.5z" /><line x1="8.5" y1="4" x2="12" y2="7.5" /></svg>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>Design</div>
                <div style={{ fontSize: 13, color: t.text.tertiary }}>Create print + digital assets</div>
              </Card>
              <Card onClick={() => router.push(`/clients/${clientId}/brand-kit${isClient ? '?viewMode=view' : ''}`)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text.secondary} strokeWidth="1.3" style={{ marginBottom: 6 }}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2"/></svg>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>Brand Kit</div>
                <div style={{ fontSize: 13, color: t.text.tertiary }}>{bkMeta}</div>
              </Card>
              <Card onClick={() => router.push(`/clients/${clientId}/invoices`)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text.secondary} strokeWidth="1.3" style={{ marginBottom: 6 }}><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h4" strokeLinecap="round"/></svg>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>Invoices</div>
                <div style={{ fontSize: 13, color: t.text.tertiary }}>{invMeta}</div>
              </Card>
              {!isClient && (
                <Card onClick={() => router.push(`/clients/${clientId}/financials`)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text.secondary} strokeWidth="1.3" style={{ marginBottom: 6 }}><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="17" x2="7" y2="12" strokeLinecap="round"/><line x1="12" y1="17" x2="12" y2="8" strokeLinecap="round"/><line x1="17" y1="17" x2="17" y2="13" strokeLinecap="round"/></svg>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>Financials</div>
                  <div style={{ fontSize: 13, color: t.text.tertiary }}>{finMeta}</div>
                </Card>
              )}
            </CardGrid>
          </Section>
        </div>
      </div>
    </PageLayout>
  );
}
