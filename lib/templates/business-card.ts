interface BusinessCardTemplateProps {
  companyName: string;
  contactName: string;
  contactTitle: string;
  phone: string;
  email: string;
  website: string;
  tagline: string;
  logoUrl: string | null;
  qrCodeUrl: string;
  brandColor: string;
  displayWidth?: number;
  showCompanyName?: boolean;
  showContactName?: boolean;
  showContactTitle?: boolean;
  showPhone?: boolean;
  showEmail?: boolean;
  showWebsite?: boolean;
  showTagline?: boolean;
  showQrCode?: boolean;
}

export function getBusinessCardTemplate(props: BusinessCardTemplateProps) {
  const {
    companyName, contactName, contactTitle, phone, email, website, tagline,
    logoUrl, qrCodeUrl, brandColor, displayWidth = 525,
    showCompanyName = true, showContactName = true, showContactTitle = true,
    showPhone = true, showEmail = true, showWebsite = true,
    showTagline = false, showQrCode = true,
  } = props;

  // 3.5:2 ratio
  const W = displayWidth;
  const H = Math.round(displayWidth * (2 / 3.5));
  const pad = Math.round(W * 0.06);

  const objects: any[] = [
    // Background
    {
      type: 'rect', left: 0, top: 0, width: W, height: H,
      fill: '#ffffff', strokeWidth: 0,
      selectable: false, evented: false, lockMovement: true, lockScaling: true,
      name: 'card-bg',
    },
  ];

  let y = pad;

  // Logo — top left
  if (logoUrl) {
    objects.push({
      type: 'image', src: logoUrl,
      left: pad, top: y,
      originX: 'left',
      maxWidth: W * 0.25, maxHeight: H * 0.16,
      name: 'logo',
    });
    y += Math.round(H * 0.18);
  }

  // Company name
  if (companyName && showCompanyName !== false) {
    objects.push({
      type: 'text', text: companyName,
      left: pad, top: y, width: W * 0.7,
      fontSize: Math.round(W * 0.025), fontWeight: 600,
      fill: brandColor, textAlign: 'left',
      name: 'company-text',
    });
    y += Math.round(H * 0.08);
  }

  // Accent line
  objects.push({
    type: 'rect',
    left: pad, top: y, width: W * 0.55, height: 1,
    fill: brandColor, opacity: 0.3, strokeWidth: 0,
    selectable: false, evented: false,
    originX: 'left', originY: 'top',
    name: 'accent-line',
  });
  y += Math.round(H * 0.06);

  // Contact name
  if (contactName && showContactName !== false) {
    objects.push({
      type: 'text', text: contactName,
      left: pad, top: y, width: W * 0.7,
      fontSize: Math.round(W * 0.034), fontWeight: 700,
      fill: '#111827', textAlign: 'left',
      name: 'contact-name-text',
    });
    y += Math.round(H * 0.1);
  }

  // Title
  if (contactTitle && showContactTitle !== false) {
    objects.push({
      type: 'text', text: contactTitle,
      left: pad, top: y, width: W * 0.7,
      fontSize: Math.round(W * 0.023), fontWeight: 400,
      fill: '#6b7280', textAlign: 'left',
      name: 'title-text',
    });
    y += Math.round(H * 0.08);
  }

  // Contact info row — bottom left
  const contactParts: string[] = [];
  if (phone && showPhone !== false) contactParts.push(phone);
  if (email && showEmail !== false) contactParts.push(email);
  if (website && showWebsite !== false) contactParts.push(website);

  if (contactParts.length > 0) {
    objects.push({
      type: 'text', text: contactParts.join('  ·  '),
      left: pad, top: H - pad - Math.round(H * 0.12),
      width: W * 0.65,
      fontSize: Math.round(W * 0.021), fontWeight: 400,
      fill: '#374151', textAlign: 'left',
      name: 'contact-info-text',
    });
  }

  // QR code — bottom right
  if (qrCodeUrl && showQrCode !== false) {
    const qrSize = Math.round(H * 0.2);
    objects.push({
      type: 'rect',
      left: W - pad - qrSize, top: H - pad - qrSize,
      width: qrSize, height: qrSize,
      fill: '#f3f4f6', strokeWidth: 0, rx: 3, ry: 3,
      originX: 'left', originY: 'top',
      name: 'qr-placeholder',
    });
  }

  // Tagline — very bottom
  if (tagline && showTagline !== false) {
    objects.push({
      type: 'text', text: tagline,
      left: pad, top: H - Math.round(pad * 0.6),
      width: W * 0.6,
      fontSize: Math.round(W * 0.017), fontWeight: 400,
      fontStyle: 'italic',
      fill: '#9ca3af', textAlign: 'left',
      name: 'tagline-text',
    });
  }

  return { width: W, height: H, objects, qrCodeUrl: qrCodeUrl || '' };
}

export function getBusinessCardBackTemplate(props: {
  companyName: string; logoUrl: string | null; brandColor: string; displayWidth?: number;
}) {
  const { companyName, logoUrl, brandColor, displayWidth = 525 } = props;
  const W = displayWidth;
  const H = Math.round(displayWidth * (2 / 3.5));

  const objects: any[] = [
    {
      type: 'rect', left: 0, top: 0, width: W, height: H,
      fill: brandColor, strokeWidth: 0,
      selectable: false, evented: false, lockMovement: true, lockScaling: true,
      name: 'card-bg',
    },
  ];

  if (logoUrl) {
    objects.push({
      type: 'image', src: logoUrl,
      left: W / 2, top: H * 0.32,
      originX: 'center',
      maxWidth: W * 0.35, maxHeight: H * 0.25,
      name: 'logo',
    });
  }

  if (companyName) {
    objects.push({
      type: 'text', text: companyName,
      left: W / 2, top: H * 0.62, width: W * 0.7,
      originX: 'center',
      fontSize: Math.round(W * 0.032), fontWeight: 600,
      fill: '#ffffff', textAlign: 'center',
      name: 'company-text',
    });
  }

  return { width: W, height: H, objects, qrCodeUrl: '' };
}
