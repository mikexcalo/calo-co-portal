interface YardSignTemplateProps {
  companyName: string;
  phone: string;
  headline: string;
  logoUrl: string | null;
  qrCodeUrl: string;
  email?: string;
  website?: string;
  brandColor: string;
  size: string;
}

export function getYardSignTemplate(props: YardSignTemplateProps) {
  const { companyName, phone, headline, logoUrl, qrCodeUrl, email, website, brandColor, size } = props;

  // Canvas dimensions in points
  const sizes: Record<string, { w: number; h: number }> = {
    '18x24': { w: 450, h: 600 },
    '24x18': { w: 600, h: 450 },
    '12x18': { w: 360, h: 540 },
    '24x36': { w: 480, h: 720 },
    '36x24': { w: 720, h: 480 },
  };

  const dim = sizes[size] || sizes['18x24'];
  const isLandscape = dim.w > dim.h;
  const stripHeight = Math.round(dim.h * 0.22);
  const brandHeight = dim.h - stripHeight;

  // Format phone
  const digits = phone.replace(/\D/g, '');
  let formattedPhone = phone;
  if (digits.length === 10) {
    formattedPhone = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    formattedPhone = `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  const objects: any[] = [
    // Brand color background
    {
      type: 'rect',
      left: 0, top: 0,
      width: dim.w, height: brandHeight,
      fill: brandColor,
      selectable: false, evented: false,
      lockMovement: true, lockScaling: true,
      name: 'brand-bg',
    },
    // White strip
    {
      type: 'rect',
      left: 0, top: brandHeight,
      width: dim.w, height: stripHeight,
      fill: '#ffffff',
      selectable: false, evented: false,
      lockMovement: true, lockScaling: true,
      name: 'white-strip',
    },
  ];

  // Logo
  if (logoUrl) {
    const logoSize = isLandscape ? 60 : 80;
    objects.push({
      type: 'image',
      src: logoUrl,
      left: dim.w / 2 - logoSize / 2,
      top: isLandscape ? brandHeight * 0.12 : brandHeight * 0.1,
      maxWidth: logoSize * 1.5,
      maxHeight: logoSize,
      name: 'logo',
    });
  }

  // Headline
  if (headline) {
    objects.push({
      type: 'textbox',
      text: headline,
      left: dim.w * 0.1,
      top: isLandscape ? brandHeight * 0.45 : brandHeight * 0.4,
      width: dim.w * 0.8,
      fontSize: isLandscape ? 28 : 32,
      fontWeight: 800,
      fill: '#ffffff',
      textAlign: 'center',
      name: 'headline-text',
    });
  }

  // Phone — biggest text
  if (phone) {
    objects.push({
      type: 'textbox',
      text: formattedPhone,
      left: dim.w * 0.05,
      top: isLandscape ? brandHeight * 0.62 : brandHeight * 0.58,
      width: dim.w * 0.9,
      fontSize: isLandscape ? 44 : 52,
      fontWeight: 800,
      fill: '#ffffff',
      textAlign: 'center',
      name: 'phone-text',
    });
  }

  // Company name — in white strip, brand colored
  if (companyName) {
    objects.push({
      type: 'textbox',
      text: companyName,
      left: dim.w * 0.05,
      top: brandHeight + stripHeight * 0.15,
      width: dim.w * 0.65,
      fontSize: isLandscape ? 18 : 20,
      fontWeight: 800,
      fill: brandColor,
      textAlign: 'left',
      name: 'company-text',
    });
  }

  // Detail text (email or website) — in white strip
  const detail = email || website || '';
  if (detail) {
    objects.push({
      type: 'textbox',
      text: detail,
      left: dim.w * 0.05,
      top: brandHeight + stripHeight * 0.6,
      width: dim.w * 0.65,
      fontSize: 11,
      fontWeight: 400,
      fill: '#6b7280',
      textAlign: 'left',
      name: 'detail-text',
    });
  }

  // QR code placeholder
  if (qrCodeUrl) {
    const qrSize = isLandscape ? stripHeight * 0.65 : stripHeight * 0.7;
    objects.push({
      type: 'rect',
      left: dim.w * 0.78,
      top: brandHeight + stripHeight * 0.12,
      width: qrSize,
      height: qrSize,
      fill: '#f3f4f6',
      name: 'qr-placeholder',
    });
  }

  return { width: dim.w, height: dim.h, objects };
}
