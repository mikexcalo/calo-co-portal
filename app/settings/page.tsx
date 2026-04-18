'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useTheme } from '@/lib/theme';
import { DB, loadAgencySettings, saveAgencySettings } from '@/lib/database';
import Toast from '@/components/shared/Toast';
import { AnimatePresence } from 'framer-motion';
import { PageShell, PageHeader, FormSection, FormRow, FormField, CtaButton } from '@/components/shared/Brand';

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

  const [activeTab, setActiveTab] = useState<'account' | 'business'>('account');
  const [profile, setProfile] = useState({ name: '', title: '', email: '' });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [ag, setAg] = useState<Record<string, string>>({});
  const [paymentMethods, setPaymentMethods] = useState({ venmo: '', paypal: '', zelle: '' });
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
      const lsAg = loadJson(AGENCY_KEY, { companyName: '', address1: '', address2: '', city: '', stateZip: '', tagline: '', serviceArea: '', licenseNumber: '', taxRate: '', replyEmail: '', agencyCode: '' });
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
        agencyCode: lsAg.agencyCode || 'CC',
      });

      // Payment methods from localStorage first, then Supabase
      let pmSource: any[] = [];
      try { const stored = localStorage.getItem('calo-payment-methods'); if (stored) pmSource = JSON.parse(stored); } catch {}
      if (!pmSource.length) pmSource = DB.agencySettings.paymentMethods || [];
      setPaymentMethods({
        venmo: pmSource.find((m: any) => m.type === 'Venmo')?.handle || '',
        paypal: pmSource.find((m: any) => m.type === 'PayPal')?.handle || '',
        zelle: pmSource.find((m: any) => m.type === 'Zelle')?.handle || '',
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
      const pmArray = [
        paymentMethods.venmo && { type: 'Venmo', handle: paymentMethods.venmo },
        paymentMethods.paypal && { type: 'PayPal', handle: paymentMethods.paypal },
        paymentMethods.zelle && { type: 'Zelle', handle: paymentMethods.zelle },
      ].filter(Boolean);
      localStorage.setItem('calo-payment-methods', JSON.stringify(pmArray));
      await saveAgencySettings(
        parseFloat(ag.taxRate) || 28,
        DB.agencySettings.fiscalYearStart || 1,
        pmArray,
        { agencyName: ag.companyName, founderName: profile.name, website: '', city: ag.city }
      );
      setToast({ message: 'Settings saved', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save', type: 'error' });
    } finally { setSaving(false); }
  };

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        subtitle="Manage your agency"
        action={<CtaButton onClick={handleSave}>{saving ? 'Saving...' : 'Save Changes'}</CtaButton>}
      />

      {/* Tab control */}
      <div style={{ display: 'inline-flex', background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 7, padding: 3, gap: 2, marginBottom: 24 }}>
        {(['account', 'business'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '6px 14px', fontSize: 13, fontWeight: activeTab === tab ? 500 : 400,
            color: activeTab === tab ? t.text.primary : t.text.secondary,
            background: activeTab === tab ? t.bg.primary : 'transparent',
            border: 'none', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: activeTab === tab ? '0 1px 2px rgba(0,0,0,0.04)' : 'none', transition: 'all 150ms',
          }}>{tab === 'account' ? 'Account' : 'Business'}</button>
        ))}
      </div>

      {activeTab === 'account' && <>
      {/* ── SECTION 1: YOUR PROFILE ── */}
      <FormSection label="Your Profile">
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {/* Avatar */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer',
                border: `2px dashed ${t.border.default}`, background: t.bg.surfaceHover,
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border.default; }}
            >
              {avatar ? (
                <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text.tertiary} strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
            {avatar && (
              <div style={{ display: 'flex', gap: 8 }}>
                <span onClick={() => fileRef.current?.click()} style={{ fontSize: 11, color: '#2563eb', cursor: 'pointer' }}>Change</span>
                <span onClick={removeAvatar} style={{ fontSize: 11, color: t.text.tertiary, cursor: 'pointer' }}>Remove</span>
              </div>
            )}
          </div>

          {/* Profile fields */}
          <div style={{ flex: 1 }}>
            <FormRow>
              <FormField label="Name" value={profile.name} onChange={(v) => updateProfile('name', v)} placeholder="Mike Calo" />
              <FormField label="Title" value={profile.title} onChange={(v) => updateProfile('title', v)} placeholder="Founder" />
            </FormRow>
            <FormRow>
              <FormField label="Email" value={profile.email} onChange={(v) => updateProfile('email', v)} placeholder="mike@calo.co" type="email" />
            </FormRow>
          </div>
        </div>
      </FormSection>
      </>}

      {activeTab === 'business' && <>
      {/* ── SECTION 2: AGENCY IDENTITY ── */}
      <FormSection label="Agency Identity">
        <FormRow>
          <FormField label="Company Name" value={ag.companyName || ''} onChange={(v) => updateAg('companyName', v)} placeholder="CALO&CO" />
          <FormField label="Tagline" value={ag.tagline || ''} onChange={(v) => updateAg('tagline', v)} placeholder="Your trusted partner" />
        </FormRow>
        <FormRow>
          <FormField label="Agency Code" value={ag.agencyCode || ''} onChange={(v) => updateAg('agencyCode', v.toUpperCase().slice(0, 4))} placeholder="CC" />
          <div />
        </FormRow>
        <FormRow>
          <FormField label="Service Area" value={ag.serviceArea || ''} onChange={(v) => updateAg('serviceArea', v)} placeholder="Portland Metro" />
          <FormField label="License / Cert #" value={ag.licenseNumber || ''} onChange={(v) => updateAg('licenseNumber', v)} placeholder="LIC-12345" />
        </FormRow>
      </FormSection>

      {/* ── SECTION 3: ADDRESS ── */}
      <FormSection label="Mailing Address">
        <FormRow>
          <FormField label="Address Line 1" value={ag.address1 || ''} onChange={(v) => updateAg('address1', v)} placeholder="123 Main St" />
          <FormField label="Address Line 2" value={ag.address2 || ''} onChange={(v) => updateAg('address2', v)} placeholder="Suite 200" />
        </FormRow>
        <FormRow>
          <FormField label="City" value={ag.city || ''} onChange={(v) => updateAg('city', v)} placeholder="Portland, Maine" />
          <FormField label="State / ZIP" value={ag.stateZip || ''} onChange={(v) => updateAg('stateZip', v)} placeholder="ME 04101" />
        </FormRow>
      </FormSection>

      {/* ── SECTION 4: BILLING & INVOICING ── */}
      <FormSection label="Billing & Invoicing">
        <FormRow>
          <FormField label="Default Tax Rate (%)" value={ag.taxRate || ''} onChange={(v) => updateAg('taxRate', v)} placeholder="28" type="number" />
          <FormField label="Reply-to Email" value={ag.replyEmail || ''} onChange={(v) => updateAg('replyEmail', v)} placeholder="mike@calo.co" type="email" />
        </FormRow>
      </FormSection>

      {/* ── SECTION 5: PAYMENT METHODS ── */}
      <FormSection label="Payment Methods">
        <FormRow>
          <FormField label="Venmo" value={paymentMethods.venmo} onChange={(v) => setPaymentMethods({ ...paymentMethods, venmo: v })} placeholder="@mike-calo" />
          <FormField label="PayPal" value={paymentMethods.paypal} onChange={(v) => setPaymentMethods({ ...paymentMethods, paypal: v })} placeholder="@mikexcalo" />
        </FormRow>
        <FormRow>
          <FormField label="Zelle" value={paymentMethods.zelle} onChange={(v) => setPaymentMethods({ ...paymentMethods, zelle: v })} placeholder="mike@calo.co" />
        </FormRow>
      </FormSection>
      </>}

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      </AnimatePresence>
    </PageShell>
  );
}
