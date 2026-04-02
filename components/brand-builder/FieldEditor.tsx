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

function Field({ label, value, onChange, type = 'text', placeholder, disabled, checked, onToggle }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; disabled?: boolean;
  checked?: boolean; onToggle?: (v: boolean) => void;
}) {
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          {onToggle !== undefined && (
            <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
          )}
          <label style={{ fontSize: 13, fontWeight: 400, color: '#6b7280' }}>{label}</label>
        </div>
      )}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        style={{
          width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #e5e7eb',
          borderRadius: 8, fontFamily: 'Inter, sans-serif',
          color: disabled ? '#94a3b8' : '#0f172a', background: disabled ? '#f8fafc' : '#fff',
        }} />
    </div>
  );
}

// Email-sig style field row — label left, "Shown"/"Hidden" right
function SigField({ label, value, showKey, fields, update, fieldKey, type = 'text', placeholder }: {
  label: string; value: string; showKey: string; fields: BrandBuilderFields;
  update: (key: keyof BrandBuilderFields, value: string | boolean) => void;
  fieldKey?: string; type?: string; placeholder?: string;
}) {
  const isShown = (fields as any)[showKey] !== false;
  const fk = fieldKey || label.toLowerCase().replace(/\s+/g, '');
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{label}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={isShown} onChange={() => update(showKey as keyof BrandBuilderFields, !isShown)}
            style={{ accentColor: '#6366f1' }} />
          <span style={{ fontSize: 12, color: isShown ? '#6366f1' : '#9ca3af' }}>
            {isShown ? 'Shown' : 'Hidden'}
          </span>
        </label>
      </div>
      <input type={type} value={value || ''} onChange={(e) => update(fk as keyof BrandBuilderFields, e.target.value)}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`} disabled={!isShown}
        style={{
          width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
          borderRadius: 8, fontSize: 14, color: '#111827', fontFamily: 'Inter, sans-serif',
          background: isShown ? '#fff' : '#f9fafb', opacity: isShown ? 1 : 0.5,
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
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Logo</span>
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={fields.logoUrl} alt="Logo" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            <span style={{ fontSize: 13, color: '#6b7280' }}>Logo uploaded</span>
          </div>
        </div>
      )}

      {/* === YARD SIGN: email-sig style field panel === */}
      {isYS ? (
        <>
          {/* Core fields */}
          <SigField label="Headline" value={fields.headline} showKey="showHeadline" fields={fields} update={update} placeholder="Free Estimates!" />
          <SigField label="Business phone" value={fields.phone} showKey="showPhone" fields={fields} update={update} fieldKey="phone" type="tel" placeholder="(207) 555-1234" />
          <SigField label="Company name" value={fields.companyName} showKey="showCompanyName" fields={fields} update={update} placeholder="Your Business Name" />
          <SigField label="QR code URL" value={fields.qrCodeUrl} showKey="showQrCode" fields={fields} update={update} fieldKey="qrCodeUrl" placeholder="yourwebsite.com" />

          {/* Divider + More fields */}
          <div
            onClick={() => setMoreOpen(!moreOpen)}
            style={{ cursor: 'pointer', fontSize: 13, color: '#2563eb', padding: '8px 0', borderTop: '1px solid #f1f3f5', marginTop: 4 }}
          >
            {moreOpen ? '− Fewer fields' : '+ More fields'}
          </div>

          {moreOpen && (
            <div style={{ marginTop: 4 }}>
              <SigField label="Tagline" value={fields.tagline} showKey="showTagline" fields={fields} update={update} fieldKey="tagline" placeholder="Your trusted partner" />
              <SigField label="Email" value={fields.email} showKey="showEmail" fields={fields} update={update} fieldKey="email" type="email" placeholder="email@example.com" />
              <SigField label="Website" value={fields.website} showKey="showWebsite" fields={fields} update={update} fieldKey="website" placeholder="yoursite.com" />
            </div>
          )}
        </>
      ) : (
        /* === NON-YARD-SIGN: original 2-column layout === */
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <Field label="Company name" value={fields.companyName} onChange={(v) => update('companyName', v)}
              checked={fields.showCompanyName} onToggle={(v) => update('showCompanyName', v)} />
            <Field label="Contact name" value={fields.contactName} onChange={(v) => update('contactName', v)}
              checked={fields.showContactName} onToggle={(v) => update('showContactName', v)} />
            <Field label="Title" value={fields.contactTitle} onChange={(v) => update('contactTitle', v)}
              checked={fields.showContactTitle} onToggle={(v) => update('showContactTitle', v)} />
            <Field label="Business phone" value={fields.phone} onChange={(v) => update('phone', v)} type="tel"
              checked={fields.showPhone} onToggle={(v) => update('showPhone', v)} />
            <Field label="Email" value={fields.email} onChange={(v) => update('email', v)} type="email"
              checked={fields.showEmail} onToggle={(v) => update('showEmail', v)} />
            <Field label="Website" value={fields.website} onChange={(v) => update('website', v)}
              checked={fields.showWebsite} onToggle={(v) => update('showWebsite', v)} />
            <Field label="QR code URL" value={fields.qrCodeUrl} onChange={(v) => update('qrCodeUrl', v)} placeholder="https://example.com"
              checked={fields.showQrCode} onToggle={(v) => update('showQrCode', v)} />
            <Field label="Tagline / slogan" value={fields.tagline} onChange={(v) => update('tagline', v)} placeholder="Optional"
              checked={fields.showTagline} onToggle={(v) => update('showTagline', v)} />
          </div>

          {showHeadlineField && (
            <div style={{ marginTop: 12 }}>
              <Field label="Headline" value={fields.headline} onChange={(v) => update('headline', v)} placeholder="Free Consultations!"
                checked={fields.showHeadline} onToggle={(v) => update('showHeadline', v)} />
            </div>
          )}

          {showBodyText && (
            <div style={{ marginTop: 12 }}>
              <Field label="Body Text" value={fields.bodyText} onChange={(v) => update('bodyText', v)} placeholder="Description of services..." />
            </div>
          )}

          {/* Collapsible "+ More fields" */}
          <div style={{ marginTop: 16 }}>
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
        </>
      )}
    </div>
  );
}
