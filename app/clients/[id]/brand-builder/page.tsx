'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  DB, loadClients, loadContacts, loadAllBrandKits,
} from '@/lib/database';
import supabase from '@/lib/supabase';
import { extractHex } from '@/lib/utils';
import { Client, Contact } from '@/lib/types';
import {
  AssetType, ASSET_TYPES, BrandBuilderFields, DEFAULT_FIELDS,
} from '@/components/brand-builder/types';
import FieldEditor from '@/components/brand-builder/FieldEditor';
import AssetPreview from '@/components/brand-builder/AssetPreview';
import dynamic from 'next/dynamic';
import { getYardSignTemplate } from '@/lib/templates/yard-sign';
import { getBusinessCardTemplate, getBusinessCardBackTemplate } from '@/lib/templates/business-card';
import { useTheme } from '@/lib/theme';
import { motion } from 'framer-motion';

const DesignCanvas = dynamic(
  () => import('@/components/design-studio/DesignCanvas'),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', opacity: 0.5, fontSize: 13 }}>Loading editor...</div> }
);

export default function BrandBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const clientId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [primaryContact, setPrimaryContact] = useState<Contact | null>(null);
  const [assetType, setAssetType] = useState<AssetType | null>(null);

  // Reset asset type when breadcrumb "Brand Builder" is clicked
  useEffect(() => {
    if (searchParams.get('reset')) {
      setAssetType(null);
      window.dispatchEvent(new CustomEvent('bbAssetTypeChange', { detail: null }));
      router.replace(`/clients/${clientId}/brand-builder`);
    }
  }, [searchParams, clientId, router]);

  // Dispatch asset type to breadcrumb + sidebar sync
  const handleAssetTypeChange = useCallback((type: AssetType) => {
    setAssetType(type);
    window.dispatchEvent(new CustomEvent('bbAssetTypeChange', { detail: type }));
  }, []);

  // Listen for sidebar asset selection
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail as AssetType;
      if (id) handleAssetTypeChange(id);
    };
    window.addEventListener('sidebarAssetSelect', handler);

    // Listen for sidebar "Design Studio" click to reset template
    const resetHandler = () => {
      setAssetType(null);
      window.dispatchEvent(new CustomEvent('bbAssetTypeChange', { detail: null }));
    };
    window.addEventListener('sidebarResetTemplate', resetHandler);

    return () => {
      window.removeEventListener('sidebarAssetSelect', handler);
      window.removeEventListener('sidebarResetTemplate', resetHandler);
    };
  }, [handleAssetTypeChange]);
  const [fields, setFields] = useState<BrandBuilderFields>(DEFAULT_FIELDS);
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');
  const [sources, setSources] = useState<Record<string, string>>({});
  const [hasBrandKit, setHasBrandKit] = useState(false);

  // Load data
  useEffect(() => {
    const init = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      if (!DB.contacts[clientId]) await loadContacts(clientId);
      const hasBk = DB.clients.some((c) => c.brandKit?._id);
      if (!hasBk) await loadAllBrandKits();

      const foundClient = DB.clients.find((c) => c.id === clientId);
      if (!foundClient) {
        router.push('/');
        return;
      }

      setClient(foundClient);

      // Get primary contact
      const contacts = DB.contacts[clientId] || [];
      const primary = contacts.find((c) => c.isPrimary) || contacts[0] || null;
      setPrimaryContact(primary);

      // Auto-populate fields
      const newFields = { ...DEFAULT_FIELDS };
      const newSources: Record<string, string> = {};

      // From client record
      newFields.companyName = foundClient.company || foundClient.name || '';
      if (newFields.companyName) newSources.companyName = 'Client';

      newFields.address = foundClient.address || '';
      if (newFields.address) newSources.address = 'Client';

      newFields.website = foundClient.website || '';
      if (newFields.website) newSources.website = 'Client';

      // From primary contact
      if (primary) {
        newFields.contactName = primary.name || '';
        if (newFields.contactName) newSources.contactName = 'Contacts';

        newFields.contactTitle = primary.title || primary.role || '';
        if (newFields.contactTitle) newSources.contactTitle = 'Contacts';

        newFields.phone = primary.phone || '';
        if (newFields.phone) newSources.phone = 'Contacts';

        newFields.email = primary.email || '';
        if (newFields.email) newSources.email = 'Contacts';

        // Default website from contact email domain if no website
        if (!newFields.website && primary.email) {
          const domain = primary.email.split('@')[1];
          if (domain && !domain.includes('gmail') && !domain.includes('yahoo') && !domain.includes('hotmail')) {
            newFields.website = domain;
            newSources.website = 'Contacts';
          }
        }
      }

      // From brand kit
      const bk = foundClient.brandKit;
      if (bk) {
        const hasAnyBk = (bk.colors?.length > 0) ||
          Object.values(bk.logos || {}).some((arr: any) => arr?.length > 0);
        setHasBrandKit(hasAnyBk);

        // Logo — use primary from color slot first, then check others
        const logoSlots = ['color', 'light', 'dark', 'icon', 'secondary', 'favicon'] as const;
        for (const slot of logoSlots) {
          const logos = bk.logos?.[slot] || [];
          const primary = logos.find((f) => f.isPrimary);
          if (primary?.data) {
            newFields.logoUrl = primary.data;
            newSources.logoUrl = 'Brand Kit';
            break;
          }
          if (logos.length > 0 && logos[0]?.data) {
            newFields.logoUrl = logos[0].data;
            newSources.logoUrl = 'Brand Kit';
            break;
          }
        }

        // Colors
        if (bk.colors && bk.colors.length > 0) {
          const hex0 = extractHex(bk.colors[0]);
          if (hex0) {
            newFields.primaryColor = hex0;
            newSources.primaryColor = 'Brand Kit';
          }
          if (bk.colors.length > 1) {
            const hex1 = extractHex(bk.colors[1]);
            if (hex1) {
              newFields.secondaryColor = hex1;
              newSources.secondaryColor = 'Brand Kit';
            }
          }
        }

        // Font
        if (bk.fonts?.heading) {
          newFields.fontFamily = `${bk.fonts.heading}, Inter, sans-serif`;
        }
      }

      // QR code defaults to website
      if (newFields.website) {
        const url = newFields.website.startsWith('http')
          ? newFields.website
          : `https://${newFields.website}`;
        newFields.qrCodeUrl = url;
      }

      // Merge saved brand builder fields from Supabase (overrides auto-populated defaults)
      try {
        const { data: row } = await supabase
          .from('clients')
          .select('brand_builder_fields')
          .eq('id', clientId)
          .single();
        if (row?.brand_builder_fields && typeof row.brand_builder_fields === 'object') {
          const saved = row.brand_builder_fields as Record<string, any>;
          // Only override fields that have actual saved values (non-empty strings)
          for (const key of Object.keys(saved)) {
            if (saved[key] !== '' && saved[key] !== undefined && saved[key] !== null) {
              (newFields as any)[key] = saved[key];
            }
          }
        }
      } catch (e) {
        console.warn('[BrandBuilder] Failed to load saved fields:', e);
      }

      setFields(newFields);
      setSources(newSources);
      setIsLoading(false);
    };

    init();
  }, [clientId, router]);

  // Debounced save to Supabase
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleFieldsChange = useCallback((newFields: BrandBuilderFields) => {
    setFields(newFields);
    // Debounce 500ms then save
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('clients')
          .update({ brand_builder_fields: newFields })
          .eq('id', clientId);
        if (error) console.warn('[BrandBuilder] Save error:', error.message);
      } catch (e) {
        console.warn('[BrandBuilder] Save exception:', e);
      }
    }, 500);
  }, [clientId]);

  if (isLoading) {
    return (
      <div className="page">
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          Loading Brand Builder...
        </div>
      </div>
    );
  }

  if (!client) return null;

  const { t } = useTheme();
  const clientName = client.company || client.name || 'Client';

  return (
    <div style={{ padding: '0 0 0 0' }}>
      {/* Notice */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '12px 24px 0' }}>
      {!hasBrandKit && (
        <div style={{
          background: t.accent.subtle, border: `1px solid ${t.border.default}`, borderRadius: 8,
          padding: '10px 14px', marginBottom: 18, fontSize: 12, color: t.text.secondary,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <span>No Brand Kit found — <button onClick={() => router.push(`/clients/${clientId}/brand-kit`)} style={{ background: 'none', border: 'none', color: t.accent.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontFamily: 'inherit' }}>set up the Brand Kit first</button></span>
        </div>
      )}
      </div>

      {/* Two-column layout — fields + preview, full width (sidebar is global) */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
        {assetType ? (
          (assetType === 'yard-sign' || assetType === 'business-card') ? (
            /* Fabric.js canvas editor — Yard Sign + Business Card */
            <>
              {/* Field panel: 320px */}
              <div style={{ width: 320, flexShrink: 0, borderRight: `1px solid ${t.border.default}`, padding: 24, overflowY: 'auto', maxHeight: 'calc(100vh - 60px)' }}>
                <FieldEditor fields={fields} onChange={handleFieldsChange} sources={sources} assetType={assetType} clientId={clientId} hasBrandKit={hasBrandKit} />
              </div>
              {/* Canvas preview */}
              <div style={{ flex: 1, padding: 32, background: t.bg.surfaceHover }}>
                {/* Front/Back toggle for business cards */}
                {assetType === 'business-card' && (
                  <div style={{ display: 'inline-flex', background: t.bg.primary, borderRadius: 8, padding: 4, marginBottom: 16, border: `1px solid ${t.border.default}` }}>
                    {(['front', 'back'] as const).map((side) => (
                      <button key={side} onClick={() => setCardSide(side)} style={{
                        padding: '6px 16px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: 'none',
                        background: cardSide === side ? t.bg.surface : 'transparent',
                        color: cardSide === side ? t.text.primary : t.text.secondary,
                        cursor: 'pointer', fontFamily: 'inherit',
                        boxShadow: cardSide === side ? t.shadow.card : 'none',
                        textTransform: 'capitalize', transition: 'all 150ms',
                      }}>{side}</button>
                    ))}
                  </div>
                )}

                {/* Fabric.js Canvas */}
                <DesignCanvas
                  key={assetType === 'yard-sign'
                    ? `ys-${fields.signSize}-${fields.showHeadline}-${fields.showPhone}-${fields.showCompanyName}-${fields.showQrCode}`
                    : `bc-${cardSide}-${fields.showCompanyName}-${fields.showContactName}-${fields.showPhone}-${fields.showEmail}-${fields.showWebsite}-${fields.showQrCode}-${fields.showTagline}-${fields.showContactTitle}`
                  }
                  template={assetType === 'yard-sign'
                    ? getYardSignTemplate({
                        companyName: fields.companyName || '',
                        phone: fields.phone || '',
                        headline: fields.headline || 'Free Estimates!',
                        logoUrl: fields.logoUrl || null,
                        qrCodeUrl: fields.qrCodeUrl || fields.website || '',
                        brandColor: fields.primaryColor || '#28502e',
                        size: fields.signSize || '18x24',
                        displayWidth: 540,
                        showHeadline: fields.showHeadline,
                        showPhone: fields.showPhone,
                        showCompanyName: fields.showCompanyName,
                        showQrCode: fields.showQrCode,
                      })
                    : cardSide === 'front'
                      ? getBusinessCardTemplate({
                          companyName: fields.companyName || '',
                          contactName: fields.contactName || '',
                          contactTitle: fields.contactTitle || '',
                          phone: fields.phone || '',
                          email: fields.email || '',
                          website: fields.website || '',
                          tagline: fields.tagline || '',
                          logoUrl: fields.logoUrl || null,
                          qrCodeUrl: fields.qrCodeUrl || fields.website || '',
                          brandColor: fields.primaryColor || '#2563eb',
                          displayWidth: 525,
                          showCompanyName: fields.showCompanyName,
                          showContactName: fields.showContactName,
                          showContactTitle: fields.showContactTitle,
                          showPhone: fields.showPhone,
                          showEmail: fields.showEmail,
                          showWebsite: fields.showWebsite,
                          showTagline: fields.showTagline,
                          showQrCode: fields.showQrCode,
                        })
                      : getBusinessCardBackTemplate({
                          companyName: fields.companyName || '',
                          logoUrl: fields.logoUrl || null,
                          brandColor: fields.primaryColor || '#2563eb',
                          displayWidth: 525,
                        })
                  }
                  brandColor={fields.primaryColor || (assetType === 'yard-sign' ? '#28502e' : '#2563eb')}
                  darkColor={fields.secondaryColor || '#1a1a1a'}
                  signSize={fields.signSize || '18x24'}
                  savedState={null}
                  onSave={(json) => {
                    console.log('[DesignCanvas] State saved:', json.length, 'bytes');
                  }}
                />
              </div>
            </>
          ) : (
            /* Other templates — existing FieldEditor + AssetPreview layout */
            <>
              {/* Fields: 420px fixed */}
              <div style={{ width: 420, flexShrink: 0, borderRight: `1px solid ${t.border.default}`, padding: 32, overflowY: 'auto', maxHeight: 'calc(100vh - 60px)' }}>
                <FieldEditor fields={fields} onChange={handleFieldsChange} sources={sources} assetType={assetType} clientId={clientId} hasBrandKit={hasBrandKit} />
              </div>
              {/* Preview: flex: 1 */}
              <div style={{ flex: 1, padding: 32, background: t.bg.surfaceHover }}>
                <AssetPreview assetType={assetType} fields={fields} clientId={clientId} onFieldsChange={handleFieldsChange} />
              </div>
            </>
          )
        ) : (
          <div style={{ flex: 1, padding: 32 }}>
            {/* Print section */}
            <div style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Print</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              <TemplateCard id="business-card" label="Business Cards" desc="Front + Back" status="not-started" onClick={() => handleAssetTypeChange('business-card' as AssetType)} />
              <TemplateCard id="yard-sign" label="Yard Signs" desc="5 sizes" status="in-progress" onClick={() => handleAssetTypeChange('yard-sign' as AssetType)} />
              <TemplateCard id="vehicle-magnet" label="Vehicle Magnets" desc="24 × 12 in" status="not-started" onClick={() => handleAssetTypeChange('vehicle-magnet' as AssetType)} />
              <TemplateCard id="t-shirt" label="T-Shirts" desc="Front + Back" status="not-started" onClick={() => handleAssetTypeChange('t-shirt' as AssetType)} />
              <TemplateCard id="door-hanger" label="Door Hangers" desc="4.25 × 11 in" status="not-started" onClick={() => handleAssetTypeChange('door-hanger' as AssetType)} />
              <TemplateCard id="flyer" label="Flyers" desc="8.5 × 11 in" status="not-started" onClick={() => handleAssetTypeChange('flyer' as AssetType)} />
              <TemplateCard id="poster" label="Posters" desc="3 sizes" status="not-started" />
              <TemplateCard id="one-pager" label="One-Pagers" desc="Sales + case study" status="not-started" />
              <TemplateCard id="direct-mail" label="Direct Mail" desc="Postcards · 6 × 4 in" status="not-started" />
            </div>

            {/* Digital section */}
            <div style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Digital</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <TemplateCard id="email-signature" label="Email Signature" desc="Gmail · Outlook" status="not-started" onClick={() => router.push(`/clients/${clientId}/email-signature`)} />
              <TemplateCard id="social-graphics" label="Social Graphics" desc="IG · LinkedIn · FB" status="not-started" />
              <TemplateCard id="web-banners" label="Web Banners" desc="Hero · sidebar · leaderboard" status="coming-soon" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Clean flat template card */
function TemplateCard({ id, label, desc, onClick, status = 'not-started' }: {
  id: string; label: string; desc: string;
  onClick?: () => void; status?: 'in-progress' | 'not-started' | 'coming-soon';
}) {
  const { t } = useTheme();
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? t.bg.surfaceHover : t.bg.surface,
        border: `1px solid ${hovered ? t.border.hover : t.border.default}`,
        borderRadius: t.radius.md, padding: 16, minHeight: 100,
        cursor: 'pointer', transition: 'border-color 150ms, background 150ms',
        width: '100%', textAlign: 'left' as const, fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column' as const, color: t.text.primary,
      }}
    >
      <div style={{ color: hovered ? t.accent.text : t.text.secondary, transition: 'color 150ms', marginBottom: 10 }}>
        <AssetIcon id={id} size={20} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 12, color: t.text.secondary, marginTop: 2, flex: 1 }}>{desc}</div>
      <div style={{ marginTop: 8 }}>
        {status === 'in-progress' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: t.radius.sm, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>In progress</span>}
        {status === 'coming-soon' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: t.radius.sm, background: 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}>Coming soon</span>}
        {status === 'not-started' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: t.radius.sm, background: t.bg.primary, color: t.text.secondary }}>Not started</span>}
      </div>
    </motion.button>
  );
}

