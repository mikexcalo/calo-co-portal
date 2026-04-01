'use client';

import { useRef, useState } from 'react';
import { AssetType, ASSET_TYPES, BrandBuilderFields } from './types';
import { BusinessCard, YardSign, VehicleMagnet, TShirt, DoorHanger, Flyer } from './templates';
import ExportButtons from './ExportButtons';

interface AssetPreviewProps {
  assetType: AssetType;
  fields: BrandBuilderFields;
}

function ColorSwatches({ fields }: { fields: BrandBuilderFields }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
      <div title="Primary" style={{ width: 20, height: 20, borderRadius: '50%', background: fields.primaryColor, border: '1px solid #e5e7eb' }} />
      <div title="Secondary" style={{ width: 20, height: 20, borderRadius: '50%', background: fields.secondaryColor, border: '1px solid #e5e7eb' }} />
      <div title="Background" style={{ width: 20, height: 20, borderRadius: '50%', background: fields.backgroundColor, border: '1px solid #e5e7eb' }} />
    </div>
  );
}

export default function AssetPreview({ assetType, fields }: AssetPreviewProps) {
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
          background: '#f1f5f9', borderRadius: 8, border: '1px solid #e2e8f0', padding: 3,
        }}>
          {(['front', 'back'] as const).map((s) => (
            <button key={s} onClick={() => setActiveSide(s)} style={{
              flex: 1, background: activeSide === s ? '#2563eb' : 'transparent',
              color: activeSide === s ? '#ffffff' : '#64748b', border: 'none', borderRadius: 6,
              padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', textTransform: 'capitalize', transition: 'all 0.12s',
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
        <ColorSwatches fields={fields} />
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
      <ColorSwatches fields={fields} />
    </div>
  );
}
