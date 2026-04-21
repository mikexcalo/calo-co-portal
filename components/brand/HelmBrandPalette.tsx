'use client';

import { useTheme } from '@/lib/theme';

const helmPalette = [
  { name: 'Square Blue', hex: '#006AFF', role: 'CTAs · Links · Primary actions' },
  { name: 'Helm Teal', hex: '#00C9A0', role: 'Success · Active · Positive' },
  { name: 'Deep Water', hex: '#0EA8C1', role: 'Info · In progress · Pending' },
  { name: 'Overdue Red', hex: '#DC2626', role: 'Overdue · Destructive · Alerts' },
  { name: 'Bronze', hex: '#8B6F47', role: 'Heritage · Logo · Identity' },
  { name: 'Charcoal', hex: '#1A1A1A', role: 'Dark backgrounds · Surfaces' },
  { name: 'Ivory', hex: '#F5F5F5', role: 'Light text · Warm neutral' },
];

export default function HelmBrandPalette() {
  const { t } = useTheme();

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: t.text.secondary, marginBottom: 12 }}>
        Helm Brand Palette
      </div>
      <div style={{ background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: t.radius.lg, padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
          {helmPalette.map((swatch) => (
            <div key={swatch.name}>
              <div style={{ width: '100%', height: 56, borderRadius: 8, background: swatch.hex, marginBottom: 8, border: swatch.hex === '#F5F5F5' || swatch.hex === '#1A1A1A' ? `0.5px solid ${t.border.default}` : 'none' }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>{swatch.name}</div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: t.text.secondary }}>{swatch.hex}</div>
              <div style={{ fontSize: 12, color: t.text.secondary, marginTop: 2 }}>{swatch.role}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.6, marginTop: 16 }}>
          Square Blue drives actions. Helm Teal signals success and positive outcomes. Deep Water covers in-progress and info states. Red stays for overdue and destructive actions. Bronze is the identity color that lives in the logo and heritage touches. Charcoal anchors dark surfaces with a warm undertone. Ivory provides the light-mode counterpart — near-white with a slight warmth that reads easier than pure white.
        </div>
      </div>
    </div>
  );
}
