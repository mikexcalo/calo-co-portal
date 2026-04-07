'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { motion, AnimatePresence } from 'framer-motion';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } } };
const spring = { type: 'spring' as const, stiffness: 400, damping: 25 };

type Status = 'in-progress' | 'not-started' | 'coming-soon';

function TemplateIcon({ id, size = 20 }: { id: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 };
  switch (id) {
    case 'business-card': return <svg {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="6" y1="12" x2="14" y2="12" strokeLinecap="round"/><line x1="6" y1="15" x2="10" y2="15" strokeLinecap="round"/></svg>;
    case 'yard-sign': return <svg {...p}><rect x="4" y="2" width="16" height="12" rx="2"/><line x1="9" y1="14" x2="9" y2="22" strokeLinecap="round"/><line x1="15" y1="14" x2="15" y2="22" strokeLinecap="round"/></svg>;
    case 'vehicle-magnet': return <svg {...p}><rect x="1" y="6" width="16" height="10" rx="2"/><path d="M17 8l4 4v4h-4"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>;
    case 't-shirt': return <svg {...p}><path d="M8 2l-2 0-4 4v3h4v13h12V9h4V6l-4-4h-2c0 0-1 2-4 2s-4-2-4-2z"/></svg>;
    case 'door-hanger': return <svg {...p}><rect x="6" y="1" width="12" height="22" rx="2"/><circle cx="12" cy="5" r="2.5"/></svg>;
    case 'flyer': return <svg {...p}><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="7" x2="16" y2="7" strokeLinecap="round"/><line x1="8" y1="11" x2="14" y2="11" strokeLinecap="round"/><line x1="8" y1="15" x2="12" y2="15" strokeLinecap="round"/></svg>;
    case 'poster': return <svg {...p}><rect x="3" y="1" width="18" height="22" rx="2"/><rect x="6" y="4" width="12" height="8" rx="1" opacity="0.3" fill="currentColor" stroke="none"/><line x1="6" y1="15" x2="18" y2="15" strokeLinecap="round"/><line x1="6" y1="18" x2="14" y2="18" strokeLinecap="round"/></svg>;
    case 'one-pager': return <svg {...p}><rect x="4" y="1" width="16" height="22" rx="2"/><line x1="8" y1="6" x2="16" y2="6" strokeLinecap="round"/><line x1="8" y1="10" x2="16" y2="10" strokeLinecap="round"/><rect x="8" y="13" width="8" height="5" rx="1" opacity="0.2" fill="currentColor" stroke="none"/></svg>;
    case 'direct-mail': return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/></svg>;
    case 'email-signature': return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/><line x1="6" y1="14" x2="10" y2="14" strokeLinecap="round"/><line x1="6" y1="17" x2="8" y2="17" strokeLinecap="round"/></svg>;
    case 'social-graphics': return <svg {...p}><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="18" cy="6" r="1.5" fill="currentColor" stroke="none"/></svg>;
    case 'web-banners': return <svg {...p}><rect x="1" y="5" width="22" height="14" rx="2"/><line x1="1" y1="9" x2="23" y2="9"/><rect x="4" y="11" width="6" height="5" rx="1" opacity="0.2" fill="currentColor" stroke="none"/></svg>;
    default: return null;
  }
}

const print: { id: string; label: string; desc: string; status: Status }[] = [
  { id: 'business-card', label: 'Business Cards', desc: 'Front + Back', status: 'not-started' },
  { id: 'yard-sign', label: 'Yard Signs', desc: '5 sizes', status: 'in-progress' },
  { id: 'vehicle-magnet', label: 'Vehicle Magnets', desc: '24 × 12 in', status: 'not-started' },
  { id: 't-shirt', label: 'T-Shirts', desc: 'Front + Back', status: 'not-started' },
  { id: 'door-hanger', label: 'Door Hangers', desc: '4.25 × 11 in', status: 'not-started' },
  { id: 'flyer', label: 'Flyers', desc: '8.5 × 11 in', status: 'not-started' },
  { id: 'poster', label: 'Posters', desc: '3 sizes', status: 'not-started' },
  { id: 'one-pager', label: 'One-Pagers', desc: 'Sales + case study', status: 'not-started' },
  { id: 'direct-mail', label: 'Direct Mail', desc: 'Postcards · 6 × 4 in', status: 'not-started' },
];

const digital: { id: string; label: string; desc: string; status: Status }[] = [
  { id: 'email-signature', label: 'Email Signature', desc: 'Gmail · Outlook', status: 'not-started' },
  { id: 'social-graphics', label: 'Social Graphics', desc: 'IG · LinkedIn · FB', status: 'not-started' },
  { id: 'web-banners', label: 'Web Banners', desc: 'Hero · sidebar · leaderboard', status: 'coming-soon' },
];

export default function AgencyDesignStudioPage() {
  const { t } = useTheme();
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(() => typeof window !== 'undefined' && sessionStorage.getItem('agency-bk-alert-dismissed') === '1');

  // Check agency brand kit completeness from localStorage
  const agBrand = (() => { try { return JSON.parse(localStorage.getItem('calo-agency-brand-details') || '{}'); } catch { return {}; } })();
  const missingBk = !agBrand.logoUrl && !agBrand.colors?.length;

  const handleClick = (id: string, status: Status) => {
    if (status === 'coming-soon') { setToast('Coming soon'); setTimeout(() => setToast(null), 2000); return; }
    // Route to agency design studio module — currently only yard-sign has a dedicated builder
    // For now, log and navigate to a placeholder
    console.log('Open agency template:', id);
  };

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Design Studio</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Create and manage marketing assets</p>
        </motion.div>

        {/* Brand Kit alert */}
        {missingBk && !dismissed && (
          <motion.div variants={fadeUp} style={{
            background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.12)', borderRadius: 8,
            padding: '10px 16px', marginBottom: 20, fontSize: 13, color: t.text.secondary,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>Complete your Brand Kit to auto-populate templates <span onClick={() => router.push('/agency/brand-kit')} style={{ color: t.accent.text, fontWeight: 500, cursor: 'pointer' }}>Go to Brand Kit →</span></span>
            <button onClick={() => { setDismissed(true); sessionStorage.setItem('agency-bk-alert-dismissed', '1'); }}
              style={{ background: 'none', border: 'none', color: t.text.tertiary, fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
          </motion.div>
        )}

        <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Print</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {print.map((tmpl) => <TCard key={tmpl.id} t={t} id={tmpl.id} label={tmpl.label} desc={tmpl.desc} status={tmpl.status} onClick={() => handleClick(tmpl.id, tmpl.status)} />)}
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <div style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Digital</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {digital.map((tmpl) => <TCard key={tmpl.id} t={t} id={tmpl.id} label={tmpl.label} desc={tmpl.desc} status={tmpl.status} onClick={() => handleClick(tmpl.id, tmpl.status)} />)}
          </div>
        </motion.div>
      </motion.div>

      {/* Coming soon toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: t.bg.elevated, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md, padding: '10px 16px', boxShadow: t.shadow.elevated, fontSize: 13, color: t.text.primary }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ status, t }: { status: Status; t: any }) {
  if (status === 'in-progress') return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: t.radius.sm, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>In progress</span>;
  if (status === 'coming-soon') return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: t.radius.sm, background: 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}>Coming soon</span>;
  return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: t.radius.sm, background: t.bg.primary, color: t.text.secondary }}>Not started</span>;
}

function TCard({ t, id, label, desc, status, onClick }: { t: any; id: string; label: string; desc: string; status: Status; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div whileHover={{ scale: 1.02 }} transition={spring}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? t.bg.surfaceHover : t.bg.surface,
        border: `1px solid ${hovered ? t.border.hover : t.border.default}`,
        borderRadius: t.radius.md, padding: 16, cursor: 'pointer', minHeight: 100,
        transition: 'border-color 150ms, background 150ms',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ color: hovered ? t.accent.text : t.text.secondary, transition: 'color 150ms', marginBottom: 10 }}><TemplateIcon id={id} size={20} /></div>
      <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary }}>{label}</div>
      <div style={{ fontSize: 12, color: t.text.secondary, marginTop: 2, flex: 1 }}>{desc}</div>
      <div style={{ marginTop: 8 }}><StatusBadge status={status} t={t} /></div>
    </motion.div>
  );
}
