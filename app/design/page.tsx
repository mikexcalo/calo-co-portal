'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { DB, loadClients, loadContacts, loadAllBrandKits } from '@/lib/database';
import { Client } from '@/lib/types';
import { extractHex } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { getYardSignTemplate } from '@/lib/templates/yard-sign';
import { getBusinessCardTemplate } from '@/lib/templates/business-card';
import { BrandBuilderFields, DEFAULT_FIELDS } from '@/components/brand-builder/types';
import FieldEditor from '@/components/brand-builder/FieldEditor';
import supabase from '@/lib/supabase';
import { Suspense } from 'react';
import { getClientAvatarUrl } from '@/lib/clientAvatar';


const DesignCanvas = dynamic(() => import('@/components/design-studio/DesignCanvas'), { ssr: false, loading: () => null });

const TEMPLATES = [
  { cat: 'Neighborhood', items: [
    { id: 'yard-sign', name: 'Yard Signs', live: true },
    { id: 'door-hanger', name: 'Door Hangers', live: false },
    { id: 'vehicle-magnet', name: 'Vehicle Magnets', live: false },
    { id: 'flyer', name: 'Flyers', live: false },
    { id: 'direct-mail', name: 'Direct Mail', live: false },
  ]},
  { cat: 'Professional', items: [
    { id: 'business-card', name: 'Business Cards', live: true },
    { id: 'email-signature', name: 'Email Signature', live: false },
    { id: 'one-pager', name: 'One-Pagers', live: false },
  ]},
  { cat: 'Online', items: [
    { id: 'social-graphics', name: 'Social Graphics', live: false },
    { id: 'web-banners', name: 'Web Banners', live: false },
  ]},
  { cat: 'Merch', items: [
    { id: 't-shirt', name: 'T-Shirts', live: false },
    { id: 'poster', name: 'Posters', live: false },
  ]},
];

const ICONS: Record<string, React.ReactNode> = {
  'yard-sign': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="2" width="16" height="12" rx="2"/><line x1="9" y1="14" x2="9" y2="22"/><line x1="15" y1="14" x2="15" y2="22"/></svg>,
  'business-card': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="6" y1="12" x2="14" y2="12"/></svg>,
  'door-hanger': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="6" y="1" width="12" height="22" rx="2"/><circle cx="12" cy="5" r="2.5"/></svg>,
  'vehicle-magnet': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="6" width="16" height="10" rx="2"/><path d="M17 8l4 4v4h-4"/></svg>,
  'flyer': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/></svg>,
  'direct-mail': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/></svg>,
  'email-signature': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/></svg>,
  'one-pager': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/></svg>,
  'social-graphics': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/></svg>,
  'web-banners': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="5" width="22" height="14" rx="2"/><line x1="1" y1="9" x2="23" y2="9"/></svg>,
  't-shirt': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M8 2l-2 0-4 4v3h4v13h12V9h4V6l-4-4h-2c0 0-1 2-4 2s-4-2-4-2z"/></svg>,
  'poster': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="1" width="18" height="22" rx="2"/><line x1="6" y1="15" x2="18" y2="15"/></svg>,
};

export default function DesignPage() {
  return <Suspense fallback={null}><DesignContent /></Suspense>;
}

