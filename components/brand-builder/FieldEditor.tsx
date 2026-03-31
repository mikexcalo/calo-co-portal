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
  const showBodyText = assetType === 'flyer';
  const showHeadline = assetType === 'flyer' || assetType === 'door-hanger';

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Fields</div>

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

      {/* Two-column grid for business cards (#1), single column for others */}
      <div style={{ display: 'grid', gridTemplateColumns: isBC ? '1fr 1fr' : '1fr', gap: isBC ? 10 : 8 }}>
        <FieldInput label="Company Name" value={fields.companyName} onChange={(v) => update('companyName', v)} source={sources.companyName}
          showToggle={isBC} toggled={fields.showCompanyName} onToggle={(v) => update('showCompanyName', v)} disabled={isBC && !fields.showCompanyName} />
        <FieldInput label="Contact Name" value={fields.contactName} onChange={(v) => update('contactName', v)} source={sources.contactName}
          showToggle={isBC} toggled={fields.showContactName} onToggle={(v) => update('showContactName', v)} disabled={isBC && !fields.showContactName} />
        <FieldInput label="Title" value={fields.contactTitle} onChange={(v) => update('contactTitle', v)} source={sources.contactTitle}
          showToggle={isBC} toggled={fields.showContactTitle} onToggle={(v) => update('showContactTitle', v)} disabled={isBC && !fields.showContactTitle} />
        <FieldInput label="Phone" value={fields.phone} onChange={(v) => update('phone', v)} source={sources.phone} type="tel"
          showToggle={isBC} toggled={fields.showPhone} onToggle={(v) => update('showPhone', v)} disabled={isBC && !fields.showPhone} />
        <FieldInput label="Email" value={fields.email} onChange={(v) => update('email', v)} source={sources.email} type="email"
          showToggle={isBC} toggled={fields.showEmail} onToggle={(v) => update('showEmail', v)} disabled={isBC && !fields.showEmail} />
        <FieldInput label="Website" value={fields.website} onChange={(v) => update('website', v)} source={sources.website}
          showToggle={isBC} toggled={fields.showWebsite} onToggle={(v) => update('showWebsite', v)} disabled={isBC && !fields.showWebsite} />
        <FieldInput label="QR Code URL" value={fields.qrCodeUrl} onChange={(v) => update('qrCodeUrl', v)} placeholder="https://example.com"
          showToggle={isBC} toggled={fields.showQrCode} onToggle={(v) => update('showQrCode', v)} disabled={isBC && !fields.showQrCode} />
        <FieldInput label="Tagline / Slogan" value={fields.tagline} onChange={(v) => update('tagline', v)} placeholder="Optional"
          showToggle={isBC} toggled={fields.showTagline} onToggle={(v) => update('showTagline', v)} disabled={isBC && !fields.showTagline} />
      </div>

      {showHeadline && (
        <div style={{ marginTop: 8 }}>
          <FieldInput label="Headline" value={fields.headline} onChange={(v) => update('headline', v)} placeholder="Main headline text" />
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
          <input type="checkbox" checked={fields.showAddress} onChange={(e) => update('showAddress', e.target.checked)} style={{ cursor: 'pointer' }} />
          Address
        </label>
        {fields.showAddress && <FieldInput label="" value={fields.address} onChange={(v) => update('address', v)} source={sources.address} />}

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#334155' }}>
          <input type="checkbox" checked={fields.showLicense} onChange={(e) => update('showLicense', e.target.checked)} style={{ cursor: 'pointer' }} />
          License / Certification #
        </label>
        {fields.showLicense && <FieldInput label="" value={fields.licenseNumber} onChange={(v) => update('licenseNumber', v)} placeholder="e.g. LIC-12345" />}

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#334155' }}>
          <input type="checkbox" checked={fields.showSocials} onChange={(e) => update('showSocials', e.target.checked)} style={{ cursor: 'pointer' }} />
          Social Handles
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
