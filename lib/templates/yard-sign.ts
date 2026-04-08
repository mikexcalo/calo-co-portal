interface YardSignTemplateProps {
  companyName: string;
  phone: string;
  headline: string;
  logoUrl: string | null;
  qrCodeUrl: string;
  brandColor: string;
  size: string;
  displayWidth?: number;
  showHeadline?: boolean;
  showPhone?: boolean;
  showCompanyName?: boolean;
  showQrCode?: boolean;
  showLogo?: boolean;
  tagline?: string;
  showTagline?: boolean;
  email?: string;
  showEmail?: boolean;
  website?: string;
  showWebsite?: boolean;
}

// Physical dimensions in inches for PDF export
export const SIGN_PHYSICAL_SIZES: Record<string, { w: number; h: number }> = {
  '18x24': { w: 18, h: 24 },
  '24x18': { w: 24, h: 18 },
  '12x18': { w: 12, h: 18 },
  '24x36': { w: 24, h: 36 },
  '36x24': { w: 36, h: 24 },
};

export function getYardSignTemplate(props: YardSignTemplateProps) {
  const {
    companyName, phone, headline, logoUrl, qrCodeUrl, brandColor, size,
    displayWidth = 600,
    showHeadline = true, showPhone = true, showCompanyName = true, showQrCode = true,
    showLogo = true,
    tagline = '', showTagline = false,
    email = '', showEmail = false,
    website = '', showWebsite = false,
  } = props;

  const phys = SIGN_PHYSICAL_SIZES[size] || SIGN_PHYSICAL_SIZES['18x24'];
  const aspectRatio = phys.h / phys.w;
  const isLandscape = phys.w > phys.h;

  const maxHeight = 500;
  let W = displayWidth;
  let H = Math.round(displayWidth * aspectRatio);
  if (H > maxHeight) {
    H = maxHeight;
    W = Math.round(maxHeight / aspectRatio);
  }

  const topH = Math.round(H * 0.75);
  const bottomH = H - topH;
  const pad = Math.round(W * 0.05);

  // Format phone
  const digits = phone.replace(/\D/g, '');
  let formattedPhone = phone;
  if (digits.length === 10) {
    formattedPhone = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    formattedPhone = `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  const objects: any[] = [
    {
      type: 'rect', left: 0, top: 0,
      width: W, height: topH, fill: brandColor,
      strokeWidth: 0, selectable: false, evented: false,
      lockMovement: true, lockScaling: true, name: 'brand-bg',
    },
    {
      type: 'rect', left: 0, top: topH,
      width: W, height: bottomH, fill: '#ffffff',
      strokeWidth: 0, selectable: false, evented: false,
      lockMovement: true, lockScaling: true, name: 'white-strip',
    },
  ];

  // Logo — constrained to 35% width, 18% height
  if (logoUrl && showLogo !== false) {
    objects.push({
      type: 'image', src: logoUrl,
      left: W / 2,
      top: Math.round(topH * 0.05),
      originX: 'center',
      maxWidth: W * 0.50,
      maxHeight: topH * 0.28,
      name: 'logo',
    });
  }

  // Headline — single line, auto-scale font to fit, clears logo
  const logoTop = Math.round(topH * 0.05);
  const logoMaxH = topH * 0.28;
  const logoBottom = (logoUrl && showLogo !== false) ? logoTop + logoMaxH + Math.round(topH * 0.03) : Math.round(topH * 0.08);

  if (headline && showHeadline !== false) {
    const maxWidth = W * 0.85;
    const baseFontSize = isLandscape ? W * 0.055 : W * 0.065;
    const estimatedWidth = headline.length * baseFontSize * 0.55;
    const finalFontSize = Math.max(16, estimatedWidth > maxWidth
      ? Math.round(baseFontSize * (maxWidth / estimatedWidth))
      : Math.round(baseFontSize));

    objects.push({
      type: 'text', text: headline,
      left: W / 2,
      top: Math.round(logoBottom),
      originX: 'center',
      fontSize: finalFontSize,
      fontWeight: 800, fill: '#ffffff', textAlign: 'center',
      name: 'headline-text',
    });
  }

  // Track vertical cursor for stacking elements below headline
  let cursorY = logoBottom + (headline && showHeadline !== false ? Math.round(isLandscape ? W * 0.06 : W * 0.07) : 0);

  // Tagline (italic, smaller, below headline)
  if (tagline && showTagline) {
    objects.push({
      type: 'text', text: tagline,
      left: W / 2,
      top: cursorY,
      originX: 'center',
      fontSize: Math.round(isLandscape ? W * 0.032 : W * 0.038),
      fontWeight: 400, fontStyle: 'italic', fill: '#ffffff', textAlign: 'center',
      name: 'tagline-text',
    });
    cursorY += Math.round(isLandscape ? W * 0.045 : W * 0.05);
  }

  // Phone
  if (phone && showPhone !== false) {
    objects.push({
      type: 'text', text: formattedPhone,
      left: W / 2,
      top: cursorY + Math.round(topH * 0.02),
      width: W * 0.95, originX: 'center',
      fontSize: Math.round(isLandscape ? W * 0.1 : W * 0.13),
      fontWeight: 800, fill: '#ffffff', textAlign: 'center',
      name: 'phone-text',
    });
  }

  // Company name
  const companyFontSize = Math.min(Math.round(isLandscape ? W * 0.04 : W * 0.05), Math.round(bottomH * 0.25));
  if (companyName && showCompanyName !== false) {
    objects.push({
      type: 'text', text: companyName,
      left: pad,
      top: topH + Math.round(bottomH * 0.12),
      width: W * 0.6,
      fontSize: companyFontSize,
      fontWeight: 900, fill: brandColor, textAlign: 'left',
      name: 'company-text',
    });
  }

  // Website below company name (smaller, lighter)
  let infoY = topH + Math.round(bottomH * 0.45);
  if (website && showWebsite) {
    objects.push({
      type: 'text', text: website,
      left: pad,
      top: infoY,
      fontSize: Math.round(companyFontSize * 0.65),
      fontWeight: 400, fill: '#888888', textAlign: 'left',
      name: 'website-text',
    });
    infoY += Math.round(companyFontSize * 0.85);
  }

  // Email below website (even smaller)
  if (email && showEmail) {
    objects.push({
      type: 'text', text: email,
      left: pad,
      top: infoY,
      fontSize: Math.round(companyFontSize * 0.6),
      fontWeight: 400, fill: '#999999', textAlign: 'left',
      name: 'email-text',
    });
  }

  // QR code placeholder
  if (qrCodeUrl && showQrCode !== false) {
    const qrSize = Math.round(bottomH * 0.6);
    objects.push({
      type: 'rect',
      left: W - pad - qrSize,
      top: topH + Math.round((bottomH - qrSize) / 2),
      width: qrSize, height: qrSize,
      fill: '#f3f4f6', strokeWidth: 0, rx: 4, ry: 4,
      name: 'qr-placeholder',
    });
  }

  return { width: W, height: H, objects, qrCodeUrl: qrCodeUrl || '' };
}
