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
import { Section, CardGrid, Card, InfoBar } from '@/components/shared/PageLayout';
import dynamic from 'next/dynamic';
import { getYardSignTemplate } from '@/lib/templates/yard-sign';

const DesignCanvas = dynamic(
  () => import('@/components/design-studio/DesignCanvas'),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading editor...</div> }
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

  const clientName = client.company || client.name || 'Client';

  return (
    <div style={{ padding: '0 0 0 0' }}>
      {/* No brand kit notice — keep some padding for this */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '12px 24px 0' }}>
      {!hasBrandKit && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
          padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span>
            No Brand Kit found —{' '}
            <button
              onClick={() => router.push(`/clients/${clientId}/brand-kit`)}
              style={{
                background: 'none', border: 'none', color: '#2563eb', fontSize: 12,
                fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              set up the Brand Kit first
            </button>
          </span>
        </div>
      )}
      </div>

      {/* Two-column layout — fields + preview, full width (sidebar is global) */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)', background: '#fff' }}>
        {assetType ? (
          assetType === 'yard-sign' ? (
            /* Yard Sign — field panel + Fabric.js canvas editor */
            <>
              {/* Field panel: 320px */}
              <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #e5e7eb', padding: 24, overflowY: 'auto', maxHeight: 'calc(100vh - 60px)' }}>
                <FieldEditor fields={fields} onChange={handleFieldsChange} sources={sources} assetType={assetType} clientId={clientId} hasBrandKit={hasBrandKit} />
              </div>
              {/* Canvas preview */}
              <div style={{ flex: 1, padding: 32, background: '#f9fafb' }}>
                {/* Size selector */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {[
                    { value: '18x24', label: '18" × 24"' },
                    { value: '24x18', label: '24" × 18" (landscape)' },
                    { value: '12x18', label: '12" × 18"' },
                    { value: '24x36', label: '24" × 36"' },
                    { value: '36x24', label: '36" × 24" (landscape)' },
                  ].map((s) => (
                    <button
                      key={s.value}
                      onClick={() => handleFieldsChange({ ...fields, signSize: s.value })}
                      style={{
                        padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                        border: fields.signSize === s.value ? '2px solid #2563eb' : '1px solid #e5e7eb',
                        background: fields.signSize === s.value ? '#eff6ff' : '#fff',
                        color: fields.signSize === s.value ? '#2563eb' : '#374151',
                        fontWeight: fields.signSize === s.value ? 600 : 400,
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Fabric.js Canvas — key includes all toggle states to force remount */}
                <DesignCanvas
                  key={`${fields.signSize}-${fields.showHeadline}-${fields.showPhone}-${fields.showCompanyName}-${fields.showQrCode}`}
                  template={getYardSignTemplate({
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
                  })}
                  brandColor={fields.primaryColor || '#28502e'}
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
              <div style={{ width: 420, flexShrink: 0, borderRight: '1px solid #e5e7eb', padding: 32, overflowY: 'auto', maxHeight: 'calc(100vh - 60px)' }}>
                <FieldEditor fields={fields} onChange={handleFieldsChange} sources={sources} assetType={assetType} clientId={clientId} hasBrandKit={hasBrandKit} />
              </div>
              {/* Preview: flex: 1 */}
              <div style={{ flex: 1, padding: 32, background: '#f9fafb' }}>
                <AssetPreview assetType={assetType} fields={fields} clientId={clientId} onFieldsChange={handleFieldsChange} />
              </div>
            </>
          )
        ) : (
          <div style={{ flex: 1, padding: 32 }}>
            {/* Brand summary bar */}
            <InfoBar>
              {client.logo ? (
                <img src={client.logo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#e5e7eb', flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{clientName}</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>·</span>
              <span style={{ fontSize: 12, color: '#2563eb', cursor: 'pointer' }} onClick={() => router.push(`/clients/${clientId}/brand-kit`)}>
                {hasBrandKit ? 'Brand Kit →' : 'Set up Brand Kit →'}
              </span>
            </InfoBar>

            {/* Print section */}
            <Section label="Print">
              <CardGrid>
                {ASSET_TYPES.map((t) => {
                  const descs: Record<string, string> = {
                    'business-card': '3.5 × 2 in', 'yard-sign': '5 sizes',
                    'vehicle-magnet': '24 × 12 in', 't-shirt': 'Front + Back',
                    'door-hanger': '4.25 × 11 in', 'flyer': '8.5 × 11 in',
                  };
                  return (
                    <Card key={t.id} onClick={() => handleAssetTypeChange(t.id)}>
                      <AssetIcon id={t.id} size={24} />
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginTop: 12, marginBottom: 2 }}>{t.label}</div>
                      <div style={{ fontSize: 13, color: '#9ca3af' }}>{descs[t.id]}</div>
                    </Card>
                  );
                })}
              </CardGrid>
            </Section>

            {/* Digital section */}
            <Section label="Digital">
              <CardGrid>
                <Card onClick={() => router.push(`/clients/${clientId}/email-signature`)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginTop: 12, marginBottom: 2 }}>Email Signature</div>
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>Gmail, Outlook, more</div>
                </Card>
                <Card disabled>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginTop: 12, marginBottom: 2 }}>Social Images</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>Coming soon</div>
                </Card>
                <Card disabled>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="4" width="20" height="6" rx="1.5"/><rect x="2" y="14" width="20" height="6" rx="1.5"/></svg>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginTop: 12, marginBottom: 2 }}>Web Banners</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>Coming soon</div>
                </Card>
              </CardGrid>
            </Section>
          </div>
        )}
      </div>
    </div>
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
    default: return null;
  }
}
