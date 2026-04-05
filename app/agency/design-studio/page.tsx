'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { useTheme } from '@/lib/theme';
import { motion, AnimatePresence } from 'framer-motion';
import SegmentedControl from '@/components/shared/SegmentedControl';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };
const spring = { type: 'spring' as const, stiffness: 400, damping: 25 };

type Tab = 'yard-signs' | 'business-cards' | 'email-signatures';

function TemplateIcon({ id, size = 24 }: { id: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 };
  switch (id) {
    case 'yard-sign': return <svg {...p}><rect x="4" y="2" width="16" height="12" rx="2"/><line x1="9" y1="14" x2="9" y2="22" strokeLinecap="round"/><line x1="15" y1="14" x2="15" y2="22" strokeLinecap="round"/></svg>;
    case 'business-card': return <svg {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="6" y1="12" x2="14" y2="12" strokeLinecap="round"/><line x1="6" y1="15" x2="10" y2="15" strokeLinecap="round"/></svg>;
    case 'email-signature': return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/></svg>;
    default: return null;
  }
}

export default function AgencyDesignStudioPage() {
  return <Suspense fallback={<div style={{ padding: 32, opacity: 0.5, fontSize: 13 }}>Loading...</div>}><Content /></Suspense>;
}

function Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTheme();

  const activeTab = (searchParams.get('tab') as Tab) || 'yard-signs';
  const setTab = (tab: Tab) => router.push(`/agency/design-studio?tab=${tab}`);

  const tabs = [
    { id: 'yard-signs' as Tab, label: 'Yard Signs' },
    { id: 'business-cards' as Tab, label: 'Business Cards' },
    { id: 'email-signatures' as Tab, label: 'Email Signatures' },
  ];

  const templateInfo: Record<Tab, { icon: string; label: string; desc: string }[]> = {
    'yard-signs': [
      { icon: 'yard-sign', label: '18" × 24"', desc: 'Standard portrait' },
      { icon: 'yard-sign', label: '24" × 18"', desc: 'Landscape' },
      { icon: 'yard-sign', label: '24" × 36"', desc: 'Large portrait' },
    ],
    'business-cards': [
      { icon: 'business-card', label: 'Standard', desc: '3.5 × 2 in' },
      { icon: 'business-card', label: 'Front + Back', desc: '3.5 × 2 in · 2 sides' },
    ],
    'email-signatures': [
      { icon: 'email-signature', label: 'Gmail / Outlook', desc: 'HTML signature' },
    ],
  };

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Design Studio</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Create and manage CALO&CO marketing assets</p>
        </motion.div>

        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <SegmentedControl
            tabs={tabs.map((tb) => ({ key: tb.id, label: tb.label }))}
            activeTab={activeTab}
            onChange={(key) => setTab(key as Tab)}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {templateInfo[activeTab].map((tmpl, i) => (
                <TemplateCard key={i} t={t} icon={tmpl.icon} label={tmpl.label} desc={tmpl.desc} />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function TemplateCard({ t, icon, label, desc }: { t: any; icon: string; label: string; desc: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div whileHover={{ scale: 1.02 }} transition={spring}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? t.bg.surfaceHover : t.bg.surface,
        border: `1px solid ${hovered ? t.border.hover : t.border.default}`,
        borderRadius: t.radius.md, padding: 24, minHeight: 140, cursor: 'pointer',
        transition: 'border-color 150ms, background 150ms',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ color: hovered ? t.accent.text : t.text.secondary, transition: 'color 150ms' }}>
        <TemplateIcon id={icon} size={28} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, marginTop: 16 }}>{label}</div>
      <div style={{ fontSize: 13, color: t.text.secondary, marginTop: 2, flex: 1 }}>{desc}</div>
      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: t.radius.sm, background: t.bg.primary, color: t.text.secondary }}>Not started</span>
      </div>
    </motion.div>
  );
}
