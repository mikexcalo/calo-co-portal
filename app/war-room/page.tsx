'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DB, saveEngagementStatus, saveNextStep, loadActivityLog } from '@/lib/database';
import { Client } from '@/lib/types';
import { initials, currency, daysUntil, invTotal } from '@/lib/utils';

type EngagementStatus = 'active' | 'prospect' | 'delivered' | 'retained' | 'paused' | 'closed';

const STATUS_LABELS: Record<EngagementStatus, string> = {
  active: 'Active',
  prospect: 'Prospect',
  delivered: 'Delivered',
  retained: 'Retained',
  paused: 'Paused',
  closed: 'Closed',
};

const STATUS_COLORS: Record<EngagementStatus, string> = {
  active: 'bg-green-100 border-green-300 text-green-800',
  prospect: 'bg-blue-100 border-blue-300 text-blue-800',
  delivered: 'bg-purple-100 border-purple-300 text-purple-800',
  retained: 'bg-gray-100 border-gray-300 text-gray-800',
  paused: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  closed: 'bg-red-100 border-red-300 text-red-800',
};

export default function WarRoomPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    setClients(DB.clients);
    loadActivityLog();

    // Sort clients by attention needed (overdue invoices first, then incomplete profiles)
    const overdue = DB.invoices.filter(
      (i) => i.status !== 'paid' && !i.isReimbursement && daysUntil(i.due)! < 0
    );

    const sorted = [...DB.clients].sort((a, b) => {
      const aOverdue = overdue.some((i) => i.clientId === a.id);
      const bOverdue = overdue.some((i) => i.clientId === b.id);

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      const aName = a.company || a.name;
      const bName = b.company || b.name;
      return aName.localeCompare(bName);
    });

    setClients(sorted);
  }, []);

  const getInvoiceSignals = (client: Client) => {
    const clientInvoices = DB.invoices.filter((i) => i.clientId === client.id && !i.isReimbursement);

    const overdue = clientInvoices.filter((i) => i.status !== 'paid' && daysUntil(i.due)! < 0);
    const dueSoon = clientInvoices.filter(
      (i) => i.status !== 'paid' && daysUntil(i.due)! >= 0 && daysUntil(i.due)! <= 7
    );

    const overdueTotal = overdue.reduce((sum, i) => sum + invTotal(i), 0);
    const dueSoonTotal = dueSoon.reduce((sum, i) => sum + invTotal(i), 0);

    return { overdue, dueSoon, overdueTotal, dueSoonTotal };
  };

  const getOpenItemsCount = (client: Client) => {
    let count = 0;

    // Check for incomplete profile
    if (!client.email || !client.phone) count++;
    if (!client.website) count++;
    if (!client.address_line_1 && !client.address) count++;

    // Check for overdue invoices
    const { overdue } = getInvoiceSignals(client);
    count += overdue.length;

    return count;
  };

  const getLastActivity = (clientId: string) => {
    const entry = DB.activityLog.find((a) => a.clientId === clientId);
    if (!entry) return 'No activity';

    const date = new Date(entry.createdAt);
    const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}m ago`;
  };

  return (
    <div className="page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">War Room</h1>
        <p className="text-sm text-slate-500">
          {now.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 text-center text-slate-500 py-12">
          <p className="text-sm">No clients yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => {
            const { overdue, dueSoon, overdueTotal, dueSoonTotal } = getInvoiceSignals(client);
            const openItems = getOpenItemsCount(client);
            const needsAttention = overdue.length > 0 || !client.email || !client.phone;
            const status = (client.engagementStatus || 'active') as EngagementStatus;

            return (
              <div
                key={client.id}
                className={`rounded-lg border p-5 transition ${
                  needsAttention
                    ? 'border-red-300 bg-red-50 shadow-lg'
                    : 'border-slate-200 bg-white hover:shadow-md'
                }`}
              >
                {/* Card Top: Logo + Name + Status */}
                <div className="flex items-start gap-3 mb-4 pb-4 border-b border-slate-200">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-indigo-700">
                      {initials(client.company || client.name)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {client.company || client.name}
                    </div>
                    {client.company && (
                      <div className="text-xs text-slate-500 truncate">{client.name}</div>
                    )}
                  </div>
                  <select
                    value={status}
                    onChange={(e) => {
                      const newStatus = e.target.value as EngagementStatus;
                      saveEngagementStatus(client.id, newStatus);
                      const updated = DB.clients.find((c) => c.id === client.id);
                      if (updated) {
                        setClients([...DB.clients]);
                      }
                    }}
                    className={`text-xs font-semibold border rounded px-2 py-1 cursor-pointer ${
                      STATUS_COLORS[status]
                    }`}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Invoice Signal Row */}
                {(overdue.length > 0 || dueSoon.length > 0) && (
                  <div className="mb-4 pb-4 border-b border-slate-200">
                    {overdue.length > 0 && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded">
                          {overdue.length} Overdue
                        </span>
                        <span className="text-xs font-mono text-red-700">{currency(overdueTotal)}</span>
                      </div>
                    )}
                    {dueSoon.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                          {dueSoon.length} Due Soon
                        </span>
                        <span className="text-xs font-mono text-amber-700">{currency(dueSoonTotal)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Last Activity Row */}
                <div className="mb-4 pb-4 border-b border-slate-200">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Last Activity</div>
                  <div className="text-sm text-slate-700">{getLastActivity(client.id)}</div>
                </div>

                {/* Next Step Input */}
                <div className="mb-4 pb-4 border-b border-slate-200">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Next Step</div>
                  <input
                    type="text"
                    value={client.nextStep || ''}
                    onChange={(e) => {
                      const updated = DB.clients.find((c) => c.id === client.id);
                      if (updated) {
                        updated.nextStep = e.target.value;
                        setClients([...DB.clients]);
                      }
                    }}
                    onBlur={(e) => saveNextStep(client.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveNextStep(client.id, e.currentTarget.value);
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="+ Add next step"
                    className="form-input w-full text-sm"
                  />
                </div>

                {/* Open Items Badge */}
                {openItems > 0 && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-2 rounded cursor-pointer hover:bg-slate-200 transition">
                    <span>⚠</span>
                    <span>
                      {openItems} open item{openItems !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
