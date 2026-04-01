'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  DB, loadClients, loadContacts, loadAllBrandKits,
} from '@/lib/database';
import { extractHex } from '@/lib/utils';
import { Client, Contact } from '@/lib/types';
import {
  AssetType, ASSET_TYPES, BrandBuilderFields, DEFAULT_FIELDS,
} from '@/components/brand-builder/types';
import FieldEditor from '@/components/brand-builder/FieldEditor';
import AssetPreview from '@/components/brand-builder/AssetPreview';

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

  // Dispatch asset type to breadcrumb nav
  const handleAssetTypeChange = useCallback((type: AssetType) => {
    setAssetType(type);
    const label = ASSET_TYPES.find((t) => t.id === type)?.label || type;
    window.dispatchEvent(new CustomEvent('bbAssetTypeChange', { detail: label }));
  }, []);
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

      setFields(newFields);
      setSources(newSources);
      setIsLoading(false);
    };

    init();
  }, [clientId, router]);

  const handleFieldsChange = useCallback((newFields: BrandBuilderFields) => {
    setFields(newFields);
  }, []);

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

      {/* Three-column layout — full width */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)', borderTop: '1px solid #e5e7eb', background: '#fff' }}>

        {/* Sidebar: 200px fixed */}
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid #e5e7eb', padding: '20px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.5px', padding: '0 14px', marginBottom: 8 }}>Assets</div>
          {ASSET_TYPES.map((t) => {
            const active = assetType === t.id;
            return (
              <button key={t.id} onClick={() => handleAssetTypeChange(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 16px)',
                padding: '8px 14px', margin: '0 8px', borderRadius: 6, border: 'none',
                fontSize: 13, color: active ? '#111827' : '#6b7280', fontWeight: active ? 500 : 400,
                background: active ? '#f3f4f6' : 'transparent', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', textAlign: 'left',
              }}>
                <AssetIcon id={t.id} size={20} />
                {t.label}
              </button>
            );
          })}
        </div>

        {assetType ? (
          <>
            {/* Fields: 420px fixed */}
            <div style={{ width: 420, flexShrink: 0, borderRight: '1px solid #e5e7eb', padding: 24, overflowY: 'auto', maxHeight: 'calc(100vh - 60px)' }}>
              <FieldEditor fields={fields} onChange={handleFieldsChange} sources={sources} assetType={assetType} clientId={clientId} hasBrandKit={hasBrandKit} />
            </div>
            {/* Preview: flex: 1 */}
            <div style={{ flex: 1, padding: 24, background: '#f9fafb' }}>
              <AssetPreview assetType={assetType} fields={fields} clientId={clientId} />
            </div>
          </>
        ) : (
          /* Welcome intro state */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: 520 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" style={{ marginBottom: 16 }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#111827', marginBottom: 8 }}>Create print-ready assets</div>
              <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, maxWidth: 400, margin: '0 auto 24px' }}>
                Choose an asset type to start designing. Every template pulls from your client's Brand Kit automatically.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 480, margin: '0 auto' }}>
                {ASSET_TYPES.map((t) => (
                  <button key={t.id} onClick={() => handleAssetTypeChange(t.id)} style={{
                    padding: 16, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff',
                    cursor: 'pointer', textAlign: 'center', fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                      <AssetIcon id={t.id} size={28} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{t.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Emoji-hybrid filled icons */
function AssetIcon({ id, size = 20 }: { id: string; size?: number }) {
  const s = size;
  if (id === 'business-card') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="1" y="4" width="18" height="12" rx="2" fill="#DBEAFE" stroke="#2563EB" strokeWidth="1.2"/>
      <rect x="1" y="4" width="18" height="3.5" rx="2" fill="#2563EB"/><rect x="1" y="6" width="18" height="1.5" fill="#2563EB"/>
      <line x1="4" y1="11" x2="10" y2="11" stroke="#2563EB" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="4" y1="13.5" x2="8" y2="13.5" stroke="#93C5FD" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
  if (id === 'yard-sign') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="10" rx="1.5" fill="#FEE2E2" stroke="#DC2626" strokeWidth="1.2"/>
      <line x1="6" y1="6" x2="14" y2="6" stroke="#DC2626" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="6" y1="9" x2="11" y2="9" stroke="#FCA5A5" strokeWidth="1" strokeLinecap="round"/>
      <line x1="7.5" y1="12" x2="7.5" y2="18.5" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12.5" y1="12" x2="12.5" y2="18.5" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  if (id === 'vehicle-magnet') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="1" y="6" width="13" height="8" rx="1.5" fill="#F1F5F9" stroke="#64748B" strokeWidth="1.2"/>
      <path d="M14 6 L18 10 L18 14 L14 14 Z" fill="#E2E8F0" stroke="#64748B" strokeWidth="1.2"/>
      <circle cx="5" cy="15" r="2" fill="#E2E8F0" stroke="#64748B" strokeWidth="1"/><circle cx="15.5" cy="15" r="2" fill="#E2E8F0" stroke="#64748B" strokeWidth="1"/>
      <rect x="3" y="8.5" width="9" height="4" rx="1" fill="#0D9488" opacity="0.85"/>
    </svg>
  );
  if (id === 't-shirt') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M7 2 L5 2 L1.5 5.5 L1.5 7.5 L4.5 7.5 L4.5 18 L15.5 18 L15.5 7.5 L18.5 7.5 L18.5 5.5 L15 2 L13 2 C13 2 12 4 10 4 C8 4 7 2 7 2Z" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.2"/>
      <path d="M7 2 C7 2 8 4 10 4 C12 4 13 2 13 2" stroke="#C4B5FD" strokeWidth="1" fill="none"/>
    </svg>
  );
  if (id === 'door-hanger') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="5" y="1" width="10" height="18" rx="2" fill="#FFF7ED" stroke="#EA580C" strokeWidth="1.2"/>
      <rect x="5" y="1" width="10" height="5.5" rx="2" fill="#EA580C"/><rect x="5" y="5" width="10" height="1.5" fill="#EA580C"/>
      <circle cx="10" cy="4" r="2" fill="#FFF7ED" stroke="#FFF7ED" strokeWidth="0.5"/>
      <line x1="8" y1="10.5" x2="12" y2="10.5" stroke="#FDBA74" strokeWidth="1" strokeLinecap="round"/>
      <line x1="8" y1="13" x2="12" y2="13" stroke="#FDBA74" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
  if (id === 'flyer') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="1" width="14" height="18" rx="1.5" fill="#F0FDF4" stroke="#059669" strokeWidth="1.2"/>
      <rect x="3" y="1" width="14" height="5" rx="1.5" fill="#059669"/><rect x="3" y="4.5" width="14" height="1.5" fill="#059669"/>
      <line x1="6" y1="3.5" x2="12" y2="3.5" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
      <line x1="6" y1="10" x2="14" y2="10" stroke="#6EE7B7" strokeWidth="1" strokeLinecap="round"/>
      <line x1="6" y1="12.5" x2="11" y2="12.5" stroke="#6EE7B7" strokeWidth="1" strokeLinecap="round"/>
      <rect x="6" y="14.5" width="3.5" height="3" rx="0.5" fill="#D1FAE5"/>
    </svg>
  );
  return null;
}
