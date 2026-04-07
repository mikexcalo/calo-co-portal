'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useTheme } from '@/lib/theme';
import { DB, loadAgencySettings, saveAgencySettings } from '@/lib/database';
import { PageLayout, Section } from '@/components/shared/PageLayout';
import HelmSpinner from '@/components/shared/HelmSpinner';
import Toast from '@/components/shared/Toast';
import { AnimatePresence } from 'framer-motion';

const PROFILE_KEY = 'calo-settings-profile';
const AGENCY_KEY = 'calo-agency-settings';
const AVATAR_KEY = 'calo-agency-avatar';

function loadJson<T extends Record<string, string>>(key: string, defaults: T): T {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return defaults; }
}

export default function SettingsPage() {
  return <Suspense fallback={null}><SettingsContent /></Suspense>;
}

function SettingsContent() {
  const { t } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState({ name: '', title: '', email: '' });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [ag, setAg] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const init = async () => {
      // Load agency data from Supabase via DB cache
      await loadAgencySettings().catch(() => {});

      // Profile: localStorage first, then DB.agency as fallback
      const lsProfile = loadJson(PROFILE_KEY, { name: '', title: '', email: '' });
      setProfile({
        name: lsProfile.name || DB.agency.founder || 'Mike Calo',
        title: lsProfile.title || 'Founder',
        email: lsProfile.email || '',
      });

      // Agency: localStorage first, merge with DB values
      const lsAg = loadJson(AGENCY_KEY, { companyName: '', address1: '', address2: '', city: '', stateZip: '', tagline: '', serviceArea: '', licenseNumber: '', taxRate: '', replyEmail: '' });
      setAg({
        companyName: lsAg.companyName || DB.agency.name || 'Manifest',
        address1: lsAg.address1 || '',
        address2: lsAg.address2 || '',
        city: lsAg.city || DB.agency.location || '',
        stateZip: lsAg.stateZip || '',
        tagline: lsAg.tagline || '',
        serviceArea: lsAg.serviceArea || '',
        licenseNumber: lsAg.licenseNumber || '',
        taxRate: lsAg.taxRate || String(DB.agencySettings.taxRate || ''),
        replyEmail: lsAg.replyEmail || '',
      });

      // Avatar from localStorage
      const stored = localStorage.getItem(AVATAR_KEY);
      if (stored && stored.startsWith('data:image/')) setAvatar(stored);

      // Also check Supabase headshot
      if (!stored) {
        try {
          const supabase = (await import('@/lib/supabase')).default;
          const { data } = await supabase.from('clients').select('brand_builder_fields').limit(1).single();
          const avatarUrl = (data?.brand_builder_fields as any)?.avatarUrl;
          if (avatarUrl && avatarUrl.startsWith('http')) setAvatar(avatarUrl);
        } catch { /* no headshot found */ }
      }
    };
    init();
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

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save profile to localStorage
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      // Save agency to localStorage + Supabase
      localStorage.setItem(AGENCY_KEY, JSON.stringify(ag));
      await saveAgencySettings(
        parseFloat(ag.taxRate) || 28,
        DB.agencySettings.fiscalYearStart || 1,
        DB.agencySettings.paymentMethods || [],
        { agencyName: ag.companyName, founderName: profile.name, website: '', city: ag.city }
      );
      setToast({ message: 'Settings saved', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save', type: 'error' });
    } finally { setSaving(false); }
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
            <div><label style={lbl}>Company Name</label><input value={ag.companyName || ''} onChange={(e) => updateAg('companyName', e.target.value)} placeholder="Manifest" style={input} /></div>
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

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={handleSave} disabled={saving} style={{
          background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
          padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          opacity: saving ? 0.7 : 1,
        }}>{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      </AnimatePresence>
    </PageLayout>
  );
}
