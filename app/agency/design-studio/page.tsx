'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { motion } from 'framer-motion';
import ConfirmModal from '@/components/shared/ConfirmModal';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

const templates = [
  { id: 'business-card', label: 'Business Cards', desc: '3.5 × 2 in' },
  { id: 'yard-sign', label: 'Yard Signs', desc: '5 sizes' },
  { id: 'vehicle-magnet', label: 'Vehicle Magnets', desc: '24 × 12 in' },
  { id: 't-shirt', label: 'T-Shirts', desc: 'Front + Back' },
  { id: 'door-hanger', label: 'Door Hangers', desc: '4.25 × 11 in' },
  { id: 'flyer', label: 'Flyers', desc: '8.5 × 11 in' },
];

function TemplateIcon({ id, size = 24 }: { id: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 };
  switch (id) {
    case 'business-card': return <svg {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="6" y1="12" x2="14" y2="12" strokeLinecap="round"/><line x1="6" y1="15" x2="10" y2="15" strokeLinecap="round"/></svg>;
    case 'yard-sign': return <svg {...p}><rect x="4" y="2" width="16" height="12" rx="2"/><line x1="9" y1="14" x2="9" y2="22" strokeLinecap="round"/><line x1="15" y1="14" x2="15" y2="22" strokeLinecap="round"/></svg>;
    case 'vehicle-magnet': return <svg {...p}><rect x="1" y="6" width="16" height="10" rx="2"/><path d="M17 8l4 4v4h-4"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>;
    case 't-shirt': return <svg {...p}><path d="M8 2l-2 0-4 4v3h4v13h12V9h4V6l-4-4h-2c0 0-1 2-4 2s-4-2-4-2z"/></svg>;
    case 'door-hanger': return <svg {...p}><rect x="6" y="1" width="12" height="22" rx="2"/><circle cx="12" cy="5" r="2.5"/></svg>;
    case 'flyer': return <svg {...p}><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="7" x2="16" y2="7" strokeLinecap="round"/><line x1="8" y1="11" x2="14" y2="11" strokeLinecap="round"/><line x1="8" y1="15" x2="12" y2="15" strokeLinecap="round"/></svg>;
    default: return null;
  }
}

export default function AgencyDesignStudioPage() {
  const router = useRouter();
  const { t } = useTheme();
  const [showAlert, setShowAlert] = useState(false);

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* Header */}
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Design Studio</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Agency-level templates and assets</p>
        </motion.div>

        {/* Identity bar */}
        <motion.div variants={fadeUp} style={{
          background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12,
          padding: '12px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: '#2563eb', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 700,
          }}>C</div>
          <span style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>CALO&CO</span>
          <span style={{ fontSize: 12, color: t.text.tertiary }}>·</span>
          <span style={{ fontSize: 12, color: t.accent.text, cursor: 'pointer' }} onClick={() => router.push('/agency/brand-kit')}>Brand Kit →</span>
        </motion.div>

        {/* Print section */}
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Print</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {templates.map((tmpl) => (
              <TemplateCard key={tmpl.id} t={t} icon={<TemplateIcon id={tmpl.id} size={28} />}
                label={tmpl.label} desc={tmpl.desc} onClick={() => setShowAlert(true)} />
            ))}
          </div>
        </motion.div>

        {/* Digital section */}
        <motion.div variants={fadeUp}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Digital</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <TemplateCard t={t} icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/></svg>}
              label="Email Signature" desc="Gmail, Outlook, more" onClick={() => setShowAlert(true)} />
            <TemplateCard t={t} icon={null} label="Social Images" desc="Coming soon" disabled />
            <TemplateCard t={t} icon={null} label="Web Banners" desc="Coming soon" disabled />
          </div>
        </motion.div>
      </motion.div>

      <ConfirmModal isOpen={showAlert} title="Agency Templates"
        message="Agency templates use CALO&CO brand data. This feature is coming soon."
        alertOnly onConfirm={() => setShowAlert(false)} onCancel={() => setShowAlert(false)} />
    </div>
  );
}

function TemplateCard({ t, icon, label, desc, onClick, disabled }: {
  t: any; icon: React.ReactNode; label: string; desc: string; onClick?: () => void; disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: t.bg.surface,
        border: `0.5px solid ${hovered && !disabled ? t.border.hover : t.border.default}`,
        borderRadius: 12, padding: 24, minHeight: 140,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'border-color 150ms, transform 150ms, box-shadow 150ms',
        transform: hovered && !disabled ? 'translateY(-2px)' : 'none',
        boxShadow: hovered && !disabled ? t.shadow.card : 'none',
        width: '100%', textAlign: 'left' as const, fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column' as const, color: t.text.primary,
      }}
    >
      {icon && <div style={{ color: hovered && !disabled ? t.accent.text : t.text.tertiary, transition: 'color 150ms' }}>{icon}</div>}
      <div style={{ fontSize: 15, fontWeight: 600, marginTop: icon ? 16 : 0 }}>{label}</div>
      <div style={{ fontSize: 13, color: t.text.tertiary, marginTop: 2, flex: 1 }}>{desc}</div>
      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: t.bg.surfaceHover, color: t.text.tertiary }}>
          {disabled ? 'Coming soon' : 'Not started'}
        </span>
      </div>
    </button>
  );
}
