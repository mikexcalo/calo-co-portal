'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  DB, loadClients, loadContacts, loadAllBrandKits,
} from '@/lib/database';
import { extractHex } from '@/lib/utils';
import { Client, Contact } from '@/lib/types';
import {
  AssetType, BrandBuilderFields, DEFAULT_FIELDS,
} from '@/components/brand-builder/types';
import AssetTypeSelector from '@/components/brand-builder/AssetTypeSelector';
import FieldEditor from '@/components/brand-builder/FieldEditor';
import AssetPreview from '@/components/brand-builder/AssetPreview';

export default function BrandBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [primaryContact, setPrimaryContact] = useState<Contact | null>(null);
  const [assetType, setAssetType] = useState<AssetType | null>(null);
  const [fields, setFields] = useState<BrandBuilderFields>(DEFAULT_FIELDS);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [hasBrandKit, setHasBrandKit] = useState(false);

  // Load data
  useEffect(() => {
    const init = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      if (!DB.contacts[clientId]) await loadContacts(clientId);
      await loadAllBrandKits();

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
    <div className="page">
      {/* Back button */}
      <button
        onClick={() => router.push(`/clients/${clientId}`)}
        style={{
          background: 'none', border: 'none', color: '#6366f1', fontSize: '13px',
          fontWeight: 500, cursor: 'pointer', padding: 0, marginBottom: '16px',
          display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'Inter, sans-serif',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back to {clientName}
      </button>

      {/* Header */}
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
        {clientName} — Brand Builder
      </h1>
      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
        Create print-ready branded assets
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

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Left column: Asset Selector + Fields */}
        <div style={{
          width: '38%', minWidth: 280, flexShrink: 0,
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
            Asset Type
          </div>
          <AssetTypeSelector selected={assetType} onSelect={setAssetType} />

          {assetType && (
            <div style={{ marginTop: 18, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <FieldEditor
                fields={fields}
                onChange={handleFieldsChange}
                sources={sources}
                assetType={assetType}
                clientId={clientId}
                hasBrandKit={hasBrandKit}
              />
            </div>
          )}
        </div>

        {/* Right column: Preview + Export */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {assetType ? (
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>
                Live Preview
              </div>
              <AssetPreview assetType={assetType} fields={fields} />
            </div>
          ) : (
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 48,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
                Select an asset type
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Choose from business cards, yard signs, vehicle magnets, t-shirts, door hangers, or flyers
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
