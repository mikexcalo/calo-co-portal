'use client';

import Link from 'next/link';
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

function FieldInput({
  label, value, onChange, source, type = 'text', placeholder, disabled,
  showToggle, toggled, onToggle,
}: {
  label: string; value: string; onChange: (v: string) => void;
  source?: string; type?: string; placeholder?: string; disabled?: boolean;
  showToggle?: boolean; toggled?: boolean; onToggle?: (v: boolean) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        {showToggle && (
          <input type="checkbox" checked={toggled} onChange={(e) => onToggle?.(e.target.checked)}
            style={{ cursor: 'pointer', width: 13, height: 13, flexShrink: 0 }} />
        )}
        <label style={{ fontSize: 11, fontWeight: 600, color: '#334155', flex: 1 }}>{label}</label>
        {source && <span style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>Auto-filled from {source}</span>}
      </div>
      {type === 'color' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
            style={{ width: 28, height: 24, border: 'none', cursor: 'pointer', padding: 0, background: 'none' }} />
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
            style={{ flex: 1, padding: '4px 6px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 5, fontFamily: 'monospace', color: '#0f172a' }} />
        </div>
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%', padding: '5px 7px', fontSize: 12, border: '1px solid #e2e8f0',
            borderRadius: 5, fontFamily: 'Inter, sans-serif',
            color: disabled ? '#94a3b8' : '#0f172a', background: disabled ? '#f8fafc' : '#fff',
          }} />
      )}
    </div>
  );
}

