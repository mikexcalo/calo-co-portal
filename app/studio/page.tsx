'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { DB, loadClients, loadContacts, loadAllBrandKits } from '@/lib/database';
import { Client } from '@/lib/types';
import { extractHex } from '@/lib/utils';
import HelmSpinner from '@/components/shared/HelmSpinner';
import dynamic from 'next/dynamic';
import { getYardSignTemplate } from '@/lib/templates/yard-sign';
import { BrandBuilderFields, DEFAULT_FIELDS } from '@/components/brand-builder/types';
import FieldEditor from '@/components/brand-builder/FieldEditor';
import supabase from '@/lib/supabase';

const DesignCanvas = dynamic(() => import('@/components/design-studio/DesignCanvas'), { ssr: false, loading: () => <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HelmSpinner /></div> });

const STUDIO_CLIENT_KEY = 'manifest-studio-client';
const STUDIO_TEMPLATE_KEY = 'manifest-studio-template';

const CATEGORIES = [
  { label: 'Get Noticed in the Neighborhood', templates: [
    { id: 'yard-sign', name: 'Yard Signs', desc: '5 sizes' },
    { id: 'door-hanger', name: 'Door Hangers', desc: '4.25 × 11 in' },
    { id: 'vehicle-magnet', name: 'Vehicle Magnets', desc: '24 × 12 in' },
    { id: 'flyer', name: 'Flyers', desc: '8.5 × 11 in' },
    { id: 'direct-mail', name: 'Direct Mail', desc: 'Postcards · 6 × 4 in' },
  ]},
  { label: 'Look Professional Everywhere', templates: [
    { id: 'business-card', name: 'Business Cards', desc: 'Front + Back' },
    { id: 'email-signature', name: 'Email Signature', desc: 'Gmail · Outlook' },
    { id: 'one-pager', name: 'One-Pagers', desc: 'Sales + case study' },
  ]},
  { label: 'Stand Out Online', templates: [
    { id: 'social-graphics', name: 'Social Graphics', desc: 'IG · LinkedIn · FB' },
    { id: 'web-banners', name: 'Web Banners', desc: 'Hero · sidebar · leaderboard' },
  ]},
  { label: 'Gear Up the Crew', templates: [
    { id: 't-shirt', name: 'T-Shirts', desc: 'Front + Back' },
    { id: 'poster', name: 'Posters', desc: '3 sizes' },
  ]},
];

const ICONS: Record<string, React.ReactNode> = {
  'yard-sign': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="2" width="16" height="12" rx="2"/><line x1="9" y1="14" x2="9" y2="22" strokeLinecap="round"/><line x1="15" y1="14" x2="15" y2="22" strokeLinecap="round"/></svg>,
  'business-card': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="6" y1="12" x2="14" y2="12" strokeLinecap="round"/></svg>,
  'door-hanger': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="6" y="1" width="12" height="22" rx="2"/><circle cx="12" cy="5" r="2.5"/></svg>,
  'vehicle-magnet': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="6" width="16" height="10" rx="2"/><path d="M17 8l4 4v4h-4"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>,
  'flyer': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="7" x2="16" y2="7" strokeLinecap="round"/></svg>,
  'direct-mail': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/></svg>,
  'email-signature': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/></svg>,
  'one-pager': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="6" x2="16" y2="6" strokeLinecap="round"/></svg>,
  'social-graphics': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/></svg>,
  'web-banners': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="5" width="22" height="14" rx="2"/><line x1="1" y1="9" x2="23" y2="9"/></svg>,
  't-shirt': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M8 2l-2 0-4 4v3h4v13h12V9h4V6l-4-4h-2c0 0-1 2-4 2s-4-2-4-2z"/></svg>,
  'poster': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="1" width="18" height="22" rx="2"/><line x1="6" y1="15" x2="18" y2="15" strokeLinecap="round"/></svg>,
};

