'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Note, Task, Event as CrmEvent, CrmContact, Client } from '@/lib/types';
import {
  DB, loadClients, saveClient,
  loadContactById, loadContactNotes, createContactNote, deleteNote,
  loadContactTasks, createContactTask, setTaskCompleted, deleteTask,
  loadContactEvents, createContactEvent, deleteEvent,
  updateContactKindAndClient,
} from '@/lib/database';
import supabase from '@/lib/supabase';
import { PageLayout, Section, InfoBar } from '@/components/shared/PageLayout';
import { useTheme } from '@/lib/theme';
import { Composer } from '@/components/shared/Composer';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { TasksList } from '@/components/shared/TasksList';
import { AddTaskInline } from '@/components/shared/AddTaskInline';
import { EventsList } from '@/components/shared/EventsList';
import { AddEventInline } from '@/components/shared/AddEventInline';
import { StatusPill } from '@/components/shared/StatusPill';
import { PromoteContactModal } from '@/components/shared/PromoteContactModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { TranscriptEvent } from '@/lib/api';
import { TranscriptParser } from '@/components/shared/TranscriptParser';

const avatarBgs = ['#e8d5b7', '#c4d4c8', '#d4c4d8', '#c4cdd8', '#d8c4c4'];
const avatarFgs = ['#6b4a1a', '#2d4a3a', '#4a2d4a', '#2d3a4a', '#4a2d2d'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;
  const { t } = useTheme();

  const [contact, setContact] = useState<CrmContact | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteSaving, setNoteSaving] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [addingTask, setAddingTask] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [events, setEvents] = useState<CrmEvent[]>([]);
  const [addingEvent, setAddingEvent] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPromote, setShowPromote] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      if (DB.clientsState !== 'loaded') await loadClients();
      const [ct, n, tk, ev] = await Promise.all([
        loadContactById(contactId),
        loadContactNotes(contactId),
        loadContactTasks(contactId),
        loadContactEvents(contactId),
      ]);
      if (!ct) { router.push('/contacts'); return; }
      setContact(ct);
      setNotes(n);
      setTasks(tk);
      setEvents(ev);
      setIsLoading(false);
      // Mark as read
      supabase.from('contacts').update({ unread: false }).eq('id', contactId).then(() => {});
    };
    init();
  }, [contactId, router]);

  if (isLoading || !contact) return null;

  const canPromote = contact.kind !== 'client_contact';
  const parentClient = contact.clientId ? DB.clients.find((c) => c.id === contact.clientId) : null;
  const avatarIdx = (contact.name.charCodeAt(0) || 0) % 5;

  const handlePromote = async (data: { mode: 'link'; clientId: string } | { mode: 'create'; name: string; website?: string }) => {
    setPromoting(true);
    try {
      let clientId: string;
      if (data.mode === 'link') {
        clientId = data.clientId;
      } else {
        const newClient: Client = {
          id: '', name: data.name, company: data.name,
          email: '', phone: '', website: data.website || '',
          address: '', address_line_1: '', address_line_2: '',
          city: '', state: '', postal_code: '',
          logo: null, activeModules: ['invoices'],
          hasBrandKit: false, hasEmailSig: false,
          engagementStatus: 'active', lifecycleStage: 'active',
          nextStep: '', emailSignatureHtml: '',
          signatureFields: {},
          brandKit: { _id: null, logos: { light: [], dark: [], color: [], icon: [], secondary: [], favicon: [] }, colors: [], fonts: { heading: '', body: '', accent: '' }, notes: '' },
        };
        const result = await saveClient(newClient);
        if (!result?.id) throw new Error('Failed to create client');
        clientId = result.id;
        newClient.id = clientId;
        DB.clients.push(newClient);
      }
      const updated = await updateContactKindAndClient(contactId, clientId, 'client_contact');
      setContact(updated);
      setShowPromote(false);
    } catch (e) {
      console.error('Promote failed:', e);
      alert('Failed to promote contact. Please try again.');
    }
    setPromoting(false);
  };

  return (
    <PageLayout>
      <InfoBar>
        <div style={{
          width: 40, height: 40, borderRadius: 20,
          background: avatarBgs[avatarIdx], color: avatarFgs[avatarIdx],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>
          {getInitials(contact.name)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: t.text.primary }}>{contact.name}</span>
            <StatusPill status={contact.kind as any} />
          </div>
          <div style={{ fontSize: 13, color: t.text.tertiary }}>
            {contact.role && <span>{contact.role}</span>}
            {contact.role && parentClient && <span> &middot; </span>}
            {parentClient && (
              <span
                style={{ cursor: 'pointer', color: t.accent.primary }}
                onClick={() => router.push(`/clients/${parentClient.id}`)}
              >
                {parentClient.company || parentClient.name}
              </span>
            )}
            {!contact.role && !parentClient && <span>No role or client</span>}
          </div>
        </div>
        {canPromote && (
          <button
            onClick={() => setShowPromote(true)}
            style={{
              background: t.accent.primary, color: '#fff', border: 'none', borderRadius: 8,
              padding: '6px 14px', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Promote to client
          </button>
        )}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              width: 32, height: 32, borderRadius: 6, border: `1px solid ${t.border.default}`,
              background: t.bg.surface, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 18, color: t.text.secondary,
              fontFamily: 'inherit', lineHeight: 1,
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setMenuOpen(false)} />
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 11,
                background: t.bg.elevated, border: `1px solid ${t.border.default}`, borderRadius: 8,
                boxShadow: t.shadow.elevated, minWidth: 160, padding: 4, overflow: 'hidden',
              }}>
                <button
                  onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }}
                  style={{
                    width: '100%', padding: '8px 12px', border: 'none', background: 'transparent',
                    fontSize: 13, color: '#DC2626', fontWeight: 500, textAlign: 'left',
                    cursor: 'pointer', fontFamily: 'inherit', borderRadius: 4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Delete contact
                </button>
              </div>
            </>
          )}
        </div>
      </InfoBar>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        loading={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await supabase.from('contacts').delete().eq('id', contactId);
            router.push('/contacts');
          } catch (e) {
            console.error('Delete contact failed:', e);
            setDeleting(false);
          }
        }}
        title={`Delete ${contact.name}?`}
        body="This will permanently remove this contact from Helm. This can't be undone."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        <div>
          {/* Transcript parser */}
          <TranscriptParser
            existingEvents={events}
            onAddItems={async (newEvents: TranscriptEvent[], taskData) => {
              const createdEvents: CrmEvent[] = [];
              for (const ev of newEvents) {
                if (!ev.eventDate) continue;
                try {
                  const created = await createContactEvent(contactId, { title: ev.title, eventDate: ev.eventDate, location: ev.location || undefined, description: ev.description || undefined });
                  createdEvents.push(created);
                } catch (e) { console.error('Failed to create event:', e); }
              }
              setEvents((prev) => [...prev, ...createdEvents].sort((a, b) => a.eventDate.localeCompare(b.eventDate)));
              const titleToId: Record<string, string> = {};
              for (const ev of [...events, ...createdEvents]) titleToId[ev.title.toLowerCase()] = ev.id;
              for (const tk of taskData) {
                const anchor = (tk as any).anchorEventTitle;
                let eventId: string | null = null;
                let leadDays: number | null = tk.leadDays;
                if (anchor && typeof anchor === 'string') { eventId = titleToId[anchor.toLowerCase()] || null; if (!eventId) leadDays = null; }
                try {
                  const created = await createContactTask(contactId, { title: tk.title, dueDate: tk.dueDate, eventId, leadDays: eventId ? leadDays : null });
                  setTasks((prev) => [created, ...prev]);
                } catch (e) { console.error('Failed to create task:', e); }
              }
            }}
          />

          {/* Events */}
          <div style={{ marginBottom: 20 }}>
            <EventsList
              events={events}
              taskCountsByEventId={tasks.reduce<Record<string, number>>((acc, tk) => { if (tk.eventId) acc[tk.eventId] = (acc[tk.eventId] || 0) + 1; return acc; }, {})}
              onAddClick={() => setAddingEvent(true)}
              onDelete={async (eventId) => {
                const prev = events;
                setEvents((ev) => ev.filter((e) => e.id !== eventId));
                try { await deleteEvent(eventId); const refreshed = await loadContactTasks(contactId); setTasks(refreshed); }
                catch (e) { console.error('Failed to delete event:', e); setEvents(prev); }
              }}
            />
            {addingEvent && (
              <AddEventInline
                saving={savingEvent}
                onCancel={() => setAddingEvent(false)}
                onSave={async (data) => {
                  setSavingEvent(true);
                  try { const ev = await createContactEvent(contactId, data); setEvents((prev) => [...prev, ev].sort((a, b) => a.eventDate.localeCompare(b.eventDate))); setAddingEvent(false); }
                  catch (e) { console.error('Failed to create event:', e); alert('Failed to create event.'); }
                  setSavingEvent(false);
                }}
              />
            )}
          </div>

          {/* Tasks */}
          <div style={{ marginBottom: 20 }}>
            <TasksList
              tasks={tasks}
              events={events}
              onAddClick={() => setAddingTask(true)}
              onToggleComplete={async (taskId, completed) => {
                setTasks((prev) => prev.map((tk) => tk.id === taskId ? { ...tk, completedAt: completed ? new Date().toISOString() : null } : tk));
                try { await setTaskCompleted(taskId, completed); }
                catch (e) { setTasks((prev) => prev.map((tk) => tk.id === taskId ? { ...tk, completedAt: completed ? null : new Date().toISOString() } : tk)); }
              }}
              onDelete={async (taskId) => {
                const prev = tasks;
                setTasks((tk) => tk.filter((x) => x.id !== taskId));
                try { await deleteTask(taskId); } catch (e) { setTasks(prev); }
              }}
            />
            {addingTask && (
              <AddTaskInline
                events={events}
                saving={savingTask}
                onCancel={() => setAddingTask(false)}
                onSave={async (data) => {
                  setSavingTask(true);
                  try { const task = await createContactTask(contactId, data); setTasks((prev) => [task, ...prev]); setAddingTask(false); }
                  catch (e) { console.error('Failed to create task:', e); alert('Failed to create task.'); }
                  setSavingTask(false);
                }}
              />
            )}
          </div>

          {/* Activity */}
          <Section label="Activity">
            <Composer
              saving={noteSaving}
              onSave={async (content) => {
                setNoteSaving(true);
                try { const note = await createContactNote(contactId, content); setNotes((prev) => [note, ...prev]); }
                catch (e) { console.error('Failed to save note:', e); alert('Failed to save note.'); }
                setNoteSaving(false);
              }}
            />
            <div style={{ marginTop: 16 }}>
              <ActivityTimeline
                notes={notes}
                onDelete={async (noteId) => {
                  try { await deleteNote(noteId); setNotes((prev) => prev.filter((n) => n.id !== noteId)); }
                  catch (e) { console.error('Failed to delete note:', e); }
                }}
              />
            </div>
          </Section>
        </div>

        <div>
          {/* Contact info card */}
          <div style={{
            background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
            padding: '12px 16px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Details
            </div>
            {contact.email && (
              <div style={{ fontSize: 13, color: t.text.secondary, marginBottom: 4 }}>
                {contact.email}
              </div>
            )}
            {contact.phone && (
              <div style={{ fontSize: 13, color: t.text.secondary, marginBottom: 4 }}>
                {contact.phone}
              </div>
            )}
            {!contact.email && !contact.phone && (
              <div style={{ fontSize: 12, color: t.text.tertiary }}>No contact info</div>
            )}
          </div>
        </div>
      </div>

      {showPromote && (
        <PromoteContactModal
          contactName={contact.name}
          clients={DB.clients.map((c) => ({ id: c.id, name: c.company || c.name })).sort((a, b) => a.name.localeCompare(b.name))}
          existingClientId={contact.clientId}
          onPromote={handlePromote}
          onClose={() => setShowPromote(false)}
          promoting={promoting}
        />
      )}
    </PageLayout>
  );
}
