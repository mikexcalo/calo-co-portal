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
import { PageShell, PageHeader, SectionLabel } from '@/components/shared/Brand';

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

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  'yard-sign': 'Neighborhood marketing signs with brand colors',
  'business-card': 'Professional cards with contact info and QR code',
  'door-hanger': 'Leave-behind neighborhood marketing',
  'flyer': 'Full-page promotional handouts',
  'vehicle-magnet': 'Mobile brand visibility',
  'direct-mail': 'Targeted postal campaigns',
  'email-signature': 'HTML sig with logo and socials',
  'one-pager': 'Service overview leave-behinds',
  'social-graphics': 'Instagram, Facebook, LinkedIn posts',
  'web-banners': 'Google Display and site headers',
  't-shirt': 'Branded apparel',
  'poster': 'Large format prints',
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

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedClient !== 'agency') params.set('client', selectedClient);
    if (selectedTemplate) params.set('template', selectedTemplate);
    const query = params.toString();
    router.replace(`/design${query ? '?' + query : ''}`, { scroll: false });
  }, [selectedClient, selectedTemplate, router]);

  useEffect(() => {
    if (!selectedTemplate || loading) return;
    if (selectedClient !== 'agency' && clients.length === 0) return;
    const load = async () => {
      if (selectedClient === 'agency') {
        const f = { ...DEFAULT_FIELDS };
        f.companyName = DB.agency.name || 'CALO&CO';
        f.website = DB.agency.url || '';
        f.contactName = DB.agency.founder || '';
        if (f.website) f.qrCodeUrl = f.website.startsWith('http') ? f.website : `https://${f.website}`;
        const agBk = DB.agency.brandKit;
        if (agBk) {
          for (const slot of ['color', 'light', 'dark', 'icon'] as const) {
            const logos = agBk.logos?.[slot] || [];
            const svg = logos.find((l: any) => /\.svg$/i.test(l.name || '') && l.data);
            const pri = logos.find((l: any) => l.isPrimary) || logos[0];
            if (svg?.data) { f.logoUrl = svg.data; break; }
            if (pri?.data) { f.logoUrl = pri.data; break; }
          }
          if (agBk.colors?.length) { const hex = extractHex(agBk.colors[0]); if (hex) f.primaryColor = hex; }
        }
        setFields(f);
        return;
      }
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
  const clientName = selectedClient === 'agency' ? 'Agency' : (client?.company || client?.name || 'Client');
  const bk = client?.brandKit;
  const filteredClients = clients.filter(c => (c.company || c.name || '').toLowerCase().includes(clientSearch.toLowerCase()));

  // ── Client Dropdown (shared between hub and workspace) ──
  const clientDropdown = (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button onClick={() => setDropdownOpen(!dropdownOpen)} style={{
        padding: '7px 12px', fontSize: 13, fontWeight: 500,
        background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
        color: t.text.primary, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 8, transition: 'border-color 150ms',
        minWidth: 140, maxWidth: 220,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{clientName}</span>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.5" style={{ flexShrink: 0 }}><path d="M4 6l4 4 4-4"/></svg>
      </button>
      {dropdownOpen && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 240, background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8, boxShadow: t.shadow.elevated, zIndex: 20, maxHeight: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: `0.5px solid ${t.border.default}` }}>
            <input autoFocus placeholder="Search clients..." value={clientSearch} onChange={e => setClientSearch(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: t.text.primary, fontFamily: 'inherit' }} />
          </div>
          <div onClick={() => selectClient('agency')} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selectedClient === 'agency' ? 'rgba(37,99,235,0.06)' : 'transparent', color: selectedClient === 'agency' ? '#2563eb' : t.text.primary }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="3.5" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="20.5"/><line x1="3.5" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="20.5" y2="12"/></svg>
            Agency
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredClients.map(c => (
              <div key={c.id} onClick={() => selectClient(c.id)} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selectedClient === c.id ? 'rgba(37,99,235,0.06)' : 'transparent', color: selectedClient === c.id ? '#2563eb' : t.text.primary }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, overflow: 'hidden', background: getClientAvatarUrl(c) ? 'transparent' : t.bg.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.text.secondary, fontSize: 8, fontWeight: 700, flexShrink: 0 }}>
                  {getClientAvatarUrl(c) ? <img src={getClientAvatarUrl(c)!} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} /> : (c.company || c.name || '').charAt(0)}
                </div>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company || c.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════
  // HUB VIEW — no template selected
  // ═══════════════════════════════════════════════
  if (!selectedTemplate) {
    return (
      <PageShell>
        <PageHeader
          title="Design"
          subtitle="Create branded materials for your clients"
          action={clientDropdown}
        />

        {TEMPLATES.map(cat => (
          <div key={cat.cat} style={{ marginBottom: 24 }}>
            <SectionLabel>{cat.cat}</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {cat.items.map(tmpl => (
                <div
                  key={tmpl.id}
                  title={tmpl.live ? undefined : 'Coming soon'}
                  onClick={tmpl.live ? () => setSelectedTemplate(tmpl.id) : undefined}
                  style={{
                    background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 10,
                    padding: '14px 12px', cursor: tmpl.live ? 'pointer' : 'default',
                    opacity: tmpl.live ? 1 : 0.3, display: 'flex', gap: 12, alignItems: 'flex-start',
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={tmpl.live ? (e) => { e.currentTarget.style.borderColor = t.border.hover; e.currentTarget.style.transform = 'translateY(-1px)'; } : undefined}
                  onMouseLeave={tmpl.live ? (e) => { e.currentTarget.style.borderColor = t.border.default; e.currentTarget.style.transform = 'none'; } : undefined}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: t.bg.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.text.secondary, flexShrink: 0 }}>
                    {ICONS[tmpl.id]}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {tmpl.name}
                      {tmpl.live && <span style={{ fontSize: 8, fontWeight: 600, color: t.status.success, textTransform: 'uppercase' as const, letterSpacing: '0.04em', padding: '1px 5px', borderRadius: 3 }}>LIVE</span>}
                    </div>
                    <div style={{ fontSize: 11, color: t.text.tertiary, marginTop: 2 }}>
                      {tmpl.live ? TEMPLATE_DESCRIPTIONS[tmpl.id] : 'Coming soon'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </PageShell>
    );
  }

  // ═══════════════════════════════════════════════
  // WORKSPACE VIEW — template selected
  // ═══════════════════════════════════════════════
  const templateName = TEMPLATES.flatMap(c => c.items).find(t => t.id === selectedTemplate)?.name || selectedTemplate;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      {/* Workspace header bar */}
      <div style={{
        height: 44, flexShrink: 0, borderBottom: `0.5px solid ${t.border.default}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setSelectedTemplate(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
            color: t.text.secondary, fontSize: 13, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3L5 8l5 5"/></svg>
            Design
          </button>
          <span style={{ color: t.text.tertiary, fontSize: 13 }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>{templateName}</span>
        </div>
        {clientDropdown}
      </div>

      {/* Workspace body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Fields panel */}
        <div style={{ width: 260, flexShrink: 0, borderRight: `0.5px solid ${t.border.default}`, overflowY: 'auto', padding: '16px 14px' }}>
          {bk && (
            <div style={{ background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: t.text.tertiary, marginBottom: 8 }}>Brand assets</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {(['color', 'light', 'dark'] as const).map(slot => {
                  const file = bk.logos?.[slot]?.find((f: any) => f.data && /\.(png|svg|jpg)$/i.test(f.name));
                  return <div key={slot} style={{ width: 32, height: 32, borderRadius: 5, border: `0.5px solid ${t.border.default}`, background: slot === 'dark' ? '#1a1a1a' : t.bg.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
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
          <FieldEditor fields={fields} onChange={handleFieldsChange} sources={{}} assetType={(selectedTemplate || 'yard-sign') as any} clientId={selectedClient} hasBrandKit={!!bk} />
        </div>

        {/* Canvas area */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg.surfaceHover, overflow: 'auto' }}>
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
        </div>
      </div>
    </div>
  );
}
