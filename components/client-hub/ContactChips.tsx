'use client';

import { useState } from 'react';
import { Contact } from '@/lib/types';
import { initials } from '@/lib/utils';
import { saveContact, deleteContact, loadContacts } from '@/lib/database';

interface ContactChipsProps {
  contacts: Contact[];
  clientId: string;
  isClient: boolean;
}

export default function ContactChips({ contacts, clientId, isClient }: ContactChipsProps) {
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    isPrimary: false,
  });
  const [error, setError] = useState('');

  const CHIP_SHOW = chipsExpanded ? localContacts.length : 4;
  const showChips = localContacts.slice(0, CHIP_SHOW);
  const extraCount = localContacts.length - CHIP_SHOW;

  const handleAddContact = () => {
    setFormData({
      name: '',
      role: '',
      email: '',
      phone: '',
      isPrimary: false,
    });
    setError('');
    setExpandedContactId('__add__');
  };

  const handleEditContact = (contact: Contact) => {
    setFormData({
      name: contact.name,
      role: contact.role || '',
      email: contact.email,
      phone: contact.phone,
      isPrimary: contact.isPrimary,
    });
    setError('');
    setExpandedContactId(contact.id || '');
  };

  const handleSaveContact = async () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      if (expandedContactId === '__add__') {
        // New contact
        const newContact: Contact = {
          clientId,
          name: formData.name,
          role: formData.role,
          email: formData.email,
          phone: formData.phone,
          isPrimary: formData.isPrimary,
        };
        const saved = await saveContact(newContact);
        if (saved) {
          await loadContacts(clientId);
          // Refresh local contacts
          const updatedContacts = localContacts.concat({
            id: saved.id,
            ...newContact,
          });
          setLocalContacts(updatedContacts);
          setExpandedContactId(null);
        }
      } else {
        // Edit existing contact
        const contactToUpdate = localContacts.find((c) => c.id === expandedContactId);
        if (contactToUpdate) {
          const updated: Contact = {
            ...contactToUpdate,
            name: formData.name,
            role: formData.role,
            email: formData.email,
            phone: formData.phone,
            isPrimary: formData.isPrimary,
          };
          await saveContact(updated);
          setLocalContacts(
            localContacts.map((c) => (c.id === expandedContactId ? updated : c))
          );
          setExpandedContactId(null);
        }
      }
    } catch (err) {
      setError('Failed to save contact');
    }
  };

  const handleDeleteContact = async () => {
    if (expandedContactId && expandedContactId !== '__add__') {
      try {
        await deleteContact(expandedContactId);
        setLocalContacts(localContacts.filter((c) => c.id !== expandedContactId));
        setExpandedContactId(null);
      } catch (err) {
        setError('Failed to delete contact');
      }
    }
  };

  return (
    <>
      <div className="cts-row">
        <span className="cts-label">Contacts</span>

        {localContacts.length === 0 ? (
          <span className="ct-chip-none">No contacts yet</span>
        ) : (
          <>
            {showChips.map((contact) => (
              <button
                key={contact.id}
                className={`ct-chip${contact.isPrimary ? ' primary' : ''}`}
                title={[contact.name, contact.role || contact.title, contact.email]
                  .filter(Boolean)
                  .join(' · ')}
                onClick={() => !isClient && handleEditContact(contact)}
              >
                {initials(contact.name)}
                {contact.isPrimary && <span className="ct-chip-dot" />}
              </button>
            ))}

            {extraCount > 0 && (
              <button
                className="ct-chip-more"
                onClick={() => setChipsExpanded(true)}
                title="Show all contacts"
              >
                +{extraCount}
              </button>
            )}
          </>
        )}

        {!isClient && (
          <button
            className="ct-chip-add"
            onClick={handleAddContact}
            title="Add contact"
          >
            +
          </button>
        )}
      </div>

      {/* Inline add/edit form */}
      {expandedContactId && !isClient && (
        <div className="ct-chip-form" onClick={(e) => e.stopPropagation()}>
          {expandedContactId === '__add__' && (
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', marginBottom: '10px' }}>
              New Contact
            </div>
          )}

          <div className="ct-edit-grid">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                placeholder="Full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Title / Role</label>
              <input
                className="form-input"
                placeholder="e.g. Designer"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
            <input
              type="checkbox"
              checked={formData.isPrimary}
              onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
              style={{ width: '14px', height: '14px', cursor: 'pointer' }}
            />
            <label style={{ fontSize: '12px', color: '#475569', cursor: 'pointer' }}>
              Primary contact
            </label>
          </div>

          {error && (
            <div style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: 500, marginBottom: '6px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
            {expandedContactId !== '__add__' && (
              <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={handleDeleteContact}>
                Delete
              </button>
            )}

            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setExpandedContactId(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveContact}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
