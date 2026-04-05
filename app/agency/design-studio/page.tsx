'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme';
import { motion } from 'framer-motion';
import { DB, loadClients } from '@/lib/database';
import { Client } from '@/lib/types';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };
const spring = { type: 'spring' as const, stiffness: 400, damping: 25 };

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
  const router = useRouter();
  const { t } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      setClients(DB.clients.sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name)));
      setLoaded(true);
    };
    init();
  }, []);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const handleTemplateClick = (templateId: string) => {
    if (!selectedClientId) return;
    if (templateId === 'email-signature') {
      router.push(`/clients/${selectedClientId}/email-signature`);
    } else {
      router.push(`/clients/${selectedClientId}/brand-builder`);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* Header */}
        <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Design Studio</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Select a client and build their assets</p>
        </motion.div>

        {/* Client selector */}
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            style={{
              width: 300, padding: '10px 14px', fontSize: 14,
              background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md,
              color: selectedClientId ? t.text.primary : t.text.tertiary,
              fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = t.border.active}
            onBlur={(e) => e.currentTarget.style.borderColor = t.border.default}
          >
            <option value="">Select a client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company || c.name}</option>
            ))}
          </select>
        </motion.div>

        {/* Client info bar */}
        {selectedClient && (
          <motion.div variants={fadeUp} style={{
            background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md,
            padding: '12px 16px', marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 12,
          }}>
            {selectedClient.logo ? (
              <img src={selectedClient.logo} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.bg.surfaceHover, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: t.text.secondary, flexShrink: 0 }}>
                {(selectedClient.company || selectedClient.name).charAt(0)}
              </div>
            )}
            <span style={{ fontSize: 14, fontWeight: 500, color: t.text.primary }}>{selectedClient.company || selectedClient.name}</span>
            <span style={{ fontSize: 12, color: t.accent.text, cursor: 'pointer' }} onClick={() => router.push(`/clients/${selectedClientId}/brand-kit`)}>Brand Kit →</span>
          </motion.div>
        )}

        {/* Template grid or empty state */}
        {!selectedClientId ? (
          <motion.div variants={fadeUp} style={{ padding: '48px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: t.text.secondary }}>Select a client to start designing</p>
          </motion.div>
        ) : (
          <>
            {/* Print */}
            <motion.div variants={fadeUp} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Print</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {printTemplates.map((tmpl) => (
                  <TemplateCard key={tmpl.id} t={t} id={tmpl.id} label={tmpl.label} desc={tmpl.desc}
                    onClick={() => handleTemplateClick(tmpl.id)} />
                ))}
              </div>
            </motion.div>

            {/* Digital */}
            <motion.div variants={fadeUp}>
              <div style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Digital</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {digitalTemplates.map((tmpl) => (
                  <TemplateCard key={tmpl.id} t={t} id={tmpl.id} label={tmpl.label} desc={tmpl.desc}
                    disabled={(tmpl as any).disabled} onClick={() => handleTemplateClick(tmpl.id)} />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}

function TemplateCard({ t, id, label, desc, onClick, disabled }: {
  t: any; id: string; label: string; desc: string; onClick?: () => void; disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button whileHover={disabled ? {} : { scale: 1.02 }} transition={spring}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered && !disabled ? t.bg.surfaceHover : t.bg.surface,
        border: `1px solid ${hovered && !disabled ? t.border.hover : t.border.default}`,
        borderRadius: t.radius.md, padding: 24, minHeight: 140,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'border-color 150ms, background 150ms',
        width: '100%', textAlign: 'left' as const, fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column' as const, color: t.text.primary,
      }}
    >
      <div style={{ color: hovered && !disabled ? t.accent.text : t.text.secondary, transition: 'color 150ms' }}>
        <TemplateIcon id={id} size={28} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 16 }}>{label}</div>
      <div style={{ fontSize: 13, color: t.text.secondary, marginTop: 2, flex: 1 }}>{desc}</div>
      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: t.radius.sm, background: t.bg.primary, color: t.text.secondary }}>
          {disabled ? 'Coming soon' : 'Not started'}
        </span>
      </div>
    </motion.button>
  );
}
