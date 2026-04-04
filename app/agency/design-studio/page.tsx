'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { useTheme } from '@/lib/theme';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '@/components/shared/ConfirmModal';
import SegmentedControl from '@/components/shared/SegmentedControl';
import BrandKitComponent from '@/components/shared/BrandKit';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

type Tab = 'brand-kit' | 'print' | 'digital';

const printTemplates = [
  { id: 'business-card', label: 'Business Cards', desc: '3.5 × 2 in' },
  { id: 'yard-sign', label: 'Yard Signs', desc: '5 sizes' },
  { id: 'vehicle-magnet', label: 'Vehicle Magnets', desc: '24 × 12 in' },
  { id: 't-shirt', label: 'T-Shirts', desc: 'Front + Back' },
  { id: 'door-hanger', label: 'Door Hangers', desc: '4.25 × 11 in' },
  { id: 'flyer', label: 'Flyers', desc: '8.5 × 11 in' },
];

const digitalTemplates = [
  { id: 'email-signature', label: 'Email Signature', desc: 'Gmail, Outlook, more' },
  { id: 'social-images', label: 'Social Images', desc: 'Coming soon', disabled: true },
  { id: 'web-banners', label: 'Web Banners', desc: 'Coming soon', disabled: true },
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
    case 'email-signature': return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/></svg>;
    default: return null;
  }
}

export default function AgencyDesignStudioPage() {
  return <Suspense fallback={<div style={{ padding: 32, opacity: 0.5, fontSize: 13 }}>Loading...</div>}><DesignStudioContent /></Suspense>;
}

function DesignStudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTheme();
  const [showAlert, setShowAlert] = useState(false);

  const activeTab = (searchParams.get('tab') as Tab) || 'brand-kit';

  const setTab = (tab: Tab) => {
    router.push(`/agency/design-studio?tab=${tab}`);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'brand-kit', label: 'Brand Kit' },
    { id: 'print', label: 'Print' },
    { id: 'digital', label: 'Digital' },
  ];

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* Header */}
        <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Design Studio</h1>
            <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Agency brand assets and templates</p>
          </div>
          <button title="Brand Kit" onClick={() => setTab('brand-kit')} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6,
            color: t.text.secondary, transition: 'color 150ms, background 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = t.text.primary; e.currentTarget.style.background = t.bg.surface; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = t.text.secondary; e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
          </button>
        </motion.div>

        {/* Segmented control */}
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <SegmentedControl
            tabs={tabs.map((tb) => ({ key: tb.id, label: tb.label }))}
            activeTab={activeTab}
            onChange={(key) => setTab(key as Tab)}
          />
        </motion.div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

            {activeTab === 'brand-kit' && (
              <BrandKitComponent context={{ type: 'agency' }} />
            )}

            {activeTab === 'print' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                  {printTemplates.map((tmpl) => (
                    <TemplateCard key={tmpl.id} t={t} id={tmpl.id} label={tmpl.label} desc={tmpl.desc} onClick={() => setShowAlert(true)} />
                  ))}
                </div>
                <div style={{ textAlign: 'center', fontSize: 13, color: t.text.tertiary, padding: '8px 0' }}>
                  Select a client to create print materials
                </div>
              </>
            )}

            {activeTab === 'digital' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                  {digitalTemplates.map((tmpl) => (
                    <TemplateCard key={tmpl.id} t={t} id={tmpl.id} label={tmpl.label} desc={tmpl.desc}
                      disabled={(tmpl as any).disabled} onClick={() => setShowAlert(true)} />
                  ))}
                </div>
                <div style={{ textAlign: 'center', fontSize: 13, color: t.text.tertiary, padding: '8px 0' }}>
                  Select a client to create digital assets
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <ConfirmModal isOpen={showAlert} title="Agency Templates"
        message="Agency templates use CALO&CO brand data. Select a client from the Clients page to create assets."
        alertOnly onConfirm={() => setShowAlert(false)} onCancel={() => setShowAlert(false)} />
    </div>
  );
}

function TemplateCard({ t, id, label, desc, onClick, disabled }: {
  t: any; id: string; label: string; desc: string; onClick?: () => void; disabled?: boolean;
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
      <div style={{ color: hovered && !disabled ? t.accent.text : t.text.tertiary, transition: 'color 150ms' }}>
        <TemplateIcon id={id} size={28} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 16 }}>{label}</div>
      <div style={{ fontSize: 13, color: t.text.tertiary, marginTop: 2, flex: 1 }}>{desc}</div>
      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: t.bg.surfaceHover, color: t.text.tertiary }}>
          {disabled ? 'Coming soon' : 'Not started'}
        </span>
      </div>
    </button>
  );
}
