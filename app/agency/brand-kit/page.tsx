'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { motion } from 'framer-motion';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

export default function AgencyBrandKitPage() {
  const { t } = useTheme();
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [colorHex, setColorHex] = useState('#2563eb');

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* Header */}
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Agency Brand Kit</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>CALO&CO brand assets and guidelines</p>
        </motion.div>

        {/* Identity card */}
        <motion.div variants={fadeUp} style={{
          background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12,
          padding: 24, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 10, background: '#2563eb', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 22, fontWeight: 700,
          }}>C</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: t.text.primary }}>CALO&CO</div>
            <div style={{ fontSize: 13, color: t.text.secondary }}>Creative Agency</div>
          </div>
        </motion.div>

        {/* Logo section */}
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, marginBottom: 12 }}>Logo</div>
          <div style={{
            background: t.bg.surface, border: `1px dashed ${t.border.default}`, borderRadius: 12,
            padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 12, background: t.bg.surfaceHover,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', color: t.text.tertiary, fontSize: 22,
              }}>+</div>
              <div style={{ fontSize: 13, color: t.text.tertiary }}>Upload agency logo</div>
              <div style={{ fontSize: 11, color: t.text.tertiary, opacity: 0.6, marginTop: 4 }}>PNG, SVG, or JPG</div>
            </div>
          </div>
        </motion.div>

        {/* Brand Colors section */}
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, marginBottom: 12 }}>Brand Colors</div>
          <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: t.text.secondary, marginBottom: 12 }}>Primary Color</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="color" value={primaryColor}
                onChange={(e) => { setPrimaryColor(e.target.value); setColorHex(e.target.value); }}
                style={{ width: 40, height: 40, border: `1px solid ${t.border.default}`, borderRadius: 8, cursor: 'pointer', padding: 0 }} />
              <input type="text" value={colorHex}
                onChange={(e) => { setColorHex(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setPrimaryColor(e.target.value); }}
                maxLength={7}
                style={{ width: 100, padding: '8px 12px', border: `1px solid ${t.border.default}`, borderRadius: 8, fontSize: 14, fontFamily: 'monospace', color: t.text.primary, background: t.bg.primary }} />
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: primaryColor }} />
            </div>
          </div>
        </motion.div>

        {/* Fonts section */}
        <motion.div variants={fadeUp}>
          <div style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, marginBottom: 12 }}>Fonts</div>
          <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {['Heading', 'Body', 'Accent'].map((label) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: t.text.secondary, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>{label}</div>
                  <input type="text" placeholder={`${label} font`}
                    style={{ width: '100%', padding: '8px 12px', border: `1px solid ${t.border.default}`, borderRadius: 8, fontSize: 14, color: t.text.primary, fontFamily: 'inherit', background: t.bg.primary }} />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
