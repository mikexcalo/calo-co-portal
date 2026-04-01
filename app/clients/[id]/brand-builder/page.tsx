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
  const [assetType, setAssetType] = useState<AssetType | null>('business-card');

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
    <div className="page" style={{ paddingTop: 20, paddingBottom: 32 }}>
      {/* Header */}
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
        Brand Builder
      </h1>
      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
        Create print-ready branded assets for {clientName}
      </p>

      {/* No brand kit notice */}
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

      {/* Three-column layout: Sidebar Nav | Fields | Preview */}
      <div style={{ display: 'flex', minHeight: 500, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>

        {/* Column 1: Sidebar Nav (~180px) */}
        <div style={{ width: 180, flexShrink: 0, borderRight: '1px solid #e5e7eb', padding: '16px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.5px', padding: '0 12px', marginBottom: 8 }}>Assets</div>
          {ASSET_TYPES.map((t) => {
            const active = assetType === t.id;
            return (
              <button key={t.id} onClick={() => handleAssetTypeChange(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 16px)',
                padding: '8px 12px', margin: '0 8px', borderRadius: 6, border: 'none',
                fontSize: 13, color: active ? '#111827' : '#6b7280', fontWeight: active ? 500 : 400,
                background: active ? '#f3f4f6' : 'transparent', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', textAlign: 'left',
              }}>
                {/* Icons — simple SVGs per asset type */}
                {t.id === 'business-card' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.3">
                    <rect x="2" y="5" width="20" height="14" rx="2" stroke="#2563eb" /><line x1="6" y1="11" x2="14" y2="11" stroke="#93c5fd" /><line x1="6" y1="14" x2="11" y2="14" stroke="#93c5fd" />
                  </svg>
                )}
                {t.id === 'yard-sign' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.3">
                    <rect x="3" y="3" width="18" height="12" rx="1" stroke="#dc2626" /><line x1="8" y1="15" x2="8" y2="21" stroke="#92400e" /><line x1="16" y1="15" x2="16" y2="21" stroke="#92400e" />
                  </svg>
                )}
                {t.id === 'vehicle-magnet' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.3">
                    <path d="M3 10h13l4 4v3H3V10z" stroke="#6b7280" /><circle cx="7" cy="17" r="2" stroke="#0d9488" /><circle cx="17" cy="17" r="2" stroke="#0d9488" />
                  </svg>
                )}
                {t.id === 't-shirt' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.3">
                    <path d="M8 2l-5 4 2 2 3-2v14h8V6l3 2 2-2-5-4" stroke="#7c3aed" /><path d="M9 2c0 1.5 1.5 3 3 3s3-1.5 3-3" stroke="#c4b5fd" />
                  </svg>
                )}
                {t.id === 'door-hanger' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.3">
                    <rect x="6" y="2" width="12" height="20" rx="2" stroke="#ea580c" /><circle cx="12" cy="6" r="2.5" stroke="#fdba74" />
                  </svg>
                )}
                {t.id === 'flyer' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.3">
                    <rect x="4" y="2" width="16" height="20" rx="1" stroke="#059669" /><line x1="8" y1="7" x2="16" y2="7" stroke="#6ee7b7" /><line x1="8" y1="11" x2="16" y2="11" stroke="#6ee7b7" /><line x1="8" y1="15" x2="13" y2="15" stroke="#6ee7b7" />
                  </svg>
                )}
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Column 2: Fields Panel (flex: 1) */}
        <div style={{ flex: 1, borderRight: '1px solid #e5e7eb', padding: 20, overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
          {assetType && (
            <FieldEditor
              fields={fields}
              onChange={handleFieldsChange}
              sources={sources}
              assetType={assetType}
              clientId={clientId}
              hasBrandKit={hasBrandKit}
            />
          )}
        </div>

        {/* Column 3: Live Preview (flex: 1.2) */}
        <div style={{ flex: 1.2, padding: 20, background: '#f9fafb' }}>
          {assetType && <AssetPreview assetType={assetType} fields={fields} />}
        </div>
      </div>
    </div>
  );
}
