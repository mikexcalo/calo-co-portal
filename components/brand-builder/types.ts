/**
 * Types for Brand Builder module
 */

export type AssetType =
  | 'business-card'
  | 'yard-sign'
  | 'vehicle-magnet'
  | 't-shirt'
  | 'door-hanger'
  | 'flyer';

export interface AssetTypeConfig {
  id: AssetType;
  label: string;
  icon: string;
  widthIn: number;
  heightIn: number;
  description: string;
  hasFrontBack?: boolean;
  backWidthIn?: number;
  backHeightIn?: number;
}

export const ASSET_TYPES: AssetTypeConfig[] = [
  {
    id: 'business-card',
    label: 'Business Cards',
    icon: '💼',
    widthIn: 3.5,
    heightIn: 2,
    description: '3.5" × 2" — Front + Back',
    hasFrontBack: true,
  },
  {
    id: 'yard-sign',
    label: 'Yard Signs',
    icon: '🪧',
    widthIn: 24,
    heightIn: 18,
    description: '24" × 18"',
  },
  {
    id: 'vehicle-magnet',
    label: 'Vehicle Magnets',
    icon: '🚗',
    widthIn: 24,
    heightIn: 12,
    description: '24" × 12"',
  },
  {
    id: 't-shirt',
    label: 'T-Shirts',
    icon: '👕',
    widthIn: 12,
    heightIn: 12,
    description: 'Front: 12" × 12" · Back: 14" × 17"',
    hasFrontBack: true,
    backWidthIn: 14,
    backHeightIn: 17,
  },
  {
    id: 'door-hanger',
    label: 'Door Hangers',
    icon: '🚪',
    widthIn: 4.25,
    heightIn: 11,
    description: '4.25" × 11"',
  },
  {
    id: 'flyer',
    label: 'Flyers',
    icon: '📄',
    widthIn: 8.5,
    heightIn: 11,
    description: '8.5" × 11"',
  },
];

export interface BrandBuilderFields {
  logoUrl: string;
  companyName: string;
  contactName: string;
  contactTitle: string;
  phone: string;
  email: string;
  website: string;
  qrCodeUrl: string;
  tagline: string;
  address: string;
  licenseNumber: string;
  socialFacebook: string;
  socialInstagram: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  bodyText: string;
  headline: string;
  showAddress: boolean;
  showLicense: boolean;
  showSocials: boolean;
  // Field visibility toggles for business cards
  showCompanyName: boolean;
  showContactName: boolean;
  showContactTitle: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showWebsite: boolean;
  showQrCode: boolean;
  showTagline: boolean;
  showHeadline: boolean;
  showLogo: boolean;
  signSize: string;
}

export const DEFAULT_FIELDS: BrandBuilderFields = {
  logoUrl: '',
  companyName: '',
  contactName: '',
  contactTitle: '',
  phone: '',
  email: '',
  website: '',
  qrCodeUrl: '',
  tagline: '',
  address: '',
  licenseNumber: '',
  socialFacebook: '',
  socialInstagram: '',
  primaryColor: '#2563eb',
  secondaryColor: '#1e293b',
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, sans-serif',
  bodyText: '',
  headline: '',
  showAddress: false,
  showLicense: false,
  showSocials: false,
  showCompanyName: true,
  showContactName: false,
  showContactTitle: false,
  showPhone: true,
  showEmail: false,
  showWebsite: false,
  showQrCode: true,
  showTagline: false,
  showHeadline: true,
  showLogo: true,
  signSize: '18x24',
};

/** Field auto-fill source labels */
export interface FieldSource {
  field: keyof BrandBuilderFields;
  source: 'Brand Kit' | 'Contacts' | 'Client' | 'Manual';
}