function DesignContent() {
  const { t } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>(searchParams.get('client') || 'agency');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(searchParams.get('template') || null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fields
  const [fields, setFields] = useState<BrandBuilderFields>(DEFAULT_FIELDS);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      if (!DB.clients.some(c => c.brandKit?._id)) await loadAllBrandKits();
      setClients(DB.clients);
      setLoading(false);
    };
    init();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Update URL when selection changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedClient !== 'agency') params.set('client', selectedClient);
    if (selectedTemplate) params.set('template', selectedTemplate);
    const query = params.toString();
    router.replace(`/design${query ? '?' + query : ''}`, { scroll: false });
  }, [selectedClient, selectedTemplate, router]);

  // Load fields when client/template changes
  useEffect(() => {
    if (!selectedTemplate || selectedClient === 'agency' || loading || clients.length === 0) return;
    const load = async () => {
      const client = DB.clients.find(c => c.id === selectedClient);
      if (!client) return;
      const f = { ...DEFAULT_FIELDS };
      f.companyName = client.company || client.name || '';
      f.website = client.website || '';
      f.address = client.address || '';
      if (!DB.contacts[selectedClient]) await loadContacts(selectedClient);
      const contacts = DB.contacts[selectedClient] || [];
      const primary = contacts.find(c => c.isPrimary) || contacts[0];
      if (primary) { f.contactName = primary.name || ''; f.phone = primary.phone || ''; f.email = primary.email || ''; f.contactTitle = primary.title || primary.role || ''; }
      const bk = client.brandKit;
      if (bk) {
        for (const slot of ['color', 'light', 'dark', 'icon'] as const) {
          const logos = bk.logos?.[slot] || [];
          const svg = logos.find((l: any) => /\.svg$/i.test(l.name || '') && l.data);
          const pri = logos.find((l: any) => l.isPrimary) || logos[0];
          if (svg?.data) { f.logoUrl = svg.data; break; }
          if (pri?.data) { f.logoUrl = pri.data; break; }
        }
        if (bk.colors?.length) { const hex = extractHex(bk.colors[0]); if (hex) f.primaryColor = hex; }
      }
      if (f.website) f.qrCodeUrl = f.website.startsWith('http') ? f.website : `https://${f.website}`;
      try {
        const { data: row } = await supabase.from('clients').select('brand_builder_fields').eq('id', selectedClient).single();
        if (row?.brand_builder_fields && typeof row.brand_builder_fields === 'object') {
          const saved = row.brand_builder_fields as Record<string, any>;
          for (const key of Object.keys(saved)) { if (saved[key] !== '' && saved[key] !== undefined && saved[key] !== null) (f as any)[key] = saved[key]; }
        }
      } catch {}
      setFields(f);
    };
    load();
  }, [selectedClient, selectedTemplate, loading, clients.length]);

  const handleFieldsChange = useCallback((f: BrandBuilderFields) => {
    setFields(f);
    if (selectedClient === 'agency') return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await supabase.from('clients').update({ brand_builder_fields: f }).eq('id', selectedClient); } catch {}
    }, 500);
  }, [selectedClient]);

  const selectClient = (id: string) => { setSelectedClient(id); setDropdownOpen(false); setClientSearch(''); setFields({ ...DEFAULT_FIELDS }); };

  if (loading) return null;

  const client = clients.find(c => c.id === selectedClient);
  const clientName = selectedClient === 'agency' ? 'Agency' : (client?.company || client?.name || (loading ? 'Loading\u2026' : 'Client'));
  const bk = client?.brandKit;
  const filteredClients = clients.filter(c => (c.company || c.name || '').toLowerCase().includes(clientSearch.toLowerCase()));

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)' }}>
      {/* Inner Panel — 220px */}
      <div style={{ width: 220, flexShrink: 0, borderRight: `0.5px solid ${t.border.default}`, display: 'flex', flexDirection: 'column', background: t.bg.primary }}>
        {/* Client Dropdown */}
        <div ref={dropdownRef} style={{ padding: '12px 14px', borderBottom: `0.5px solid ${t.border.default}`, position: 'relative' }}>
          <button onClick={() => setDropdownOpen(!dropdownOpen)} style={{
            width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 500,
            background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
            color: t.text.primary, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            transition: 'border-color 150ms',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{clientName}</span>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.5" style={{ flexShrink: 0 }}><path d="M4 6l4 4 4-4"/></svg>
          </button>
          {dropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 14, right: 14, marginTop: 4, background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8, boxShadow: t.shadow.elevated, zIndex: 20, maxHeight: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px', borderBottom: `0.5px solid ${t.border.default}` }}>
                <input autoFocus placeholder="Search clients..." value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: t.text.primary, fontFamily: 'inherit' }} />
              </div>
              <div onClick={() => selectClient('agency')} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selectedClient === 'agency' ? 'rgba(37,99,235,0.06)' : 'transparent', color: selectedClient === 'agency' ? '#5a9edd' : t.text.primary }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="3.5" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="20.5"/><line x1="3.5" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="20.5" y2="12"/></svg>
                Agency
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filteredClients.map(c => (
                  <div key={c.id} onClick={() => selectClient(c.id)} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selectedClient === c.id ? 'rgba(37,99,235,0.06)' : 'transparent', color: selectedClient === c.id ? '#5a9edd' : t.text.primary }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, overflow: 'hidden', background: getClientAvatarUrl(c) ? 'transparent' : '#1a2540', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a8abb', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>
                      {getClientAvatarUrl(c) ? <img src={getClientAvatarUrl(c)!} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} /> : (c.company || c.name || '').charAt(0)}
                    </div>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company || c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Template List */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
          {TEMPLATES.map(cat => (
            <div key={cat.cat}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: t.text.tertiary, padding: '12px 14px 4px' }}>{cat.cat}</div>
              {cat.items.map(tmpl => {
                const active = selectedTemplate === tmpl.id;
                return (
                  <div key={tmpl.id}
                    title={tmpl.live ? undefined : 'Coming soon'}
                    onClick={tmpl.live ? () => setSelectedTemplate(tmpl.id) : undefined}
                    style={{
                      padding: '8px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
                      cursor: tmpl.live ? 'pointer' : 'default',
                      opacity: tmpl.live ? 1 : 0.35,
                      background: active ? 'rgba(37,99,235,0.06)' : 'transparent',
                      color: active ? '#2563eb' : t.text.secondary,
                      borderRadius: 6, transition: 'all 150ms',
                    }}
                    onMouseEnter={tmpl.live && !active ? (e) => (e.currentTarget.style.background = t.bg.surfaceHover) : undefined}
                    onMouseLeave={tmpl.live && !active ? (e) => (e.currentTarget.style.background = 'transparent') : undefined}>
                    <span style={{ flexShrink: 0, color: active ? '#2563eb' : t.text.secondary }}>{ICONS[tmpl.id]}</span>
                    {tmpl.name}
                    {tmpl.live ? <span style={{ fontSize: 8, fontWeight: 600, color: t.status.success, marginLeft: 'auto', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>LIVE</span> : <span style={{ fontSize: 8, fontWeight: 600, color: t.text.tertiary, marginLeft: 'auto', textTransform: 'uppercase' as const, letterSpacing: '0.05em', opacity: 0.5 }}>SOON</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Edit brand kit link */}
        <div style={{ padding: '10px 14px', borderTop: `0.5px solid ${t.border.default}` }}>
          <button
            onClick={() => router.push(selectedClient === 'agency' ? '/agency/brand-kit' : `/clients/${selectedClient}/brand-kit`)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: t.bg.surface, color: t.text.primary,
              border: `1px solid ${t.border.default}`, borderRadius: 8,
              padding: '6px 14px', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms',
              width: '100%', justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; e.currentTarget.style.borderColor = t.border.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = t.bg.surface; e.currentTarget.style.borderColor = t.border.default; }}
          >
            Edit brand kit →
          </button>
        </div>
      </div>

      {/* Fields Column — 260px */}
      {(selectedTemplate === 'yard-sign' || selectedTemplate === 'business-card') && selectedClient !== 'agency' ? (
        <div style={{ width: 260, flexShrink: 0, borderRight: `0.5px solid ${t.border.default}`, overflowY: 'auto', padding: '16px 14px' }}>
          {/* Brand assets card */}
          {bk && (
            <div style={{ background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: t.text.tertiary, marginBottom: 8 }}>Brand assets</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {(['color', 'light', 'dark'] as const).map(slot => {
                  const file = bk.logos?.[slot]?.find((f: any) => f.data && /\.(png|svg|jpg)$/i.test(f.name));
                  return <div key={slot} style={{ width: 32, height: 32, borderRadius: 5, border: `0.5px solid ${t.border.default}`, background: slot === 'dark' ? '#1a1a1a' : '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {file?.data ? <img src={file.data} alt="" style={{ maxWidth: 26, maxHeight: 26, objectFit: 'contain' }} /> : <span style={{ fontSize: 7, color: t.text.tertiary }}>—</span>}
                  </div>;
                })}
              </div>
              {bk.colors && bk.colors.length > 0 && (
                <div style={{ display: 'flex', gap: 3 }}>
                  {bk.colors.slice(0, 6).map((c: any, i: number) => <div key={i} style={{ width: 16, height: 16, borderRadius: 3, background: typeof c === 'string' ? c : c?.hex || '#ccc', border: `0.5px solid ${t.border.default}` }} />)}
                </div>
              )}
            </div>
          )}
          {/* Field editor */}
          <FieldEditor fields={fields} onChange={handleFieldsChange} sources={{}} assetType={selectedTemplate || 'yard-sign'} clientId={selectedClient} hasBrandKit={!!bk} />
        </div>
      ) : null}

      {/* Canvas */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg.surfaceHover, overflow: 'auto' }}>
        {(selectedTemplate === 'yard-sign' || selectedTemplate === 'business-card') && selectedClient !== 'agency' ? (
          <div style={{ padding: 24 }}>
            <DesignCanvas
              key={`${selectedTemplate}-${selectedClient}-${fields.signSize}-${fields.showHeadline}-${fields.showPhone}-${fields.showCompanyName}-${fields.showQrCode}-${fields.showTagline}-${fields.showEmail}-${fields.showWebsite}-${(fields as any).showLogo}-${fields.phone}-${fields.companyName}-${fields.logoUrl?.slice(-20) || ''}-${fields.qrCodeUrl}-${fields.contactName}-${fields.email}`}
              template={selectedTemplate === 'yard-sign' ? getYardSignTemplate({
                companyName: fields.companyName || '', phone: fields.phone || '',
                headline: fields.headline || 'Free Consultations \u2022 Fully Insured \u2022 Budget-Friendly',
                logoUrl: fields.logoUrl || null, qrCodeUrl: fields.qrCodeUrl || fields.website || '',
                brandColor: fields.primaryColor || '#2563eb', size: fields.signSize || '18x24', displayWidth: 540,
                showHeadline: fields.showHeadline, showPhone: fields.showPhone, showCompanyName: fields.showCompanyName,
                showQrCode: fields.showQrCode, showLogo: (fields as any).showLogo !== false,
                tagline: fields.tagline || '', showTagline: fields.showTagline,
                email: fields.email || '', showEmail: fields.showEmail, website: fields.website || '', showWebsite: fields.showWebsite,
              }) : getBusinessCardTemplate({
                companyName: fields.companyName || '', contactName: fields.contactName || '',
                contactTitle: fields.contactTitle || '', phone: fields.phone || '',
                email: fields.email || '', website: fields.website || '', tagline: fields.tagline || '',
                logoUrl: fields.logoUrl || null, qrCodeUrl: fields.qrCodeUrl || fields.website || '',
                brandColor: fields.primaryColor || '#2563eb',
                showCompanyName: fields.showCompanyName, showPhone: fields.showPhone,
                showEmail: fields.showEmail, showWebsite: fields.showWebsite,
                showTagline: fields.showTagline, showQrCode: fields.showQrCode,
              })}
              brandColor={fields.primaryColor || '#2563eb'} darkColor={(fields as any).secondaryColor || '#1a1a1a'}
              signSize={fields.signSize || '18x24'} savedState={null}
            />
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            {(selectedTemplate === 'yard-sign' || selectedTemplate === 'business-card') && selectedClient === 'agency' ? (
              <>
                <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.3" style={{ marginBottom: 12, opacity: 0.5 }}>
                  <circle cx="6" cy="5" r="2.5"/><path d="M1.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5"/>
                  <circle cx="11" cy="4.5" r="2"/><path d="M14.5 13c0-2 1.5-3.5-1.5-3.5"/>
                </svg>
                <div style={{ fontSize: 14, fontWeight: 400, color: t.text.tertiary, marginBottom: 4 }}>Select a client first</div>
                <div style={{ fontSize: 12, color: t.text.tertiary, opacity: 0.6 }}>Yard signs are built per-client using their brand kit</div>
              </>
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, opacity: 0.4 }}>
                  <path d="M10.5 2L14 5.5 5.5 14H2v-3.5z"/>
                  <line x1="8.5" y1="4" x2="12" y2="7.5"/>
                </svg>
                <div style={{ fontSize: 14, fontWeight: 400, color: t.text.tertiary, marginBottom: 4 }}>Select a template to start</div>
                <div style={{ fontSize: 12, color: t.text.tertiary, opacity: 0.6 }}>Choose a client and template from the left</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
