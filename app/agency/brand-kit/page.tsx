'use client';

import { useState } from 'react';
import { PageLayout, Section, InfoBar } from '@/components/shared/PageLayout';

export default function AgencyBrandKitPage() {
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [colorHex, setColorHex] = useState('#2563eb');

  return (
    <PageLayout title="Agency Brand Kit" subtitle="CALO&CO brand assets and guidelines">
      {/* Agency info bar */}
      <InfoBar>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: '#2563eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0,
        }}>C</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>CALO&CO</div>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Creative Agency</div>
        </div>
      </InfoBar>

      {/* Logo section */}
      <Section label="Logo">
        <div style={{
          background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 60, height: 60, borderRadius: 12, background: '#f1f3f5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px', color: '#9ca3af', fontSize: 24,
            }}>+</div>
            <div style={{ fontSize: 13, color: '#9ca3af' }}>Upload agency logo</div>
            <div style={{ fontSize: 11, color: '#d1d5db', marginTop: 4 }}>PNG, SVG, or JPG</div>
          </div>
        </div>
      </Section>

      {/* Colors section */}
      <Section label="Brand Colors">
        <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>Primary Color</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="color" value={primaryColor}
              onChange={(e) => { setPrimaryColor(e.target.value); setColorHex(e.target.value); }}
              style={{ width: 40, height: 40, border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', padding: 0 }}
            />
            <input
              type="text" value={colorHex}
              onChange={(e) => { setColorHex(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setPrimaryColor(e.target.value); }}
              maxLength={7}
              style={{ width: 100, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontFamily: 'monospace', color: '#111827' }}
            />
            <div style={{ width: 32, height: 32, borderRadius: 6, background: primaryColor }} />
          </div>
        </div>
      </Section>

      {/* Fonts section */}
      <Section label="Fonts">
        <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {['Heading', 'Body', 'Accent'].map((label) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>{label}</div>
                <input
                  type="text" placeholder={`${label} font`}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, color: '#111827', fontFamily: 'inherit' }}
                />
              </div>
            ))}
          </div>
        </div>
      </Section>
    </PageLayout>
  );
}
