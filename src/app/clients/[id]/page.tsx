'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Client,
  Contact,
  Invoice,
  loadClients,
  loadContacts,
  loadInvoices,
  saveClient,
  saveContact,
  currency,
  isoToDisplay,
  initials,
} from '@/lib/db';

type EngagementStatus = 'active' | 'prospect' | 'delivered' | 'retained' | 'paused' | 'closed';

export default function ClientHubPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);

  // Form states
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [newContact, setNewContact] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    is_primary: false,
  });

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const clientsData = await loadClients();
        const foundClient = clientsData.find((c) => c.id === clientId);

        if (foundClient) {
          setClient(foundClient);
          setFormData(foundClient);

          const contactsData = await loadContacts(clientId);
          setContacts(contactsData);

          const invoicesData = await loadInvoices(clientId);
          setInvoices(invoicesData);
        }
      } catch (error) {
        console.error('Failed to load client data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clientId]);

  const handleEditToggle = () => {
    if (editMode) {
      setFormData(client || {});
    }
    setEditMode(!editMode);
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof Client
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSaveClient = async () => {
    const updated = await saveClient({
      ...formData,
      id: clientId,
    });
    if (updated) {
      setClient(updated);
      setEditMode(false);
    }
  };

  const handleSaveContact = async () => {
    const contact = await saveContact({
      ...newContact,
      client_id: clientId,
    });
    if (contact) {
      setContacts([...contacts, contact]);
      setNewContact({
        name: '',
        role: '',
        email: '',
        phone: '',
        is_primary: false,
      });
      setShowAddContact(false);
    }
  };

  const handleSetPrimaryContact = async (contactId: string) => {
    // Update all contacts: set the selected one as primary, others as secondary
    const updated = contacts.map((c) => ({
      ...c,
      is_primary: c.id === contactId,
    }));

    for (const contact of updated) {
      await saveContact(contact);
    }

    setContacts(updated);
  };

  if (loading) {
    return (
      <div className="max-w-[980px] mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-[#94a3b8]">Loading client data...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="max-w-[980px] mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-red-600">Client not found</p>
          <Link href="/" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const primaryContact = contacts.find((c) => c.is_primary);
  const secondaryContacts = contacts.filter((c) => !c.is_primary);

  const invoiceCount = invoices.length;
  const outstandingAmount = invoices
    .filter((inv) => inv.status !== 'paid')
    .reduce(
      (sum, inv) => sum + (inv.line_items?.items?.reduce((s, item) => s + item.quantity * item.price, 0) || 0),
      0
    );

  const getInitials = (name: string): string => {
    return initials(name);
  };

  const getInvoiceStatusColor = (
    status: string
  ): 'amber' | 'green' | 'red' | 'slate' => {
    switch (status) {
      case 'paid':
        return 'green';
      case 'overdue':
        return 'red';
      case 'draft':
      case 'sent':
        return 'amber';
      default:
        return 'slate';
    }
  };

  return (
    <div className="max-w-[980px] mx-auto p-8">
      {/* Client Header Card */}
      <div className="bg-white border border-[#e8e8e8] rounded-[10px] p-[20px_22px] mb-8">
        <div className="flex items-start gap-6 mb-6">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-[10px] bg-[#f0f0f0] border-[1.5px] border-[#e8e8e8] flex items-center justify-center flex-shrink-0">
            <span className="text-base font-bold text-[#0f172a]">
              {getInitials(client.name)}
            </span>
          </div>

          {/* Client Info */}
          <div className="flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-[18px] font-bold text-[#0f172a] mb-1">
                  {client.name}
                </h1>
                <p className="text-[13px] text-[#777] mb-2">{client.company}</p>
                <p className="text-[12px] text-[#94a3b8]">
                  {client.email} {client.phone && `• ${client.phone}`}
                  {client.address && ` • ${client.address}`}
                </p>
              </div>
              <button
                onClick={handleEditToggle}
                className="btn btn-ghost btn-sm"
              >
                {editMode ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>
        </div>

        {/* Contacts Chips Row */}
        {!editMode && (
          <>
            <div className="border-t border-[#f1f5f9] pt-3.5 mt-3.5">
              <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#cbd5e1] mb-3">
                CONTACTS
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                {primaryContact && (
                  <button
                    onClick={() =>
                      setExpandedContactId(
                        expandedContactId === primaryContact.id ? null : primaryContact.id
                      )
                    }
                    className="relative w-8 h-8 rounded-full bg-[#dcfce7] text-[#166534] flex items-center justify-center text-[12px] font-bold hover:shadow-sm transition-shadow"
                  >
                    {getInitials(primaryContact.name)}
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-white"></span>
                  </button>
                )}

                {secondaryContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() =>
                      setExpandedContactId(
                        expandedContactId === contact.id ? null : contact.id
                      )
                    }
                    className="w-8 h-8 rounded-full bg-[#e2e8f0] text-[#475569] flex items-center justify-center text-[12px] font-bold hover:shadow-sm transition-shadow"
                  >
                    {getInitials(contact.name)}
                  </button>
                ))}

                <button
                  onClick={() => setShowAddContact(true)}
                  className="w-8 h-8 rounded-full border-2 border-dashed border-[#cbd5e1] flex items-center justify-center text-[#94a3b8] hover:border-[#94a3b8] transition-colors"
                >
                  +
                </button>
              </div>

              {/* Expanded Contact Form */}
              {expandedContactId && (
                <div className="mt-4 p-4 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                  {contacts
                    .filter((c) => c.id === expandedContactId)
                    .map((contact) => (
                      <div key={contact.id}>
                        <p className="font-semibold text-[#0f172a] mb-3">
                          {contact.name}
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-[#94a3b8] text-xs mb-1">Role</p>
                            <p className="text-[#0f172a]">{contact.role}</p>
                          </div>
                          <div>
                            <p className="text-[#94a3b8] text-xs mb-1">Email</p>
                            <p className="text-[#0f172a]">{contact.email}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[#94a3b8] text-xs mb-1">Phone</p>
                            <p className="text-[#0f172a]">{contact.phone || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Add Contact Form */}
              {showAddContact && (
                <div className="mt-4 p-4 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                  <h3 className="font-semibold text-[#0f172a] mb-3">Add New Contact</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Name"
                      value={newContact.name}
                      onChange={(e) =>
                        setNewContact({ ...newContact, name: e.target.value })
                      }
                      className="form-input"
                    />
                    <input
                      type="text"
                      placeholder="Role"
                      value={newContact.role}
                      onChange={(e) =>
                        setNewContact({ ...newContact, role: e.target.value })
                      }
                      className="form-input"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={newContact.email}
                      onChange={(e) =>
                        setNewContact({ ...newContact, email: e.target.value })
                      }
                      className="form-input"
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={newContact.phone}
                      onChange={(e) =>
                        setNewContact({ ...newContact, phone: e.target.value })
                      }
                      className="form-input"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newContact.is_primary}
                        onChange={(e) =>
                          setNewContact({
                            ...newContact,
                            is_primary: e.target.checked,
                          })
                        }
                      />
                      <span className="text-[#0f172a]">Set as primary contact</span>
                    </label>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSaveContact}
                        className="btn btn-primary btn-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setShowAddContact(false)}
                        className="btn btn-ghost btn-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit Form Modal */}
      {editMode && client && (
        <div className="bg-white border border-[#e8e8e8] rounded-[10px] p-6 mb-8">
          <h2 className="text-lg font-bold text-[#0f172a] mb-6">Edit Client</h2>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleFormChange(e, 'name')}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Company</label>
              <input
                type="text"
                value={formData.company || ''}
                onChange={(e) => handleFormChange(e, 'company')}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleFormChange(e, 'email')}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => handleFormChange(e, 'phone')}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <input
              type="text"
              value={formData.address || ''}
              onChange={(e) => handleFormChange(e, 'address')}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Website</label>
            <input
              type="url"
              value={formData.website || ''}
              onChange={(e) => handleFormChange(e, 'website')}
              className="form-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Engagement Status</label>
              <select
                value={formData.engagement_status || 'active'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    engagement_status: e.target.value as 'active' | 'inactive' | 'prospect',
                  })
                }
                className="form-select"
              >
                <option value="active">Active</option>
                <option value="prospect">Prospect</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Next Step</label>
              <input
                type="text"
                value={formData.next_step || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    next_step: e.target.value,
                  })
                }
                className="form-input"
                placeholder="e.g., Schedule demo, Send proposal"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button onClick={handleSaveClient} className="btn btn-primary">
              Save Changes
            </button>
            <button onClick={handleEditToggle} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Module Grid */}
      <div className="grid auto-fit gap-[14px] mb-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
        {/* Invoices Module */}
        {client.active_modules?.includes('invoices') && (
          <Link href={`/invoices?client=${clientId}`}>
            <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-[22px_20px] min-h-[120px] hover:border-[#bbb] hover:shadow-md hover:translate-y-[-1px] transition-all cursor-pointer">
              <div className="text-2xl mb-3">📄</div>
              <h3 className="text-[14px] font-bold text-[#0f172a] mb-2">Invoices</h3>
              <p className="text-[11.5px] text-[#aaa]">
                {invoiceCount} invoices
              </p>
              {outstandingAmount > 0 && (
                <p className="text-[11.5px] text-[#e67e22] font-semibold mt-1">
                  Outstanding: {currency(outstandingAmount)}
                </p>
              )}
            </div>
          </Link>
        )}

        {/* Brand Kit Module */}
        {client.active_modules?.includes('brand_kit') && (
          <Link href={`/clients/${clientId}/brand-kit`}>
            <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-[22px_20px] min-h-[120px] hover:border-[#bbb] hover:shadow-md hover:translate-y-[-1px] transition-all cursor-pointer">
              <div className="text-2xl mb-3">🎨</div>
              <h3 className="text-[14px] font-bold text-[#0f172a] mb-2">Brand Kit</h3>
              <p className="text-[11.5px] text-[#aaa]">
                Status: <span className="text-[#0f172a] font-semibold">Incomplete</span>
              </p>
            </div>
          </Link>
        )}

        {/* Financials Module */}
        {client.active_modules?.includes('financials') && (
          <Link href={`/financials?client=${clientId}`}>
            <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-[22px_20px] min-h-[120px] hover:border-[#bbb] hover:shadow-md hover:translate-y-[-1px] transition-all cursor-pointer">
              <div className="text-2xl mb-3">💰</div>
              <h3 className="text-[14px] font-bold text-[#0f172a] mb-2">Financials</h3>
              <p className="text-[11.5px] text-[#aaa]">
                Revenue breakdown
              </p>
            </div>
          </Link>
        )}

        {/* Add Module Card */}
        <button className="bg-white border-2 border-dashed border-[#cbd5e1] rounded-[12px] p-[22px_20px] min-h-[120px] flex flex-col items-center justify-center hover:border-[#94a3b8] transition-colors">
          <div className="text-3xl mb-2 text-[#cbd5e1]">+</div>
          <p className="text-[12px] font-semibold text-[#94a3b8]">Add Module</p>
        </button>
      </div>

      {/* Invoices Section */}
      {client.active_modules?.includes('invoices') && (
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="section-title">Invoices</h2>
            <Link href={`/invoices/new?client=${clientId}`}>
              <button className="btn btn-primary btn-sm">New Invoice</button>
            </Link>
          </div>

          {invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Issued</th>
                    <th>Due</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="cursor-pointer hover:bg-[#f8fafc] transition-colors"
                      onClick={() =>
                        setExpandedInvoiceId(
                          expandedInvoiceId === invoice.id ? null : invoice.id
                        )
                      }
                    >
                      <td className="font-semibold text-[#0f172a]">
                        {invoice.invoice_number}
                      </td>
                      <td>{invoice.project_name}</td>
                      <td>
                        <span
                          className={`pill pill-${
                            invoice.status === 'paid'
                              ? 'paid'
                              : invoice.status === 'overdue'
                                ? 'overdue'
                                : 'unpaid'
                          }`}
                        >
                          {invoice.status.charAt(0).toUpperCase() +
                            invoice.status.slice(1)}
                        </span>
                      </td>
                      <td>{isoToDisplay(invoice.issued_date)}</td>
                      <td>{isoToDisplay(invoice.due_date)}</td>
                      <td className="font-semibold">
                        {currency(
                          invoice.line_items?.items?.reduce(
                            (sum, item) => sum + item.quantity * item.price,
                            0
                          ) || 0
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-[#94a3b8] mb-4">No invoices yet</p>
              <Link href={`/invoices/new?client=${clientId}`}>
                <button className="btn btn-primary btn-sm">Create First Invoice</button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