/* Monochrome stroke-only template icons */
function AssetIcon({ id, size = 24 }: { id: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 };
  switch (id) {
    case 'business-card': return <svg {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="6" y1="12" x2="14" y2="12" strokeLinecap="round"/><line x1="6" y1="15" x2="10" y2="15" strokeLinecap="round"/><rect x="16" y="9" width="4" height="4" rx="1" opacity="0.3" fill="currentColor"/></svg>;
    case 'yard-sign': return <svg {...p}><rect x="4" y="2" width="16" height="12" rx="2"/><line x1="9" y1="14" x2="9" y2="22" strokeLinecap="round"/><line x1="15" y1="14" x2="15" y2="22" strokeLinecap="round"/></svg>;
    case 'vehicle-magnet': return <svg {...p}><rect x="1" y="6" width="16" height="10" rx="2"/><path d="M17 8l4 4v4h-4"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>;
    case 't-shirt': return <svg {...p}><path d="M8 2l-2 0-4 4v3h4v13h12V9h4V6l-4-4h-2c0 0-1 2-4 2s-4-2-4-2z"/></svg>;
    case 'door-hanger': return <svg {...p}><rect x="6" y="1" width="12" height="22" rx="2"/><circle cx="12" cy="5" r="2.5"/></svg>;
    case 'flyer': return <svg {...p}><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="7" x2="16" y2="7" strokeLinecap="round"/><line x1="8" y1="11" x2="14" y2="11" strokeLinecap="round"/><line x1="8" y1="15" x2="12" y2="15" strokeLinecap="round"/></svg>;
    case 'poster': return <svg {...p}><rect x="3" y="1" width="18" height="22" rx="2"/><rect x="6" y="4" width="12" height="8" rx="1" opacity="0.3" fill="currentColor" stroke="none"/><line x1="6" y1="15" x2="18" y2="15" strokeLinecap="round"/><line x1="6" y1="18" x2="14" y2="18" strokeLinecap="round"/></svg>;
    case 'one-pager': return <svg {...p}><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="6" x2="16" y2="6" strokeLinecap="round"/><line x1="8" y1="10" x2="16" y2="10" strokeLinecap="round"/><rect x="8" y="13" width="8" height="5" rx="1" opacity="0.2" fill="currentColor" stroke="none"/></svg>;
    case 'direct-mail': return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/></svg>;
    case 'email-signature': return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/><line x1="6" y1="14" x2="10" y2="14" strokeLinecap="round"/><line x1="6" y1="17" x2="8" y2="17" strokeLinecap="round"/></svg>;
    case 'social-graphics': return <svg {...p}><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="18" cy="6" r="1.5" fill="currentColor" stroke="none"/></svg>;
    case 'web-banners': return <svg {...p}><rect x="1" y="5" width="22" height="14" rx="2"/><line x1="1" y1="9" x2="23" y2="9"/><rect x="4" y="11" width="6" height="5" rx="1" opacity="0.2" fill="currentColor" stroke="none"/></svg>;
    default: return null;
  }
}
