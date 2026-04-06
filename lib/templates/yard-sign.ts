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

  // Logo
  if (logoUrl) {
    objects.push({
      type: 'image', src: logoUrl,
      left: W / 2,
      top: Math.round(topH * 0.03),
      originX: 'center',
      maxWidth: isLandscape ? W * 0.35 : W * 0.4,
      maxHeight: isLandscape ? topH * 0.22 : topH * 0.25,
      name: 'logo',
    });
  }

  // Headline — auto-scale font to fit one line
  if (headline && showHeadline !== false) {
    const maxFontBase = isLandscape ? W * 0.055 : W * 0.065;
    // Approximate: each char at weight 800 is ~0.6em wide. Scale down for long headlines.
    const approxCharsAtMax = (W * 0.85) / (maxFontBase * 0.55);
    const headlineFontSize = headline.length > approxCharsAtMax
      ? Math.round(maxFontBase * (approxCharsAtMax / headline.length))
      : Math.round(maxFontBase);
    const clampedSize = Math.max(14, Math.min(headlineFontSize, Math.round(maxFontBase)));

    objects.push({
      type: 'textbox', text: headline,
      left: W / 2,
      top: Math.round(isLandscape ? topH * 0.36 : topH * 0.32),
      width: W * 0.85, originX: 'center',
      fontSize: clampedSize,
      fontWeight: 800, fill: '#ffffff', textAlign: 'center',
      name: 'headline-text',
    });
  }

  // Tagline (italic, smaller, below headline)
  if (tagline && showTagline) {
    objects.push({
      type: 'textbox', text: tagline,
      left: W / 2,
      top: Math.round(isLandscape ? topH * 0.46 : topH * 0.44),
      width: W * 0.8, originX: 'center',
      fontSize: Math.round(isLandscape ? W * 0.032 : W * 0.038),
      fontWeight: 400, fontStyle: 'italic', fill: '#ffffff', textAlign: 'center',
      name: 'tagline-text',
    });
  }

  // Phone
  if (phone && showPhone !== false) {
    const phoneTopOffset = (tagline && showTagline) ? 0.06 : 0;
    objects.push({
      type: 'textbox', text: formattedPhone,
      left: W / 2,
      top: Math.round(isLandscape ? topH * (0.52 + phoneTopOffset) : topH * (0.50 + phoneTopOffset)),
      width: W * 0.95, originX: 'center',
      fontSize: Math.round(isLandscape ? W * 0.1 : W * 0.13),
      fontWeight: 800, fill: '#ffffff', textAlign: 'center',
      name: 'phone-text',
    });
  }

  // Company name
  if (companyName && showCompanyName !== false) {
    objects.push({
      type: 'textbox', text: companyName,
      left: pad,
      top: topH + Math.round(bottomH * 0.15),
      width: W * 0.6,
      fontSize: Math.round(isLandscape ? W * 0.04 : W * 0.05),
      fontWeight: 900, fill: brandColor, textAlign: 'left',
      name: 'company-text',
    });
  }

  // Email/Website below company name
  const infoLines: string[] = [];
  if (email && showEmail) infoLines.push(email);
  if (website && showWebsite) infoLines.push(website);
  if (infoLines.length > 0 && showCompanyName !== false) {
    objects.push({
      type: 'textbox', text: infoLines.join('  •  '),
      left: pad,
      top: topH + Math.round(bottomH * 0.55),
      width: W * 0.55,
      fontSize: Math.round(isLandscape ? W * 0.025 : W * 0.03),
      fontWeight: 400, fill: '#666666', textAlign: 'left',
      name: 'info-text',
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
