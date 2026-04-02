interface YardSignTemplateProps {
  companyName: string;
  phone: string;
  headline: string;
  logoUrl: string | null;
  qrCodeUrl: string;
  brandColor: string;
  size: string;
}

export function getYardSignTemplate(props: YardSignTemplateProps) {
  const { companyName, phone, headline, logoUrl, qrCodeUrl, brandColor, size } = props;

  const sizes: Record<string, { w: number; h: number }> = {
    '18x24': { w: 450, h: 600 },
    '24x18': { w: 600, h: 450 },
    '12x18': { w: 360, h: 540 },
    '24x36': { w: 480, h: 720 },
    '36x24': { w: 720, h: 480 },
  };

  const dim = sizes[size] || sizes['18x24'];
  const W = dim.w;
  const H = dim.h;
  const isLandscape = W > H;
  const brandH = Math.round(H * 0.75);
  const stripH = H - brandH;
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
    // Green brand background — MUST equal canvas width exactly
    {
      type: 'rect',
      left: 0,
      top: 0,
      width: W,
      height: brandH,
      fill: brandColor,
      strokeWidth: 0,
      selectable: false,
      evented: false,
      lockMovement: true,
      lockScaling: true,
      name: 'brand-bg',
    },
    // White strip — MUST equal canvas width exactly
    {
      type: 'rect',
      left: 0,
      top: brandH,
      width: W,
      height: stripH,
      fill: '#ffffff',
      strokeWidth: 0,
      selectable: false,
      evented: false,
      lockMovement: true,
      lockScaling: true,
      name: 'white-strip',
    },
  ];

  // Logo — centered
  if (logoUrl) {
    objects.push({
      type: 'image',
      src: logoUrl,
      left: W / 2,
      top: isLandscape ? brandH * 0.08 : brandH * 0.08,
      originX: 'center',
      maxWidth: isLandscape ? 120 : 140,
      maxHeight: isLandscape ? 60 : 80,
      name: 'logo',
    });
  }

  // Headline — centered
  if (headline) {
    objects.push({
      type: 'textbox',
      text: headline,
      left: W / 2,
      top: isLandscape ? brandH * 0.42 : brandH * 0.38,
      width: W * 0.8,
      originX: 'center',
      fontSize: isLandscape ? 28 : 32,
      fontWeight: 800,
      fill: '#ffffff',
      textAlign: 'center',
      name: 'headline-text',
    });
  }

  // Phone — biggest text, centered
  if (phone) {
    objects.push({
      type: 'textbox',
      text: formattedPhone,
      left: W / 2,
      top: isLandscape ? brandH * 0.6 : brandH * 0.56,
      width: W * 0.9,
      originX: 'center',
      fontSize: isLandscape ? 44 : 52,
      fontWeight: 800,
      fill: '#ffffff',
      textAlign: 'center',
      name: 'phone-text',
    });
  }

  // Company name — white strip, left-aligned
  if (companyName) {
    objects.push({
      type: 'textbox',
      text: companyName,
      left: pad,
      top: brandH + Math.round(stripH * 0.25),
      width: W * 0.6,
      fontSize: isLandscape ? 18 : 20,
      fontWeight: 800,
      fill: brandColor,
      textAlign: 'left',
      name: 'company-text',
    });
  }

  // QR code placeholder — right-aligned in white strip
  if (qrCodeUrl) {
    const qrSize = Math.round(stripH * 0.6);
    objects.push({
      type: 'rect',
      left: W - pad - qrSize,
      top: brandH + Math.round((stripH - qrSize) / 2),
      width: qrSize,
      height: qrSize,
      fill: '#f3f4f6',
      strokeWidth: 0,
      rx: 4,
      ry: 4,
      name: 'qr-placeholder',
    });
  }

  return { width: W, height: H, objects };
}
