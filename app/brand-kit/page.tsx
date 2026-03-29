'use client';

import { useRouter } from 'next/navigation';

export default function AgencyBrandKitPage() {
  const router = useRouter();

  return (
    <div className="page">
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px', color: '#0f172a' }}>
        Agency Brand Kit
      </h1>
      <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '32px' }}>
        CALO&CO brand assets and guidelines
      </p>

      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '48px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎨</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
          Agency Brand Kit — coming soon
        </div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          Your agency logos, colors, fonts, and brand guidelines will live here.
        </div>
      </div>
    </div>
  );
}
