'use client';

import { useState, useEffect, useRef } from 'react';
import { Client, Contact, BrandKit, SignatureFields as SignatureFieldsType } from '@/lib/types';
import { extractHex } from '@/lib/utils';
import styles from './SignatureFields.module.css';

interface SignatureFieldsProps {
  clientId: string;
  client: Client;
  contacts: Contact[];
  brandKit: BrandKit;
  onSave: (updates: any) => void;
  isSaving: boolean;
}

export default function SignatureFields({
  clientId,
  client,
  contacts,
  brandKit,
  onSave,
  isSaving,
}: SignatureFieldsProps) {
  const [fields, setFields] = useState<SignatureFieldsType>({
    name: '',
    title: '',
    company: '',
    email: '',
    website: '',
    brandColor: '#333333',
    ...client.signatureFields,
  });

  const [visible, setVisible] = useState({
    name: true,
    title: true,
    company: true,
    email: true,
    website: false,
    logo: true,
    ...(client.signatureFields?.visible || {}),
  });

  const [selectedLogo, setSelectedLogo] = useState<string>(
    client.signatureFields?.logoSrc || getPrimaryLogoSrc()
  );

  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [logoHint, setLogoHint] = useState('');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Initialize default fields
  useEffect(() => {
    const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

    const defaults = {
      name: fields.name || primaryContact?.name || client.name || '',
      title: fields.title || primaryContact?.title || primaryContact?.role || '',
      company: fields.company || client.company || client.name || '',
      email: fields.email || primaryContact?.email || client.email || '',
      website: fields.website || client.website || '',
      brandColor: fields.brandColor || brandKit.colors?.[0] || '#333333',
    };

    setFields((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.entries(defaults).filter(([_, v]) => !prev[_ as keyof SignatureFieldsType])),
    }));
  }, []);

  function getPrimaryLogoSrc(): string {
    if (!brandKit.logos) return '';

    // Try color slot first
    const colorLogos = brandKit.logos.color || [];
    const colorPrimary = colorLogos.find((f) => f.isPrimary);
    if (colorPrimary?.data) return colorPrimary.data;
    if (colorLogos.length > 0 && colorLogos[0].data) return colorLogos[0].data;

    // Try other slots
    for (const slot of ['light', 'dark', 'icon', 'secondary', 'favicon']) {
      const logos = (brandKit.logos as any)[slot] || [];
      if (logos.length > 0 && logos[0].data) return logos[0].data;
    }

    return '';
  }

  function getAllLogos() {
    if (!brandKit.logos) return [];

    const slots = ['color', 'light', 'dark', 'icon', 'secondary', 'favicon'];
    const labels: Record<string, string> = {
      color: 'Full Color',
      light: 'Light',
      dark: 'Dark',
      icon: 'Icon',
      secondary: 'Secondary',
      favicon: 'Favicon',
    };

    const out = [];
    for (const slot of slots) {
      const logos = (brandKit.logos as any)[slot] || [];
      for (const f of logos) {
        if (f.data && isRenderableFile(f)) {
          out.push({ src: f.data, label: labels[slot] || slot });
        }
      }
    }

    return out;
  }

  function isRenderableFile(file: any): boolean {
    const name = file.name || '';
    const ext = (name.match(/\.([^.]+)$/) || [])[1] || '';
    return /^(png|jpg|jpeg|svg|webp|gif)$/i.test(ext) || file.isPrimary !== false;
  }

  function calculateLuminance(hex: string): number {
    const h = (hex || '#ffffff').replace('#', '');
    if (h.length !== 6) return 1;

    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;

    const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function autoSwitchLogo() {
    const isDark = calculateLuminance(fields.brandColor || '#ffffff') < 0.5;
    const colorLogos = brandKit.logos?.color || [];
    const lightLogos = brandKit.logos?.light || [];

    const colorSrc = colorLogos.find((f) => f.isPrimary)?.data || colorLogos[0]?.data;
    const lightSrc = lightLogos.find((f) => f.isPrimary)?.data || lightLogos[0]?.data;

    if (isDark) {
      if (lightSrc) {
        setSelectedLogo(lightSrc);
        setLogoHint('Switched to light logo for dark background');
      } else {
        setLogoHint('Consider uploading a light logo variant for dark backgrounds');
      }
    } else {
      if (colorSrc) {
        setSelectedLogo(colorSrc);
      }
      setLogoHint('');
    }
  }

  function handleFieldChange(key: string, value: string) {
    const newFields = { ...fields, [key]: value };
    setFields(newFields);

    if (key === 'brandColor') {
      autoSwitchLogo();
    }

    // Debounce save
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const updatedData = {
        signatureFields: {
          ...newFields,
          logoSrc: selectedLogo,
          visible,
          layout: 'horizontal',
        },
      };
      onSave(updatedData);
    }, 400);
  }

  function toggleFieldVisibility(key: keyof typeof visible) {
    const newVisible = { ...visible, [key]: !visible[key] };
    setVisible(newVisible);

    const updatedData = {
      signatureFields: {
        ...fields,
        logoSrc: selectedLogo,
        visible: newVisible,
        layout: 'horizontal',
      },
    };
    onSave(updatedData);
  }

  function selectLogo(src: string) {
    setSelectedLogo(src);
    setShowLogoPicker(false);
    setLogoHint('');

    const updatedData = {
      signatureFields: {
        ...fields,
        logoSrc: src,
        visible,
        layout: 'horizontal',
      },
    };
    onSave(updatedData);
  }

  const allLogos = getAllLogos();
  const brandColors = brandKit.colors ? brandKit.colors.map((c) => extractHex(c)).filter(Boolean) : [];

  return (
    <div className={styles.esigFieldsCard}>
      <div className={styles.sectionTitle}>Signature Fields</div>

      {/* Name */}
      <div className={styles.fieldRow}>
        <div className={styles.fieldRowHeader}>
          <label className={styles.fieldLabel}>Name</label>
          <div
            className={styles.visToggle}
            onClick={() => toggleFieldVisibility('name')}
            title={visible.name ? 'Hide' : 'Show'}
          >
            <div className={`${styles.visCheck} ${visible.name ? styles.on : ''}`}></div>
            <span className={styles.visLabel}>{visible.name ? 'Shown' : 'Hidden'}</span>
          </div>
        </div>
        <input
          type="text"
          value={fields.name || ''}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          className={`${styles.fieldInput} ${!visible.name ? styles.off : ''}`}
          placeholder="Full Name"
          disabled={isSaving}
        />
      </div>

      {/* Title */}
      <div className={styles.fieldRow}>
        <div className={styles.fieldRowHeader}>
          <label className={styles.fieldLabel}>Title</label>
          <div
            className={styles.visToggle}
            onClick={() => toggleFieldVisibility('title')}
            title={visible.title ? 'Hide' : 'Show'}
          >
            <div className={`${styles.visCheck} ${visible.title ? styles.on : ''}`}></div>
            <span className={styles.visLabel}>{visible.title ? 'Shown' : 'Hidden'}</span>
          </div>
        </div>
        <input
          type="text"
          value={fields.title || ''}
          onChange={(e) => handleFieldChange('title', e.target.value)}
          className={`${styles.fieldInput} ${!visible.title ? styles.off : ''}`}
          placeholder="e.g. Founder & Creative Director"
          disabled={isSaving}
        />
      </div>

      {/* Company */}
      <div className={styles.fieldRow}>
        <div className={styles.fieldRowHeader}>
          <label className={styles.fieldLabel}>Company</label>
          <div
            className={styles.visToggle}
            onClick={() => toggleFieldVisibility('company')}
            title={visible.company ? 'Hide' : 'Show'}
          >
            <div className={`${styles.visCheck} ${visible.company ? styles.on : ''}`}></div>
            <span className={styles.visLabel}>{visible.company ? 'Shown' : 'Hidden'}</span>
          </div>
        </div>
        <input
          type="text"
          value={fields.company || ''}
          onChange={(e) => handleFieldChange('company', e.target.value)}
          className={`${styles.fieldInput} ${!visible.company ? styles.off : ''}`}
          placeholder="Company Name"
          disabled={isSaving}
        />
      </div>

      {/* Email */}
      <div className={styles.fieldRow}>
        <div className={styles.fieldRowHeader}>
          <label className={styles.fieldLabel}>Email</label>
          <div
            className={styles.visToggle}
            onClick={() => toggleFieldVisibility('email')}
            title={visible.email ? 'Hide' : 'Show'}
          >
            <div className={`${styles.visCheck} ${visible.email ? styles.on : ''}`}></div>
            <span className={styles.visLabel}>{visible.email ? 'Shown' : 'Hidden'}</span>
          </div>
        </div>
        <input
          type="email"
          value={fields.email || ''}
          onChange={(e) => handleFieldChange('email', e.target.value)}
          className={`${styles.fieldInput} ${!visible.email ? styles.off : ''}`}
          placeholder="email@example.com"
          disabled={isSaving}
        />
      </div>

      {/* Website */}
      <div className={styles.fieldRow}>
        <div className={styles.fieldRowHeader}>
          <label className={styles.fieldLabel}>Website</label>
          <div
            className={styles.visToggle}
            onClick={() => toggleFieldVisibility('website')}
            title={visible.website ? 'Hide' : 'Show'}
          >
            <div className={`${styles.visCheck} ${visible.website ? styles.on : ''}`}></div>
            <span className={styles.visLabel}>{visible.website ? 'Shown' : 'Hidden'}</span>
          </div>
        </div>
        <input
          type="text"
          value={fields.website || ''}
          onChange={(e) => handleFieldChange('website', e.target.value)}
          className={`${styles.fieldInput} ${!visible.website ? styles.off : ''}`}
          placeholder="e.g. mikecalo.co"
          disabled={isSaving}
        />
      </div>

      {/* Logo */}
      <div className={styles.fieldRow}>
        <div className={styles.fieldRowHeader}>
          <label className={styles.fieldLabel}>Logo</label>
          <div
            className={styles.visToggle}
            onClick={() => toggleFieldVisibility('logo')}
            title={visible.logo ? 'Hide' : 'Show'}
          >
            <div className={`${styles.visCheck} ${visible.logo ? styles.on : ''}`}></div>
            <span className={styles.visLabel}>{visible.logo ? 'Shown' : 'Hidden'}</span>
          </div>
        </div>
        <div className={styles.logoRow}>
          <div className={styles.logoThumbContainer}>
            {selectedLogo ? (
              <img
                src={selectedLogo}
                alt="Logo"
                className={styles.logoThumb}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className={styles.logoPlaceholder}>No logo</div>
            )}
          </div>
          {allLogos.length > 0 && (
            <button
              type="button"
              className={styles.changeLink}
              onClick={() => setShowLogoPicker(!showLogoPicker)}
              disabled={isSaving}
            >
              {showLogoPicker ? 'Close' : 'Change'}
            </button>
          )}
          {!selectedLogo && allLogos.length === 0 && (
            <span className={styles.noLogosText}>No Brand Kit logos yet</span>
          )}
        </div>
        {logoHint && <div className={styles.logoHint}>{logoHint}</div>}
        {showLogoPicker && allLogos.length > 0 && (
          <div className={styles.logoPicker}>
            {allLogos.map((logo, idx) => (
              <img
                key={idx}
                src={logo.src}
                alt={logo.label}
                className={`${styles.logoPickThumb} ${selectedLogo === logo.src ? styles.selected : ''}`}
                title={logo.label}
                onClick={() => selectLogo(logo.src)}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Brand Color */}
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Brand Color</label>
        <div className={styles.colorRow}>
          <div
            className={styles.colorSwatch}
            style={{ background: fields.brandColor || '#333333' }}
            onClick={() => {
              const input = document.getElementById('esig-color-native') as HTMLInputElement;
              input?.click();
            }}
          />
          <input
            type="color"
            id="esig-color-native"
            value={fields.brandColor || '#333333'}
            onChange={(e) => handleFieldChange('brandColor', e.target.value)}
            className={styles.colorInput}
            style={{ display: 'none' }}
            disabled={isSaving}
          />
          <input
            type="text"
            value={fields.brandColor || '#333333'}
            onChange={(e) => handleFieldChange('brandColor', e.target.value)}
            className={styles.colorTextInput}
            placeholder="#333333"
            maxLength={7}
            disabled={isSaving}
          />
        </div>

        {/* Brand Kit Color Swatches */}
        {brandColors.length > 0 && (
          <div className={styles.bkSwatches}>
            {brandColors.map((hex) => (
              <div
                key={hex}
                className={`${styles.bkSwatch} ${
                  hex?.toLowerCase() === (fields.brandColor || '').toLowerCase() ? styles.selected : ''
                }`}
                style={{ background: hex || '#ccc' }}
                title={hex || undefined}
                onClick={() => handleFieldChange('brandColor', hex || '#333333')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
