'use client';

import { useState } from 'react';
import { BrandBuilderFields, AssetType } from './types';

interface FieldEditorProps {
  fields: BrandBuilderFields;
  onChange: (fields: BrandBuilderFields) => void;
  sources: Record<string, string>;
  assetType: AssetType;
  clientId?: string;
  hasBrandKit?: boolean;
}

const SIGN_SIZES = [
  { value: '18x24', label: '18" × 24"' },
  { value: '24x18', label: '24" × 18" (landscape)' },
  { value: '12x18', label: '12" × 18"' },
  { value: '24x36', label: '24" × 36"' },
  { value: '36x24', label: '36" × 24" (landscape)' },
];

function Field({ label, value, onChange, type = 'text', placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 400, color: '#6b7280', display: 'block', marginBottom: 3 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        style={{
          width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #e2e8f0',
          borderRadius: 5, fontFamily: 'Inter, sans-serif',
          color: disabled ? '#94a3b8' : '#0f172a', background: disabled ? '#f8fafc' : '#fff',
        }} />
    </div>
  );
}

export default function FieldEditor({ fields, onChange, sources, assetType, clientId, hasBrandKit }: FieldEditorProps) {
  const update = (key: keyof BrandBuilderFields, value: string | boolean) => {
    onChange({ ...fields, [key]: value });
  };

  const [moreOpen, setMoreOpen] = useState(false);
  const isYS = assetType === 'yard-sign';
  const showBodyText = assetType === 'flyer';
  const showHeadlineField = assetType === 'flyer' || assetType === 'door-hanger' || isYS;

  return (
    <div>

      {/* Size selector for Yard Signs */}
      {isYS && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 400, color: '#6b7280', display: 'block', marginBottom: 4 }}>Sign Size</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {SIGN_SIZES.map((s) => (
              <button key={s.value} onClick={() => update('signSize', s.value)} style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 500, borderRadius: 6, cursor: 'pointer',
                border: fields.signSize === s.value ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                background: fields.signSize === s.value ? '#eff6ff' : '#fff',
                color: fields.signSize === s.value ? '#2563eb' : '#6b7280',
                fontFamily: 'Inter, sans-serif',
              }}>{s.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Logo row */}
      {fields.logoUrl && (
        <div style={{ marginBottom: 12, padding: 6, background: '#f8fafc', borderRadius: 5, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src={fields.logoUrl} alt="Logo" style={{ maxWidth: 40, maxHeight: 28, objectFit: 'contain' }} />
          <span style={{ fontSize: 13, color: '#6b7280' }}>Logo</span>
        </div>
      )}

      {/* Core fields — two-column grid, no checkboxes, no auto-fill labels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Company Name" value={fields.companyName} onChange={(v) => update('companyName', v)} />
        <Field label="Contact Name" value={fields.contactName} onChange={(v) => update('contactName', v)} />
        <Field label="Title" value={fields.contactTitle} onChange={(v) => update('contactTitle', v)} />
        <Field label="Business Phone" value={fields.phone} onChange={(v) => update('phone', v)} type="tel" />
        <Field label="Email" value={fields.email} onChange={(v) => update('email', v)} type="email" />
        <Field label="Website" value={fields.website} onChange={(v) => update('website', v)} />
        <Field label="QR Code URL" value={fields.qrCodeUrl} onChange={(v) => update('qrCodeUrl', v)} placeholder="https://example.com" />
        <Field label="Tagline / Slogan" value={fields.tagline} onChange={(v) => update('tagline', v)} placeholder="Optional" />
      </div>

      {/* Headline — full width */}
      {showHeadlineField && (
        <div style={{ marginTop: 12 }}>
          <Field label="Headline" value={fields.headline} onChange={(v) => update('headline', v)} placeholder="Free Consultations!" />
        </div>
      )}

      {showBodyText && (
        <div style={{ marginTop: 12 }}>
          <Field label="Body Text" value={fields.bodyText} onChange={(v) => update('bodyText', v)} placeholder="Description of services..." />
        </div>
      )}

      {/* Collapsible "+ More fields" */}
      <div style={{ marginTop: 14 }}>
        <button onClick={() => setMoreOpen(!moreOpen)} style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 13, fontWeight: 400, color: '#6b7280', fontFamily: 'Inter, sans-serif',
        }}>
          {moreOpen ? '− Fewer fields' : '+ More fields'}
        </button>
        {moreOpen && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
              <input type="checkbox" checked={fields.showAddress} onChange={(e) => update('showAddress', e.target.checked)} /> Address
            </label>
            {fields.showAddress && <Field label="" value={fields.address} onChange={(v) => update('address', v)} />}

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
              <input type="checkbox" checked={fields.showLicense} onChange={(e) => update('showLicense', e.target.checked)} /> License / Certification #
            </label>
            {fields.showLicense && <Field label="" value={fields.licenseNumber} onChange={(v) => update('licenseNumber', v)} placeholder="e.g. LIC-12345" />}

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
              <input type="checkbox" checked={fields.showSocials} onChange={(e) => update('showSocials', e.target.checked)} /> Social Handles
            </label>
            {fields.showSocials && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Field label="Facebook" value={fields.socialFacebook} onChange={(v) => update('socialFacebook', v)} placeholder="@handle" />
                <Field label="Instagram" value={fields.socialInstagram} onChange={(v) => update('socialInstagram', v)} placeholder="@handle" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
