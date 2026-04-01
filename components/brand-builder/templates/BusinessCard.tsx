'use client';

import { useState, useEffect } from 'react';
import { BrandBuilderFields } from '../types';
import QRCode from '../QRCode';

interface BusinessCardProps {
  fields: BrandBuilderFields;
  side: 'front' | 'back';
}

export default function BusinessCard({ fields, side }: BusinessCardProps) {
  const {
    logoUrl, companyName, contactName, contactTitle, phone, email, website,
    qrCodeUrl, tagline, primaryColor, secondaryColor, backgroundColor, fontFamily,
    showCompanyName, showContactName, showContactTitle, showPhone, showEmail,
    showWebsite, showQrCode, showTagline,
  } = fields;

  // 3.5" × 2" card → 350×200 preview
  const w = 350, h = 200;

  // Detect logo aspect ratio
  const [logoAspect, setLogoAspect] = useState(1);
  useEffect(() => {
    if (!logoUrl) { setLogoAspect(1); return; }
    const img = new Image();
    img.onload = () => setLogoAspect(img.naturalWidth / img.naturalHeight);
    img.src = logoUrl;
  }, [logoUrl]);

  // Square: 0.7–1.3, Horizontal: >1.3
  const isSquare = logoAspect >= 0.7 && logoAspect <= 1.3;

  const cardBase: React.CSSProperties = {
    width: w, height: h, borderRadius: 8, fontFamily,
    overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  };

  // ===== SQUARE LOGO (0.7–1.3) =====
  if (isSquare) {
    if (side === 'back') {
      return (
        <div style={{
          ...cardBase, background: primaryColor, color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {logoUrl && (
            <img src={logoUrl} alt="Logo" style={{
              height: 120, maxWidth: w * 0.6, objectFit: 'contain', filter: 'brightness(0) invert(1)',
            }} />
          )}
          {showCompanyName && companyName && (
            <div style={{ fontSize: 14, fontWeight: 700, textAlign: 'center' }}>{companyName}</div>
          )}
          {showTagline && tagline && (
            <div style={{ fontSize: 9, opacity: 0.8, textAlign: 'center', padding: '0 24px' }}>{tagline}</div>
          )}
        </div>
      );
    }

    // FRONT — Square: accent bar → logo(80) left + QR(70) right → company → contact
    return (
      <div style={{
        ...cardBase, background: backgroundColor || '#fff', color: secondaryColor,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Accent bar */}
        <div style={{ height: 6, background: primaryColor, flexShrink: 0 }} />

        {/* Logo left + QR right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 6px' }}>
          {logoUrl && (
            <img src={logoUrl} alt="Logo" style={{ height: 80, maxWidth: 100, objectFit: 'contain', flexShrink: 0 }} />
          )}
          {showQrCode && qrCodeUrl && (
            <div style={{ flexShrink: 0 }}>
              <QRCode url={qrCodeUrl} size={70} color={primaryColor} bgColor={backgroundColor || '#fff'} />
            </div>
          )}
        </div>

        {/* Company name + contact details, left-aligned */}
        <div style={{ padding: '0 20px 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {showCompanyName && companyName && (
            <div style={{ fontSize: 12, fontWeight: 700, color: primaryColor, marginBottom: 3 }}>{companyName}</div>
          )}
          {showContactName && contactName && (
            <div style={{ fontSize: 10, fontWeight: 600, color: secondaryColor, marginBottom: 1 }}>{contactName}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {showPhone && phone && <div style={{ fontSize: 8, color: '#6b7280' }}>{phone}</div>}
            {showEmail && email && <div style={{ fontSize: 8, color: '#6b7280' }}>{email}</div>}
            {showWebsite && website && <div style={{ fontSize: 8, color: primaryColor }}>{website}</div>}
          </div>
        </div>
      </div>
    );
  }

  // ===== HORIZONTAL LOGO (>1.3) =====
  if (side === 'back') {
    // BACK — QR(80) left + divider + contact right
    return (
      <div style={{
        ...cardBase, background: primaryColor, color: '#fff',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16 }}>
          {/* QR left */}
          {showQrCode && qrCodeUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <QRCode url={qrCodeUrl} size={80} color="#ffffff" bgColor={primaryColor} />
              <div style={{ fontSize: 7, opacity: 0.7 }}>Scan for website</div>
            </div>
          )}
          {/* Vertical divider */}
          {showQrCode && qrCodeUrl && (
            <div style={{ width: 1, height: '60%', background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
          )}
          {/* Contact info right */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
            {showContactName && contactName && <div style={{ fontSize: 12, fontWeight: 600 }}>{contactName}</div>}
            {showContactTitle && contactTitle && <div style={{ fontSize: 9, opacity: 0.8 }}>{contactTitle}</div>}
            {showPhone && phone && <div style={{ fontSize: 9, opacity: 0.85, marginTop: 4 }}>{phone}</div>}
            {showEmail && email && <div style={{ fontSize: 9, opacity: 0.85 }}>{email}</div>}
            {showWebsite && website && <div style={{ fontSize: 9, opacity: 0.85 }}>{website}</div>}
          </div>
        </div>
      </div>
    );
  }

  // FRONT — Horizontal: accent bar → logo ~70% width → company name → contact centered
  return (
    <div style={{
      ...cardBase, background: backgroundColor || '#fff', color: secondaryColor,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: primaryColor }} />
      {logoUrl && (
        <img src={logoUrl} alt="Logo" style={{
          maxWidth: w * 0.7, maxHeight: h * 0.4, objectFit: 'contain', marginBottom: 8,
        }} />
      )}
      {showCompanyName && companyName && (
        <div style={{ fontSize: 13, fontWeight: 700, color: primaryColor, textAlign: 'center', marginBottom: 4 }}>{companyName}</div>
      )}
      {/* Contact details centered below */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        {showContactName && contactName && <div style={{ fontSize: 9, color: '#6b7280' }}>{contactName}</div>}
        {showPhone && phone && <div style={{ fontSize: 8, color: '#6b7280' }}>{phone}</div>}
        {showEmail && email && <div style={{ fontSize: 8, color: '#6b7280' }}>{email}</div>}
      </div>
    </div>
  );
}
