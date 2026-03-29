'use client';

import { useRef, useState } from 'react';
import { AssetType, BrandBuilderFields } from './types';
import { BusinessCard, YardSign, VehicleMagnet, TShirt, DoorHanger, Flyer } from './templates';
import ExportButtons from './ExportButtons';

interface AssetPreviewProps {
  assetType: AssetType;
  fields: BrandBuilderFields;
}

export default function AssetPreview({ assetType, fields }: AssetPreviewProps) {
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const singleRef = useRef<HTMLDivElement>(null);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');

  const hasFrontBack = assetType === 'business-card' || assetType === 't-shirt';

  const renderTemplate = (side?: 'front' | 'back') => {
    switch (assetType) {
      case 'business-card':
        return <BusinessCard fields={fields} side={side || 'front'} />;
      case 'yard-sign':
        return <YardSign fields={fields} />;
      case 'vehicle-magnet':
        return <VehicleMagnet fields={fields} />;
      case 't-shirt':
        return <TShirt fields={fields} side={side || 'front'} />;
      case 'door-hanger':
        return <DoorHanger fields={fields} />;
      case 'flyer':
        return <Flyer fields={fields} />;
      default:
        return null;
    }
  };

  if (hasFrontBack) {
    return (
      <div>
        {/* Side toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {(['front', 'back'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setActiveSide(s)}
              style={{
                background: activeSide === s ? '#2563eb' : '#f1f5f9',
                color: activeSide === s ? '#ffffff' : '#475569',
                border: activeSide === s ? '1px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: 6, padding: '5px 16px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif', textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Preview with shadow */}
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

        {/* Export buttons for active side */}
        <ExportButtons
          assetType={assetType}
          previewRef={activeSide === 'front' ? frontRef : backRef}
          side={activeSide}
        />
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
    </div>
  );
}
