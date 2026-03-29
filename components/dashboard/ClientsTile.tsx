import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DB } from '@/lib/database';

interface ClientStats {
  activeCount: number;
  pausedCount: number;
  archivedCount: number;
  addedThisMonth: number;
  subtext: string;
}

function useClientStats(): ClientStats {
  const stats = useMemo(() => {
    const now = new Date();
    const nowMonth = now.getMonth();
    const nowYear = now.getFullYear();

    const activeCount = DB.clients.filter((c) => (c.engagementStatus || 'active') === 'active').length;
    const pausedCount = DB.clients.filter((c) => c.engagementStatus === 'paused').length;
    const archivedCount = DB.clients.filter((c) => c.engagementStatus === 'closed').length;

    const addedThisMonth = DB.activityLog.filter((e) => {
      if (e.eventType !== 'client_added') return false;
      const d = new Date(e.createdAt);
      return d.getMonth() === nowMonth && d.getFullYear() === nowYear;
    }).length;

    const subtext = addedThisMonth > 0 ? `${addedThisMonth} added this month` : 'No new clients';

    return {
      activeCount,
      pausedCount,
      archivedCount,
      addedThisMonth,
      subtext,
    };
  }, []);

  return stats;
}

export function ClientsTileHeader() {
  const stats = useClientStats();

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: '26px',
          fontWeight: '700',
          color: '#0f172a',
          lineHeight: '1.1',
          marginBottom: '2px',
        }}
      >
        {stats.activeCount}
      </div>
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginTop: '2px' }}>
        active clients
      </div>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
        {stats.subtext}
      </div>
    </div>
  );
}

export function ClientsTileBody() {
  const stats = useClientStats();

  return (
    <>
      <div className="ag-tile-row">
        <span className="ag-tile-lbl">Active</span>
        <span className="ag-tile-val">{stats.activeCount}</span>
      </div>
      <div className="ag-tile-row">
        <span className="ag-tile-lbl">Paused</span>
        <span className="ag-tile-val">{stats.pausedCount}</span>
      </div>
      <div className="ag-tile-row">
        <span className="ag-tile-lbl">Archived</span>
        <span className="ag-tile-val">{stats.archivedCount}</span>
      </div>
      <span
        className="ag-tile-link"
        onClick={() => {
          const clientsSection = document.getElementById('clients-section');
          if (clientsSection) {
            clientsSection.scrollIntoView({ behavior: 'smooth' });
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        → View all clients
      </span>
    </>
  );
}

export default function ClientsTile() {
  return null; // Not used directly
}
