'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { motion } from 'framer-motion';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } } };
const spring = { type: 'spring' as const, stiffness: 400, damping: 25 };

const printTemplates = [
  { id: 'posters', label: 'Posters', desc: '3 sizes',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="1" width="18" height="22" rx="2"/><rect x="6" y="4" width="12" height="8" rx="1" opacity="0.3" fill="currentColor" stroke="none"/><line x1="6" y1="15" x2="18" y2="15" strokeLinecap="round"/><line x1="6" y1="18" x2="14" y2="18" strokeLinecap="round"/></svg> },
  { id: 'flyers', label: 'Flyers', desc: '8.5 × 11 in',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="7" x2="16" y2="7" strokeLinecap="round"/><line x1="8" y1="11" x2="16" y2="11" strokeLinecap="round"/><line x1="8" y1="15" x2="12" y2="15" strokeLinecap="round"/></svg> },
  { id: 'business-cards', label: 'Business Cards', desc: 'Front + Back',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="6" y1="12" x2="14" y2="12" strokeLinecap="round"/><line x1="6" y1="15" x2="10" y2="15" strokeLinecap="round"/></svg> },
  { id: 'one-pagers', label: 'One-Pagers', desc: 'Sales + case study',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="6" x2="16" y2="6" strokeLinecap="round"/><line x1="8" y1="10" x2="16" y2="10" strokeLinecap="round"/><rect x="8" y="13" width="8" height="5" rx="1" opacity="0.2" fill="currentColor" stroke="none"/></svg> },
  { id: 'direct-mail', label: 'Direct Mail', desc: 'Postcards · 6 × 4 in',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/></svg> },
  { id: 'yard-signs', label: 'Yard Signs', desc: '5 sizes',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="2" width="16" height="12" rx="2"/><line x1="9" y1="14" x2="9" y2="22" strokeLinecap="round"/><line x1="15" y1="14" x2="15" y2="22" strokeLinecap="round"/></svg> },
];

const digitalTemplates = [
  { id: 'social-graphics', label: 'Social Graphics', desc: 'IG · LinkedIn · FB',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="18" cy="6" r="1.5" fill="currentColor" stroke="none"/></svg> },
  { id: 'email-signatures', label: 'Email Signature', desc: 'Gmail · Outlook',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/><line x1="6" y1="14" x2="10" y2="14" strokeLinecap="round"/><line x1="6" y1="17" x2="8" y2="17" strokeLinecap="round"/></svg> },
  { id: 'web-banners', label: 'Web Banners', desc: 'Hero · sidebar · leaderboard', comingSoon: true,
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="5" width="22" height="14" rx="2"/><line x1="1" y1="9" x2="23" y2="9"/><rect x="4" y="11" width="6" height="5" rx="1" opacity="0.2" fill="currentColor" stroke="none"/></svg> },
];

export default function AgencyDesignStudioPage() {
  const { t } = useTheme();

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        <motion.div variants={fadeUp} style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Design Studio</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Create and manage CALO&CO marketing assets</p>
        </motion.div>

        {/* PRINT */}
        <motion.div variants={fadeUp} style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Print</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {printTemplates.map((tmpl) => (
              <Card key={tmpl.id} t={t} icon={tmpl.icon} label={tmpl.label} desc={tmpl.desc} />
            ))}
          </div>
        </motion.div>

        {/* DIGITAL */}
        <motion.div variants={fadeUp}>
          <div style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Digital</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {digitalTemplates.map((tmpl) => (
              <Card key={tmpl.id} t={t} icon={tmpl.icon} label={tmpl.label} desc={tmpl.desc} comingSoon={(tmpl as any).comingSoon} />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function Card({ t, icon, label, desc, comingSoon }: { t: any; icon: React.ReactNode; label: string; desc: string; comingSoon?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div whileHover={{ scale: 1.02 }} transition={spring}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? t.bg.surfaceHover : t.bg.surface,
        border: `1px solid ${hovered ? t.border.hover : t.border.default}`,
        borderRadius: t.radius.md, padding: 20, cursor: 'pointer',
        transition: 'border-color 150ms, background 150ms',
        display: 'flex', flexDirection: 'column', minHeight: 130,
      }}
    >
      <div style={{ color: hovered ? t.accent.text : t.text.secondary, transition: 'color 150ms', marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: t.text.primary }}>{label}</div>
      <div style={{ fontSize: 13, color: t.text.secondary, marginTop: 2, flex: 1 }}>{desc}</div>
      <div style={{ marginTop: 10 }}>
        {comingSoon ? (
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: t.radius.sm, background: 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}>Coming soon</span>
        ) : (
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: t.radius.sm, background: t.bg.primary, color: t.text.secondary }}>Not started</span>
        )}
      </div>
    </motion.div>
  );
}
