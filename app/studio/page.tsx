'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme';
import { DB, loadClients } from '@/lib/database';
import { Client } from '@/lib/types';
import HelmSpinner from '@/components/shared/HelmSpinner';

type TemplateId = string;

const CATEGORIES = [
  {
    label: 'Get Noticed in the Neighborhood',
    templates: [
      { id: 'yard-sign', name: 'Yard Signs', desc: '5 sizes' },
      { id: 'door-hanger', name: 'Door Hangers', desc: '4.25 × 11 in' },
      { id: 'vehicle-magnet', name: 'Vehicle Magnets', desc: '24 × 12 in' },
      { id: 'flyer', name: 'Flyers', desc: '8.5 × 11 in' },
      { id: 'direct-mail', name: 'Direct Mail', desc: 'Postcards · 6 × 4 in' },
    ],
  },
  {
    label: 'Look Professional Everywhere',
    templates: [
      { id: 'business-card', name: 'Business Cards', desc: 'Front + Back' },
      { id: 'email-signature', name: 'Email Signature', desc: 'Gmail · Outlook' },
      { id: 'one-pager', name: 'One-Pagers', desc: 'Sales + case study' },
    ],
  },
  {
    label: 'Stand Out Online',
    templates: [
      { id: 'social-graphics', name: 'Social Graphics', desc: 'IG · LinkedIn · FB' },
      { id: 'web-banners', name: 'Web Banners', desc: 'Hero · sidebar · leaderboard' },
    ],
  },
  {
    label: 'Gear Up the Crew',
    templates: [
      { id: 't-shirt', name: 'T-Shirts', desc: 'Front + Back' },
      { id: 'poster', name: 'Posters', desc: '3 sizes' },
    ],
  },
];

const ICONS: Record<string, React.ReactNode> = {
  'yard-sign': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="2" width="16" height="12" rx="2"/><line x1="9" y1="14" x2="9" y2="22" strokeLinecap="round"/><line x1="15" y1="14" x2="15" y2="22" strokeLinecap="round"/></svg>,
  'business-card': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="6" y1="12" x2="14" y2="12" strokeLinecap="round"/><line x1="6" y1="15" x2="10" y2="15" strokeLinecap="round"/></svg>,
  'door-hanger': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="6" y="1" width="12" height="22" rx="2"/><circle cx="12" cy="5" r="2.5"/></svg>,
  'vehicle-magnet': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="6" width="16" height="10" rx="2"/><path d="M17 8l4 4v4h-4"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>,
  'flyer': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="7" x2="16" y2="7" strokeLinecap="round"/><line x1="8" y1="11" x2="14" y2="11" strokeLinecap="round"/></svg>,
  'direct-mail': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/></svg>,
  'email-signature': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/><line x1="6" y1="14" x2="10" y2="14" strokeLinecap="round"/></svg>,
  'one-pager': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="6" x2="16" y2="6" strokeLinecap="round"/><line x1="8" y1="10" x2="16" y2="10" strokeLinecap="round"/></svg>,
  'social-graphics': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/></svg>,
  'web-banners': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="5" width="22" height="14" rx="2"/><line x1="1" y1="9" x2="23" y2="9"/></svg>,
  't-shirt': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M8 2l-2 0-4 4v3h4v13h12V9h4V6l-4-4h-2c0 0-1 2-4 2s-4-2-4-2z"/></svg>,
  'poster': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="1" width="18" height="22" rx="2"/><line x1="6" y1="15" x2="18" y2="15" strokeLinecap="round"/><line x1="6" y1="18" x2="14" y2="18" strokeLinecap="round"/></svg>,
};

export default function StudioPage() {
  const { t } = useTheme();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('agency');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      setClients(DB.clients);
      setLoading(false);
    };
    init();
  }, []);

  if (loading) return <div style={{ position: 'fixed', bottom: 24, right: 24, opacity: 0.4, zIndex: 10 }}><HelmSpinner size={20} /></div>;

  const clientName = selectedClient === 'agency' ? 'Agency' : (clients.find(c => c.id === selectedClient)?.company || 'Client');

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)' }}>
      {/* Left Panel */}
      <div style={{ width: 320, flexShrink: 0, borderRight: `1px solid ${t.border.default}`, overflowY: 'auto', background: t.bg.primary }}>
        {/* Client Switcher */}
        <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${t.border.default}` }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setDropdownOpen(!dropdownOpen)} style={{
              width: '100%', padding: '8px 12px', fontSize: 13, fontWeight: 500,
              background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
              color: t.text.primary, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              {clientName}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.5"><path d="M4 6l4 4 4-4"/></svg>
            </button>
            {dropdownOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8, boxShadow: t.shadow.elevated, zIndex: 20, overflow: 'hidden' }}>
                <div onClick={() => { setSelectedClient('agency'); setDropdownOpen(false); setSelectedTemplate(null); }}
                  style={{ padding: '8px 12px', fontSize: 13, color: selectedClient === 'agency' ? t.accent.text : t.text.primary, cursor: 'pointer', background: selectedClient === 'agency' ? t.accent.subtle : 'transparent' }}>
                  Agency
                </div>
                {clients.map(c => (
                  <div key={c.id} onClick={() => { setSelectedClient(c.id); setDropdownOpen(false); setSelectedTemplate(null); }}
                    style={{ padding: '8px 12px', fontSize: 13, color: selectedClient === c.id ? t.accent.text : t.text.primary, cursor: 'pointer', background: selectedClient === c.id ? t.accent.subtle : 'transparent' }}>
                    {c.company || c.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Template List */}
        <div style={{ padding: '12px 16px' }}>
          {CATEGORIES.map(cat => (
            <div key={cat.label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{cat.label}</div>
              {cat.templates.map(tmpl => {
                const isActive = selectedTemplate === tmpl.id;
                return (
                  <div key={tmpl.id} onClick={() => setSelectedTemplate(tmpl.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                      background: isActive ? t.accent.subtle : 'transparent',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = t.bg.surfaceHover; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <span style={{ color: isActive ? t.accent.text : t.text.secondary, flexShrink: 0 }}>{ICONS[tmpl.id] || null}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, color: isActive ? t.accent.text : t.text.primary }}>{tmpl.name}</div>
                      <div style={{ fontSize: 11, color: t.text.tertiary }}>{tmpl.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg.surfaceHover }}>
        {selectedTemplate ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: t.text.primary, marginBottom: 4 }}>{CATEGORIES.flatMap(c => c.templates).find(t => t.id === selectedTemplate)?.name}</div>
            <div style={{ fontSize: 13, color: t.text.tertiary }}>{selectedTemplate === 'yard-sign' ? 'Canvas builder loading...' : 'Coming soon'}</div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', opacity: 0.5 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={t.text.tertiary} strokeWidth="1.3" strokeLinecap="round" style={{ marginBottom: 12 }}>
              <circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="3.5" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="20.5"/>
              <line x1="3.5" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="20.5" y2="12"/>
            </svg>
            <div style={{ fontSize: 14, color: t.text.tertiary }}>Select a template to start designing</div>
          </div>
        )}
      </div>
    </div>
  );
}
