'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AssetType, ASSET_TYPES, BrandBuilderFields } from './types';
import { BusinessCard, YardSign, VehicleMagnet, TShirt, DoorHanger, Flyer } from './templates';
import ExportButtons from './ExportButtons';

interface AssetPreviewProps {
  assetType: AssetType;
  fields: BrandBuilderFields;
  clientId?: string;
}

function ColorRow({ fields, clientId }: { fields: BrandBuilderFields; clientId?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>Colors</span>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: fields.primaryColor, border: '1px solid #e5e7eb' }} />
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: fields.secondaryColor, border: '1px solid #e5e7eb' }} />
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: fields.backgroundColor, border: '1px solid #e5e7eb' }} />
      </div>
      {clientId && (
        <Link href={`/clients/${clientId}/brand-kit`} style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
          Edit Brand Kit →
        </Link>
      )}
    </div>
  );
}

export default function AssetPreview({ assetType, fields, clientId }: AssetPreviewProps) {
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const singleRef = useRef<HTMLDivElement>(null);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');

  const hasFrontBack = assetType === 'business-card' || assetType === 't-shirt';

  const renderTemplate = (side?: 'front' | 'back') => {
    switch (assetType) {
      case 'business-card': return <BusinessCard fields={fields} side={side || 'front'} />;
      case 'yard-sign': return <YardSign fields={fields} />;
      case 'vehicle-magnet': return <VehicleMagnet fields={fields} />;
      case 't-shirt': return <TShirt fields={fields} side={side || 'front'} />;
      case 'door-hanger': return <DoorHanger fields={fields} />;
      case 'flyer': return <Flyer fields={fields} />;
      default: return null;
    }
  };

  if (hasFrontBack) {
    return (
      <div>
        {/* Front / Back toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0, marginBottom: 14,
          background: '#f3f4f6', borderRadius: 8, padding: 3,
        }}>
          {(['front', 'back'] as const).map((s) => (
            <button key={s} onClick={() => setActiveSide(s)} style={{
              flex: 1, background: activeSide === s ? '#fff' : 'transparent',
              color: activeSide === s ? '#111827' : '#9ca3af', border: 'none', borderRadius: 6,
              padding: '6px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', textTransform: 'capitalize', transition: 'all 0.12s',
              boxShadow: activeSide === s ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>{s}</button>
          ))}
        </div>

        {/* Preview — visible side */}
        <div style={{
          display: 'flex', justifyContent: 'center', padding: 20,
          background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14,
        }}>
          {activeSide === 'front' ? (
            <div ref={frontRef} style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.12)', borderRadius: 4 }}>
              {renderTemplate('front')}
            </div>
          ) : (
            <div ref={backRef} style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.12)', borderRadius: 4 }}>
              {renderTemplate('back')}
            </div>
          )}
        </div>

        {/* Hidden off-screen renders for PNG/PDF export of BOTH sides (#4) */}
        <div style={{ position: 'absolute', left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }}>
          <div ref={activeSide !== 'front' ? frontRef : undefined}>{renderTemplate('front')}</div>
          <div ref={activeSide !== 'back' ? backRef : undefined}>{renderTemplate('back')}</div>
        </div>

        {/* Export buttons */}
        <ExportButtons
          assetType={assetType}
          previewRef={activeSide === 'front' ? frontRef : backRef}
          side={activeSide}
          frontRef={frontRef}
          backRef={backRef}
        />
        <ColorRow fields={fields} clientId={clientId} />
      </div>
    );
  }

  // Single-sided assets
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'center', padding: 20,
        background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14,
      }}>
        <div ref={singleRef} style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.12)', borderRadius: 4 }}>
          {renderTemplate()}
        </div>
      </div>
      <ExportButtons assetType={assetType} previewRef={singleRef} />
      <ColorRow fields={fields} clientId={clientId} />
    </div>
  );
}
