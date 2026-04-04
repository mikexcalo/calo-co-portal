'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { useTheme } from '@/lib/theme';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '@/components/shared/ConfirmModal';

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

  // Brand Kit state
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [colorHex, setColorHex] = useState('#2563eb');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'brand-kit', label: 'Brand Kit' },
    { id: 'print', label: 'Print' },
    { id: 'digital', label: 'Digital' },
  ];

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* Header */}
        <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Design Studio</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Agency brand assets and templates</p>
        </motion.div>

        {/* Tab bar */}
        <motion.div variants={fadeUp} style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${t.border.default}`, marginBottom: 24 }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setTab(tab.id)} style={{
              padding: '12px 16px', fontSize: 13, fontWeight: activeTab === tab.id ? 500 : 400,
              color: activeTab === tab.id ? t.text.primary : t.text.secondary,
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              borderBottom: activeTab === tab.id ? `2px solid ${t.accent.primary}` : '2px solid transparent',
              transition: 'color 150ms',
              marginBottom: -1,
            }}
            onMouseEnter={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = t.text.primary; }}
            onMouseLeave={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = t.text.secondary; }}
            >{tab.label}</button>
          ))}
        </motion.div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

            {activeTab === 'brand-kit' && (
              <>
                {/* Identity card */}
                <div style={{
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
                </div>

                {/* Logo */}
                <div style={{ marginBottom: 24 }}>
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
                </div>

                {/* Colors */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, marginBottom: 12 }}>Brand Colors</div>
                  <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 24 }}>
                    <div style={{ fontSize: 13, color: t.text.secondary, marginBottom: 12 }}>Primary Color</div>
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
                </div>

                {/* Fonts */}
                <div>
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
                </div>
              </>
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
