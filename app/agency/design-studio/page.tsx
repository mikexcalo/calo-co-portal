'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageLayout, Section, CardGrid, InfoBar } from '@/components/shared/PageLayout';
import ConfirmModal from '@/components/shared/ConfirmModal';

const templateDescs: Record<string, string> = {
  'business-card': '3.5 × 2 in', 'yard-sign': '5 sizes',
  'vehicle-magnet': '24 × 12 in', 't-shirt': 'Front + Back',
  'door-hanger': '4.25 × 11 in', 'flyer': '8.5 × 11 in',
};

const templates = [
  { id: 'business-card', label: 'Business Cards' },
  { id: 'yard-sign', label: 'Yard Signs' },
  { id: 'vehicle-magnet', label: 'Vehicle Magnets' },
  { id: 't-shirt', label: 'T-Shirts' },
  { id: 'door-hanger', label: 'Door Hangers' },
  { id: 'flyer', label: 'Flyers' },
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

function FlatCard({ id, label, desc, onClick, disabled }: {
  id: string; label: string; desc: string; onClick?: () => void; disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff', border: `0.5px solid ${hovered && !disabled ? '#2563eb' : '#e5e7eb'}`,
        borderRadius: 12, padding: 24, minHeight: 140,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'border-color 150ms, transform 150ms, box-shadow 150ms',
        transform: hovered && !disabled ? 'translateY(-2px)' : 'none',
        boxShadow: hovered && !disabled ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
        width: '100%', textAlign: 'left' as const, fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column' as const,
      }}
    >
      <div style={{ color: hovered && !disabled ? '#2563eb' : '#6b7280', transition: 'color 150ms' }}>
        <TemplateIcon id={id} size={28} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginTop: 16 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2, flex: 1 }}>{desc}</div>
      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#f9fafb', color: '#9ca3af' }}>
          {disabled ? 'Coming soon' : 'Not started'}
        </span>
      </div>
    </button>
  );
}

export default function AgencyDesignStudioPage() {
  const router = useRouter();
  const [showAlert, setShowAlert] = useState(false);

  const handleTemplateClick = () => {
    setShowAlert(true);
  };

  return (
    <PageLayout title="Agency Design Studio" subtitle="Create print and digital assets for CALO&CO">
      <InfoBar>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: '#2563eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>C</div>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>CALO&CO</span>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>·</span>
        <span style={{ fontSize: 12, color: '#2563eb', cursor: 'pointer' }} onClick={() => router.push('/agency/brand-kit')}>
          Brand Kit →
        </span>
      </InfoBar>

      <Section label="Print">
        <CardGrid>
          {templates.map((t) => (
            <FlatCard key={t.id} id={t.id} label={t.label} desc={templateDescs[t.id]} onClick={handleTemplateClick} />
          ))}
        </CardGrid>
      </Section>

      <Section label="Digital">
        <CardGrid>
          <FlatCard id="email-signature" label="Email Signature" desc="Gmail, Outlook, more" onClick={handleTemplateClick} />
          <FlatCard id="social-images" label="Social Images" desc="Coming soon" disabled />
          <FlatCard id="web-banners" label="Web Banners" desc="Coming soon" disabled />
        </CardGrid>
      </Section>

      <ConfirmModal
        isOpen={showAlert}
        title="Agency Templates"
        message="Agency templates use CALO&CO brand data. This feature is coming soon."
        alertOnly
        onConfirm={() => setShowAlert(false)}
        onCancel={() => setShowAlert(false)}
      />
    </PageLayout>
  );
}