export default function StudioPage() {
  const { t } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('agency');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bkOpen, setBkOpen] = useState(false);

  // Yard sign state
  const [fields, setFields] = useState<BrandBuilderFields>(DEFAULT_FIELDS);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      if (!DB.clients.some(c => c.brandKit?._id)) await loadAllBrandKits();
      setClients(DB.clients);
      // Restore last state
      const savedClient = localStorage.getItem(STUDIO_CLIENT_KEY);
      const savedTemplate = localStorage.getItem(STUDIO_TEMPLATE_KEY);
      if (savedClient) setSelectedClient(savedClient);
      if (savedTemplate) setSelectedTemplate(savedTemplate);
      setLoading(false);
    };
    init();
  }, []);

  // Load fields when client or template changes
  useEffect(() => {
    if (selectedClient === 'agency' || !selectedTemplate) return;
    const loadFields = async () => {
      const client = DB.clients.find(c => c.id === selectedClient);
      if (!client) return;
      const newFields = { ...DEFAULT_FIELDS };
      // Auto-populate from client
      newFields.companyName = client.company || client.name || '';
      newFields.website = client.website || '';
      newFields.address = client.address || '';
      // Contact
      if (!DB.contacts[selectedClient]) await loadContacts(selectedClient);
      const contacts = DB.contacts[selectedClient] || [];
      const primary = contacts.find(c => c.isPrimary) || contacts[0];
      if (primary) {
        newFields.contactName = primary.name || '';
        newFields.phone = primary.phone || '';
        newFields.email = primary.email || '';
        newFields.contactTitle = primary.title || primary.role || '';
      }
      // Brand kit
      const bk = client.brandKit;
      if (bk) {
        const slots = ['color', 'light', 'dark', 'icon'] as const;
        for (const slot of slots) {
          const logos = bk.logos?.[slot] || [];
          const svgFile = logos.find(f => /\.svg$/i.test(f.name || '') && f.data);
          const primaryFile = logos.find(f => f.isPrimary) || logos[0];
          if (svgFile?.data) { newFields.logoUrl = svgFile.data; break; }
          if (primaryFile?.data) { newFields.logoUrl = primaryFile.data; break; }
        }
        if (bk.colors?.length) { const hex = extractHex(bk.colors[0]); if (hex) newFields.primaryColor = hex; }
      }
      // QR from website
      if (newFields.website) {
        newFields.qrCodeUrl = newFields.website.startsWith('http') ? newFields.website : `https://${newFields.website}`;
      }
      // Merge saved fields from Supabase
      try {
        const { data: row } = await supabase.from('clients').select('brand_builder_fields').eq('id', selectedClient).single();
        if (row?.brand_builder_fields && typeof row.brand_builder_fields === 'object') {
          const saved = row.brand_builder_fields as Record<string, any>;
          for (const key of Object.keys(saved)) {
            if (saved[key] !== '' && saved[key] !== undefined && saved[key] !== null) (newFields as any)[key] = saved[key];
          }
        }
      } catch {}
      setFields(newFields);
    };
    loadFields();
  }, [selectedClient, selectedTemplate]);

  // Persist state
  useEffect(() => { localStorage.setItem(STUDIO_CLIENT_KEY, selectedClient); }, [selectedClient]);
  useEffect(() => { if (selectedTemplate) localStorage.setItem(STUDIO_TEMPLATE_KEY, selectedTemplate); }, [selectedTemplate]);

  const handleFieldsChange = useCallback((newFields: BrandBuilderFields) => {
    setFields(newFields);
    if (selectedClient === 'agency') return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await supabase.from('clients').update({ brand_builder_fields: newFields }).eq('id', selectedClient); } catch {}
    }, 500);
  }, [selectedClient]);

  if (loading) return <div style={{ position: 'fixed', bottom: 24, right: 24, opacity: 0.4, zIndex: 10 }}><HelmSpinner size={20} /></div>;

  const client = clients.find(c => c.id === selectedClient);
  const clientName = selectedClient === 'agency' ? 'Agency' : (client?.company || 'Client');
  const bk = client?.brandKit;
  const bkBrandKitLink = selectedClient === 'agency' ? '/agency/brand-kit' : `/clients/${selectedClient}/brand-kit`;

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
                  style={{ padding: '8px 12px', fontSize: 13, color: selectedClient === 'agency' ? t.accent.text : t.text.primary, cursor: 'pointer', background: selectedClient === 'agency' ? t.accent.subtle : 'transparent' }}>Agency</div>
                {clients.map(c => (
                  <div key={c.id} onClick={() => { setSelectedClient(c.id); setDropdownOpen(false); setSelectedTemplate(null); }}
                    style={{ padding: '8px 12px', fontSize: 13, color: selectedClient === c.id ? t.accent.text : t.text.primary, cursor: 'pointer', background: selectedClient === c.id ? t.accent.subtle : 'transparent' }}>{c.company || c.name}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Brand Kit Summary (collapsible) */}
        <div style={{ borderBottom: `1px solid ${t.border.default}` }}>
          <div onClick={() => setBkOpen(!bkOpen)} style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Brand Kit</span>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.5" style={{ transform: `rotate(${bkOpen ? 180 : 0}deg)`, transition: 'transform 200ms' }}><path d="M4 6l4 4 4-4"/></svg>
          </div>
          {bkOpen && (
            <div style={{ padding: '0 16px 12px', fontSize: 12 }}>
              {/* Logos */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: t.text.tertiary, textTransform: 'uppercase', marginBottom: 4 }}>Logos</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['color', 'light', 'dark'] as const).map(slot => {
                    const file = bk?.logos?.[slot]?.find((f: any) => f.data && /\.(png|svg|jpg)$/i.test(f.name));
                    return (
                      <div key={slot} style={{ width: 40, height: 40, borderRadius: 6, border: `1px solid ${t.border.default}`, background: slot === 'dark' ? '#1a1a1a' : '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {file?.data ? <img src={file.data} alt="" style={{ maxWidth: 32, maxHeight: 32, objectFit: 'contain' }} /> : <span style={{ fontSize: 8, color: t.text.tertiary }}>—</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Colors */}
              {bk?.colors && bk.colors.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: t.text.tertiary, textTransform: 'uppercase', marginBottom: 4 }}>Colors</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {bk.colors.slice(0, 5).map((c: any, i: number) => {
                      const hex = typeof c === 'string' ? c : c?.hex || '#ccc';
                      return <div key={i} style={{ width: 20, height: 20, borderRadius: 4, background: hex, border: `1px solid ${t.border.default}` }} />;
                    })}
                  </div>
                </div>
              )}
              {/* Fonts */}
              {bk?.fonts && (bk.fonts.heading || bk.fonts.body) && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: t.text.tertiary, textTransform: 'uppercase', marginBottom: 4 }}>Fonts</div>
                  {bk.fonts.heading && <div style={{ fontSize: 11, color: t.text.secondary }}>Heading: {bk.fonts.heading}</div>}
                  {bk.fonts.body && <div style={{ fontSize: 11, color: t.text.secondary }}>Body: {bk.fonts.body}</div>}
                </div>
              )}
              <span onClick={() => router.push(bkBrandKitLink)} style={{ fontSize: 11, color: t.accent.text, cursor: 'pointer' }}>Edit Brand Kit →</span>
            </div>
          )}
        </div>

        {/* Templates or Field Editor */}
        <div style={{ padding: '12px 16px' }}>
          {selectedTemplate === 'yard-sign' && selectedClient !== 'agency' ? (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Yard Sign Fields</div>
              <FieldEditor fields={fields} onChange={handleFieldsChange} sources={{}} assetType="yard-sign" clientId={selectedClient} hasBrandKit={!!bk} />
              <div style={{ marginTop: 12 }}>
                <span onClick={() => setSelectedTemplate(null)} style={{ fontSize: 11, color: t.text.tertiary, cursor: 'pointer' }}>← Back to templates</span>
              </div>
            </>
          ) : (
            CATEGORIES.map(cat => (
              <div key={cat.label} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{cat.label}</div>
                {cat.templates.map(tmpl => {
                  const isActive = selectedTemplate === tmpl.id;
                  return (
                    <div key={tmpl.id} onClick={() => setSelectedTemplate(tmpl.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: isActive ? t.accent.subtle : 'transparent', transition: 'background 150ms' }}
                      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = t.bg.surfaceHover; }}
                      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <span style={{ color: isActive ? t.accent.text : t.text.secondary, flexShrink: 0 }}>{ICONS[tmpl.id]}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, color: isActive ? t.accent.text : t.text.primary }}>{tmpl.name}</div>
                        <div style={{ fontSize: 11, color: t.text.tertiary }}>{tmpl.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ flex: 1, overflow: 'auto', background: t.bg.surfaceHover }}>
        {selectedTemplate === 'yard-sign' && selectedClient !== 'agency' ? (
          <div style={{ padding: 32 }}>
            <DesignCanvas
              key={`ys-${fields.signSize}-${fields.showHeadline}-${fields.showPhone}-${fields.showCompanyName}-${fields.showQrCode}-${fields.showTagline}-${fields.showEmail}-${fields.showWebsite}-${fields.showLogo}`}
              template={getYardSignTemplate({
                companyName: fields.companyName || '',
                phone: fields.phone || '',
                headline: fields.headline || 'Free Consultations \u2022 Fully Insured \u2022 Budget-Friendly',
                logoUrl: fields.logoUrl || null,
                qrCodeUrl: fields.qrCodeUrl || fields.website || '',
                brandColor: fields.primaryColor || '#28502e',
                size: fields.signSize || '18x24',
                displayWidth: 540,
                showHeadline: fields.showHeadline,
                showPhone: fields.showPhone,
                showCompanyName: fields.showCompanyName,
                showQrCode: fields.showQrCode,
                showLogo: (fields as any).showLogo !== false,
                tagline: fields.tagline || '',
                showTagline: fields.showTagline,
                email: fields.email || '',
                showEmail: fields.showEmail,
                website: fields.website || '',
                showWebsite: fields.showWebsite,
              })}
              brandColor={fields.primaryColor || '#28502e'}
              darkColor={(fields as any).secondaryColor || '#1a1a1a'}
              signSize={fields.signSize || '18x24'}
              savedState={null}
            />
          </div>
        ) : selectedTemplate ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ opacity: 0.2, marginBottom: 16 }}>{ICONS[selectedTemplate] ? <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={t.text.tertiary} strokeWidth="1">{(ICONS[selectedTemplate] as any)?.props?.children}</svg> : null}</div>
              <div style={{ fontSize: 16, fontWeight: 500, color: t.text.primary, marginBottom: 4 }}>{CATEGORIES.flatMap(c => c.templates).find(t => t.id === selectedTemplate)?.name}</div>
              <div style={{ fontSize: 13, color: t.text.tertiary }}>Coming soon — we&apos;re building this next</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center', opacity: 0.5 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={t.text.tertiary} strokeWidth="1.3" strokeLinecap="round" style={{ marginBottom: 12 }}>
                <circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>
                <line x1="12" y1="3.5" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="20.5"/>
                <line x1="3.5" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="20.5" y2="12"/>
              </svg>
              <div style={{ fontSize: 14, color: t.text.tertiary }}>Select a template to start designing</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
