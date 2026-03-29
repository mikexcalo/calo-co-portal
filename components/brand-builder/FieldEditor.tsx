'use client';

import { BrandBuilderFields, AssetType } from './types';

interface FieldEditorProps {
  fields: BrandBuilderFields;
  onChange: (fields: BrandBuilderFields) => void;
  sources: Record<string, string>;
  assetType: AssetType;
}

function FieldInput({
  label, value, onChange, source, type = 'text', placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  source?: string; type?: string; placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{label}</label>
        {source && (
          <span style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>
            Auto-filled from {source}
          </span>
        )}
      </div>
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          style={{
            width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #e2e8f0',
            borderRadius: 6, fontFamily: 'Inter, sans-serif', resize: 'vertical',
            color: '#0f172a', background: '#ffffff',
          }}
        />
      ) : type === 'color' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 32, height: 28, border: 'none', cursor: 'pointer', padding: 0, background: 'none' }}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              flex: 1, padding: '5px 8px', fontSize: 11, border: '1px solid #e2e8f0',
              borderRadius: 6, fontFamily: 'monospace', color: '#0f172a',
            }}
          />
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #e2e8f0',
            borderRadius: 6, fontFamily: 'Inter, sans-serif', color: '#0f172a',
          }}
        />
      )}
    </div>
  );
}

function ToggleField({
  label, checked, onChange, children,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: checked ? 4 : 0 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{label}</span>
      </div>
      {checked && children}
    </div>
  );
}

export default function FieldEditor({ fields, onChange, sources, assetType }: FieldEditorProps) {
  const update = (key: keyof BrandBuilderFields, value: string | boolean) => {
    onChange({ ...fields, [key]: value });
  };

  const showBodyText = assetType === 'flyer';
  const showHeadline = assetType === 'flyer' || assetType === 'door-hanger';
  const showFrontBack = assetType === 'business-card' || assetType === 't-shirt';

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
        Fields
      </div>

      {/* Logo preview if available */}
      {fields.logoUrl && (
        <div style={{
          marginBottom: 10, padding: 8, background: '#f8fafc', borderRadius: 6,
          border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <img src={fields.logoUrl} alt="Logo" style={{ maxWidth: 48, maxHeight: 32, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Logo</div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>
              {sources.logoUrl ? `From ${sources.logoUrl}` : 'Manual'}
            </div>
          </div>
        </div>
      )}

      <FieldInput
        label="Company Name" value={fields.companyName}
        onChange={(v) => update('companyName', v)} source={sources.companyName}
      />
      <FieldInput
        label="Contact Name" value={fields.contactName}
        onChange={(v) => update('contactName', v)} source={sources.contactName}
      />
      <FieldInput
        label="Title" value={fields.contactTitle}
        onChange={(v) => update('contactTitle', v)} source={sources.contactTitle}
      />
      <FieldInput
        label="Phone" value={fields.phone}
        onChange={(v) => update('phone', v)} source={sources.phone} type="tel"
      />
      <FieldInput
        label="Email" value={fields.email}
        onChange={(v) => update('email', v)} source={sources.email} type="email"
      />
      <FieldInput
        label="Website" value={fields.website}
        onChange={(v) => update('website', v)} source={sources.website}
      />
      <FieldInput
        label="QR Code URL" value={fields.qrCodeUrl}
        onChange={(v) => update('qrCodeUrl', v)}
        placeholder="https://example.com"
      />
      <FieldInput
        label="Tagline / Slogan" value={fields.tagline}
        onChange={(v) => update('tagline', v)} placeholder="Optional"
      />

      {showHeadline && (
        <FieldInput
          label="Headline" value={fields.headline}
          onChange={(v) => update('headline', v)} placeholder="Main headline text"
        />
      )}

      {showBodyText && (
        <FieldInput
          label="Body Text" value={fields.bodyText}
          onChange={(v) => update('bodyText', v)} type="textarea"
          placeholder="Description of services, offers, etc."
        />
      )}

      {/* Optional toggleable fields */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginTop: 14, marginBottom: 8 }}>
        Optional Fields
      </div>

      <ToggleField
        label="Address" checked={fields.showAddress}
        onChange={(v) => update('showAddress', v)}
      >
        <FieldInput
          label="" value={fields.address}
          onChange={(v) => update('address', v)} source={sources.address}
        />
      </ToggleField>

      <ToggleField
        label="License / Certification #" checked={fields.showLicense}
        onChange={(v) => update('showLicense', v)}
      >
        <FieldInput
          label="" value={fields.licenseNumber}
          onChange={(v) => update('licenseNumber', v)} placeholder="e.g. LIC-12345"
        />
      </ToggleField>

      <ToggleField
        label="Social Handles" checked={fields.showSocials}
        onChange={(v) => update('showSocials', v)}
      >
        <FieldInput
          label="Facebook" value={fields.socialFacebook}
          onChange={(v) => update('socialFacebook', v)} placeholder="@handle"
        />
        <FieldInput
          label="Instagram" value={fields.socialInstagram}
          onChange={(v) => update('socialInstagram', v)} placeholder="@handle"
        />
      </ToggleField>

      {/* Brand settings */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginTop: 14, marginBottom: 8 }}>
        Brand Colors
      </div>

      <FieldInput
        label="Primary Color" value={fields.primaryColor}
        onChange={(v) => update('primaryColor', v)} source={sources.primaryColor} type="color"
      />
      <FieldInput
        label="Secondary Color" value={fields.secondaryColor}
        onChange={(v) => update('secondaryColor', v)} source={sources.secondaryColor} type="color"
      />
      <FieldInput
        label="Background Color" value={fields.backgroundColor}
        onChange={(v) => update('backgroundColor', v)} type="color"
      />
    </div>
  );
}
