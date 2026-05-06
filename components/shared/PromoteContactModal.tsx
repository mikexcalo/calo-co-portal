'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';

type ClientOption = { id: string; name: string };

type PromoteContactModalProps = {
  contactName: string;
  clients: ClientOption[];
  existingClientId: string | null;
  onPromote: (data: { mode: 'link'; clientId: string } | { mode: 'create'; name: string; website?: string }) => Promise<void>;
  onClose: () => void;
  promoting?: boolean;
};

export function PromoteContactModal({ contactName, clients, existingClientId, onPromote, onClose, promoting = false }: PromoteContactModalProps) {
  const { t } = useTheme();
  const [mode, setMode] = useState<'link' | 'create'>(existingClientId ? 'link' : 'link');
  const [selectedClientId, setSelectedClientId] = useState(existingClientId || '');
  const [newName, setNewName] = useState('');
  const [newWebsite, setNewWebsite] = useState('');

  const canPromote = promoting ? false : (mode === 'link' ? selectedClientId.length > 0 : newName.trim().length > 0);

  const handlePromote = async () => {
    if (!canPromote) return;
    if (mode === 'link') {
      await onPromote({ mode: 'link', clientId: selectedClientId });
    } else {
      await onPromote({ mode: 'create', name: newName.trim(), website: newWebsite.trim() || undefined });
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: `1px solid ${t.border.default}`, borderRadius: 6,
    fontFamily: 'inherit', background: t.bg.primary, color: t.text.primary,
    outline: 'none', boxSizing: 'border-box',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 500, textAlign: 'center',
    border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 4,
    background: active ? t.text.primary : 'transparent',
    color: active ? t.bg.surface : t.text.tertiary,
    transition: 'all 150ms',
  });

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 420, background: t.bg.surface, border: `1px solid ${t.border.default}`,
        borderRadius: 12, padding: 24, zIndex: 101, boxShadow: t.shadow.elevated,
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text.primary, marginBottom: 4 }}>
          Promote to client
        </div>
        <div style={{ fontSize: 13, color: t.text.tertiary, marginBottom: 16 }}>
          Link {contactName} to a client record.
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 2, background: t.bg.surfaceHover, borderRadius: 5, padding: 2, marginBottom: 16 }}>
          <button onClick={() => setMode('link')} style={tabStyle(mode === 'link')}>Link to existing</button>
          <button onClick={() => setMode('create')} style={tabStyle(mode === 'create')}>Create new client</button>
        </div>

        {mode === 'link' ? (
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            style={{
              ...inputStyle, marginBottom: 16,
              appearance: 'none' as const,
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath d=%27M3 5l3 3 3-3%27 fill=%27none%27 stroke=%27%236b7280%27 stroke-width=%271.5%27/%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              paddingRight: 24,
            }}
          >
            <option value="">Select a client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Client name"
              style={inputStyle}
              autoFocus
            />
            <input
              value={newWebsite}
              onChange={(e) => setNewWebsite(e.target.value)}
              placeholder="Website (optional)"
              style={inputStyle}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              height: 32, padding: '0 16px', fontSize: 13, fontWeight: 500,
              background: 'transparent', color: t.text.secondary,
              border: `1px solid ${t.border.default}`, borderRadius: 6,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handlePromote}
            disabled={!canPromote}
            style={{
              height: 32, padding: '0 16px', fontSize: 13, fontWeight: 500,
              background: canPromote ? t.accent.primary : t.bg.surfaceHover,
              color: canPromote ? '#fff' : t.text.tertiary,
              border: 'none', borderRadius: 6,
              cursor: canPromote ? 'pointer' : 'default',
              fontFamily: 'inherit',
            }}
          >
            {promoting ? 'Promoting...' : 'Promote'}
          </button>
        </div>
      </div>
    </>
  );
}