export default function FieldEditor({ fields, onChange, sources, assetType, clientId, hasBrandKit }: FieldEditorProps) {
  const update = (key: keyof BrandBuilderFields, value: string | boolean) => {
    onChange({ ...fields, [key]: value });
  };

  const isBC = assetType === 'business-card';
  const isYS = assetType === 'yard-sign';
  const useTwoCol = true; // All asset types use two-column grid (#5)
  const showToggles = isBC; // Only business cards get toggles
  const showBodyText = assetType === 'flyer';
  const showHeadlineField = assetType === 'flyer' || assetType === 'door-hanger' || isYS;

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Fields</div>

      {/* Size selector for Yard Signs (#1) */}
      {isYS && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 3 }}>Sign Size</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {SIGN_SIZES.map((s) => (
              <button key={s.value} onClick={() => update('signSize', s.value)} style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 500, borderRadius: 6, cursor: 'pointer',
                border: fields.signSize === s.value ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                background: fields.signSize === s.value ? '#eff6ff' : '#fff',
                color: fields.signSize === s.value ? '#2563eb' : '#64748b',
                fontFamily: 'Inter, sans-serif',
              }}>{s.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Logo — full width */}
      {fields.logoUrl && (
        <div style={{ marginBottom: 8, padding: 6, background: '#f8fafc', borderRadius: 5, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src={fields.logoUrl} alt="Logo" style={{ maxWidth: 40, maxHeight: 28, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Logo</div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>{sources.logoUrl ? `From ${sources.logoUrl}` : 'Manual'}</div>
          </div>
        </div>
      )}

      {/* Two-column grid for all asset types (#5) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FieldInput label="Company Name" value={fields.companyName} onChange={(v) => update('companyName', v)} source={sources.companyName}
          showToggle={showToggles} toggled={fields.showCompanyName} onToggle={(v) => update('showCompanyName', v)} disabled={showToggles && !fields.showCompanyName} />
        <FieldInput label="Contact Name" value={fields.contactName} onChange={(v) => update('contactName', v)} source={sources.contactName}
          showToggle={showToggles} toggled={fields.showContactName} onToggle={(v) => update('showContactName', v)} disabled={showToggles && !fields.showContactName} />
        <FieldInput label="Title" value={fields.contactTitle} onChange={(v) => update('contactTitle', v)} source={sources.contactTitle}
          showToggle={showToggles} toggled={fields.showContactTitle} onToggle={(v) => update('showContactTitle', v)} disabled={showToggles && !fields.showContactTitle} />
        {/* Phone → Business Phone (#4) */}
        <FieldInput label="Business Phone" value={fields.phone} onChange={(v) => update('phone', v)} source={sources.phone} type="tel"
          showToggle={showToggles} toggled={fields.showPhone} onToggle={(v) => update('showPhone', v)} disabled={showToggles && !fields.showPhone} />
        <FieldInput label="Email" value={fields.email} onChange={(v) => update('email', v)} source={sources.email} type="email"
          showToggle={showToggles} toggled={fields.showEmail} onToggle={(v) => update('showEmail', v)} disabled={showToggles && !fields.showEmail} />
        <FieldInput label="Website" value={fields.website} onChange={(v) => update('website', v)} source={sources.website}
          showToggle={showToggles} toggled={fields.showWebsite} onToggle={(v) => update('showWebsite', v)} disabled={showToggles && !fields.showWebsite} />
        <FieldInput label="QR Code URL" value={fields.qrCodeUrl} onChange={(v) => update('qrCodeUrl', v)} placeholder="https://example.com"
          showToggle={showToggles} toggled={fields.showQrCode} onToggle={(v) => update('showQrCode', v)} disabled={showToggles && !fields.showQrCode} />
        <FieldInput label="Tagline / Slogan" value={fields.tagline} onChange={(v) => update('tagline', v)} placeholder="Optional"
          showToggle={showToggles} toggled={fields.showTagline} onToggle={(v) => update('showTagline', v)} disabled={showToggles && !fields.showTagline} />
      </div>

      {/* Headline — full width, for yard signs / flyers / door hangers (#3) */}
      {showHeadlineField && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            {isYS && <input type="checkbox" checked={fields.showHeadline} onChange={(e) => update('showHeadline', e.target.checked)} style={{ cursor: 'pointer', width: 13, height: 13 }} />}
            <label style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>Headline</label>
          </div>
          <input value={fields.headline} onChange={(e) => update('headline', e.target.value)}
            placeholder="Free Consultations!" disabled={isYS && !fields.showHeadline}
            style={{
              width: '100%', padding: '5px 7px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 5,
              fontFamily: 'Inter, sans-serif', color: isYS && !fields.showHeadline ? '#94a3b8' : '#0f172a',
              background: isYS && !fields.showHeadline ? '#f8fafc' : '#fff',
            }} />
        </div>
      )}

      {showBodyText && (
        <div style={{ marginTop: 8 }}>
          <FieldInput label="Body Text" value={fields.bodyText} onChange={(v) => update('bodyText', v)} type="textarea" placeholder="Description of services..." />
        </div>
      )}

      {/* Optional fields */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginTop: 12, marginBottom: 6 }}>Optional Fields</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#334155' }}>
          <input type="checkbox" checked={fields.showAddress} onChange={(e) => update('showAddress', e.target.checked)} style={{ cursor: 'pointer' }} /> Address
        </label>
        {fields.showAddress && <FieldInput label="" value={fields.address} onChange={(v) => update('address', v)} source={sources.address} />}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#334155' }}>
          <input type="checkbox" checked={fields.showLicense} onChange={(e) => update('showLicense', e.target.checked)} style={{ cursor: 'pointer' }} /> License / Certification #
        </label>
        {fields.showLicense && <FieldInput label="" value={fields.licenseNumber} onChange={(v) => update('licenseNumber', v)} placeholder="e.g. LIC-12345" />}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#334155' }}>
          <input type="checkbox" checked={fields.showSocials} onChange={(e) => update('showSocials', e.target.checked)} style={{ cursor: 'pointer' }} /> Social Handles
        </label>
        {fields.showSocials && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FieldInput label="Facebook" value={fields.socialFacebook} onChange={(v) => update('socialFacebook', v)} placeholder="@handle" />
            <FieldInput label="Instagram" value={fields.socialInstagram} onChange={(v) => update('socialInstagram', v)} placeholder="@handle" />
          </div>
        )}
      </div>

      {/* Brand Colors — three across */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Brand Colors</div>
        {hasBrandKit && clientId && <Link href={`/clients/${clientId}/brand-kit`} style={{ fontSize: 10, fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}>Edit Brand Kit →</Link>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <FieldInput label="Primary" value={fields.primaryColor} onChange={(v) => update('primaryColor', v)} source={sources.primaryColor} type="color" />
        <FieldInput label="Secondary" value={fields.secondaryColor} onChange={(v) => update('secondaryColor', v)} source={sources.secondaryColor} type="color" />
        <FieldInput label="Background" value={fields.backgroundColor} onChange={(v) => update('backgroundColor', v)} type="color" />
      </div>
    </div>
  );
}
