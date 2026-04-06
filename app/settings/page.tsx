'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useTheme } from '@/lib/theme';
import { PageLayout, Section } from '@/components/shared/PageLayout';
import HelmSpinner from '@/components/shared/HelmSpinner';

const PROFILE_KEY = 'calo-settings-profile';
const AGENCY_KEY = 'calo-agency-settings';
const AVATAR_KEY = 'calo-agency-avatar';

function loadJson<T extends Record<string, string>>(key: string, defaults: T): T {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return defaults; }
}

export default function SettingsPage() {
  return <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 0 }}><HelmSpinner size={32} /></div>}><SettingsContent /></Suspense>;
}

function SettingsContent() {
  const { t } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState({ name: 'Mike Calo', title: 'Founder', email: '' });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [ag, setAg] = useState<Record<string, string>>({});

  useEffect(() => {
    setProfile(loadJson(PROFILE_KEY, { name: 'Mike Calo', title: 'Founder', email: '' }));
    const stored = localStorage.getItem(AVATAR_KEY);
    if (stored && stored.startsWith('data:image/')) setAvatar(stored);
    setAg(loadJson(AGENCY_KEY, {}));
  }, []);

  const updateProfile = (key: string, value: string) => {
    const next = { ...profile, [key]: value };
    setProfile(next);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        // Auto center-crop to 400x400 circle
        const size = 400;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath(); ctx.arc(200, 200, 200, 0, Math.PI * 2); ctx.clip();
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/png');
        localStorage.setItem(AVATAR_KEY, dataUrl);
        window.dispatchEvent(new StorageEvent('storage', { key: AVATAR_KEY, newValue: dataUrl }));
        setAvatar(dataUrl);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeAvatar = () => {
    localStorage.removeItem(AVATAR_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: AVATAR_KEY, newValue: null }));
    setAvatar(null);
  };

  const updateAg = (key: string, value: string) => {
    const next = { ...ag, [key]: value }; setAg(next);
    localStorage.setItem(AGENCY_KEY, JSON.stringify(next));
  };

  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, background: t.bg.primary, border: `1px solid ${t.border.default}`, borderRadius: 8, color: t.text.primary, fontFamily: 'inherit', outline: 'none', transition: 'border-color 150ms' };
  const lbl: React.CSSProperties = { fontSize: 11, color: t.text.secondary, display: 'block', marginBottom: 4 };
  const secHead: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 };
  const divider: React.CSSProperties = { height: 1, background: t.border.default, margin: '16px 0' };

  return (
    <PageLayout title="Settings" subtitle="Manage your agency">
      {/* ═══ PROFILE ═══ */}
      <Section label="Profile">
        <div style={{ background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* Headshot */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div onClick={() => fileRef.current?.click()}
                style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer',
                  border: avatar ? 'none' : `2px dashed ${t.border.default}`,
                  background: avatar ? 'transparent' : t.bg.surfaceHover,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 20, color: t.text.tertiary }}>+</span>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
              {avatar && (
                <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                  <span onClick={() => fileRef.current?.click()} style={{ color: t.accent.text, cursor: 'pointer' }}>Change</span>
                  <span onClick={removeAvatar} style={{ color: t.text.tertiary, cursor: 'pointer' }}>Remove</span>
                </div>
              )}
            </div>
            {/* Fields */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Name</label><input value={profile.name} onChange={(e) => updateProfile('name', e.target.value)} placeholder="Mike Calo" style={input} /></div>
              <div><label style={lbl}>Title</label><input value={profile.title} onChange={(e) => updateProfile('title', e.target.value)} placeholder="Founder" style={input} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Email</label><input type="email" value={profile.email} onChange={(e) => updateProfile('email', e.target.value)} placeholder="mike@calo.co" style={input} /></div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ AGENCY ═══ */}
      <Section label="Agency">
        <div style={{ background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 12, padding: 24 }}>
          <div style={secHead}>Company</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={lbl}>Company Name</label><input value={ag.companyName || ''} onChange={(e) => updateAg('companyName', e.target.value)} placeholder="CALO&CO" style={input} /></div>
            <div><label style={lbl}>Address Line 1</label><input value={ag.address1 || ''} onChange={(e) => updateAg('address1', e.target.value)} placeholder="123 Main St" style={input} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Address Line 2</label><input value={ag.address2 || ''} onChange={(e) => updateAg('address2', e.target.value)} placeholder="Suite 200" style={input} /></div>
            <div><label style={lbl}>City</label><input value={ag.city || ''} onChange={(e) => updateAg('city', e.target.value)} placeholder="Portland" style={input} /></div>
            <div><label style={lbl}>State / ZIP</label><input value={ag.stateZip || ''} onChange={(e) => updateAg('stateZip', e.target.value)} placeholder="ME 04101" style={input} /></div>
          </div>

          <div style={divider} />

          <div style={secHead}>Business Info</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Tagline</label><input value={ag.tagline || ''} onChange={(e) => updateAg('tagline', e.target.value)} placeholder="Your trusted partner" style={input} /></div>
            <div><label style={lbl}>Service Area</label><input value={ag.serviceArea || ''} onChange={(e) => updateAg('serviceArea', e.target.value)} placeholder="Portland Metro" style={input} /></div>
            <div><label style={lbl}>License / Cert #</label><input value={ag.licenseNumber || ''} onChange={(e) => updateAg('licenseNumber', e.target.value)} placeholder="LIC-12345" style={input} /></div>
          </div>

          <div style={divider} />

          <div style={secHead}>Billing & Communication</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Tax Rate (%)</label><input type="number" min="0" max="100" step="0.1" value={ag.taxRate || ''} onChange={(e) => updateAg('taxRate', e.target.value)} placeholder="28" style={input} /></div>
            <div><label style={lbl}>Reply-to Email</label><input type="email" value={ag.replyEmail || ''} onChange={(e) => updateAg('replyEmail', e.target.value)} placeholder="mike@calo.co" style={input} /></div>
          </div>
        </div>
      </Section>
    </PageLayout>
  );
}
