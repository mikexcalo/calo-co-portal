'use client';

import { useRouter } from 'next/navigation';
import { Client, Invoice, ClientStats } from '@/lib/types';
import { currency, invTotal } from '@/lib/utils';
import { DB } from '@/lib/database';

interface ModulesGridProps {
  client: Client;
  clientId: string;
  invoices: Invoice[];
  isClient: boolean;
  stats: ClientStats;
}

export default function ModulesGrid({
  client,
  clientId,
  invoices,
  isClient,
  stats,
}: ModulesGridProps) {
  const router = useRouter();

  // Build Brand Kit metadata — count distinct logo slots that have at least one file
  const logoSlots = client.brandKit?.logos || {};
  const logoCount = (['color', 'light', 'dark', 'icon', 'secondary', 'favicon'] as const).filter(
    (slot) => (logoSlots[slot] || []).length > 0
  ).length;
  const bkColors = client.brandKit?.colors?.length || 0;
  const hasBkFonts = !!(
    client.brandKit?.fonts?.heading ||
    client.brandKit?.fonts?.body ||
    client.brandKit?.fonts?.accent
  );

  let bkBits: string[] = [];
  if (logoCount > 0) bkBits.push(`${logoCount} logo slot${logoCount !== 1 ? 's' : ''}`);
  if (bkColors > 0) bkBits.push(`${bkColors} color${bkColors !== 1 ? 's' : ''}`);
  if (hasBkFonts) bkBits.push('Fonts');

  const bkMeta = bkBits.length > 0 ? bkBits.join(' · ') : 'Not started';

  // Email Signature metadata
  const sigFields = client.signatureFields || {};
  const sigHasData = !!client.emailSignatureHtml || !!sigFields.name || !!sigFields.email || !!sigFields.company;
  const sigMeta = sigHasData
    ? (sigFields.name ? `${sigFields.name}` : 'Signature configured')
    : 'Not started';

  // Financials metadata (agency only)
  const finScopeRev = invoices
    .filter((i) => !i.isReimbursement)
    .reduce((s, i) => s + invTotal(i), 0);
  const finScopeExp = (DB.expenses || [])
    .filter((e) => e.clientId === clientId)
    .reduce((s, e) => s + e.amount, 0);
  const finScopeMeta =
    finScopeRev > 0
      ? `${currency(finScopeRev)} revenue · ${currency(finScopeExp)} expenses`
      : 'Revenue · Expenses · P&L';

  // Invoice metadata
  const invCount = invoices.length;
  const invMeta =
    invCount === 0
      ? 'No invoices yet'
      : `${invCount} invoice${invCount !== 1 ? 's' : ''} · ${currency(stats.outstanding)} outstanding`;

  const hasBkAccess = client.activeModules.includes('brand_kit');
  const hasSigAccess = client.activeModules.includes('email_signature');

  const lockSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

  return (
    <div className="module-grid">
      {/* Invoices - always shown */}
      <button
        className="module-card"
        onClick={() => router.push(`/clients/${clientId}/invoices`)}
      >
        <div className="mc-icon">📋</div>
        <div className="mc-name">Invoices</div>
        <div className="mc-meta">{invMeta}</div>
      </button>

      {/* Financials - agency only */}
      {!isClient && (
        <button
          className="module-card"
          onClick={() => router.push(`/clients/${clientId}/financials`)}
        >
          <div className="mc-icon">💲</div>
          <div className="mc-name">Financials</div>
          <div className="mc-meta">{finScopeMeta}</div>
        </button>
      )}

      {/* Brand Kit - conditional access */}
      {!isClient ? (
        <button
          className="module-card"
          onClick={() => router.push(`/clients/${clientId}/brand-kit`)}
        >
          <div className="mc-icon">🍎</div>
          <div className="mc-name">Brand Kit</div>
          <div className="mc-meta">{bkMeta}</div>
        </button>
      ) : hasBkAccess ? (
        <button
          className="module-card"
          onClick={() => router.push(`/clients/${clientId}/brand-kit`)}
        >
          <div className="mc-icon">🍎</div>
          <div className="mc-name">Brand Kit</div>
          <div className="mc-meta">{bkMeta}</div>
        </button>
      ) : (
        <div
          className="module-card-locked-wrap"
          onClick={() => alert('Interested in Brand Kit?\nContact CALO&CO to add this to your package.')}
        >
          <div className="module-card module-card-locked-inner" style={{ minHeight: 120 }}>
            <div className="mc-icon">🍎</div>
            <div className="mc-name">Brand Kit</div>
            <div className="mc-meta">Logos · Colors · Fonts · Brand Guide</div>
          </div>
          <div className="module-lock-overlay">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <div className="module-lock-label">Add-On</div>
            <div className="module-lock-cta">Unlock Brand Kit →</div>
          </div>
        </div>
      )}

      {/* Email Signature - conditional access */}
      {!isClient ? (
        <button
          className="module-card"
          onClick={() => router.push(`/clients/${clientId}/email-signature`)}
        >
          <div className="mc-icon">✉️</div>
          <div className="mc-name">Email Signature</div>
          <div className="mc-meta">{sigMeta}</div>
        </button>
      ) : hasSigAccess ? (
        <button
          className="module-card"
          onClick={() => router.push(`/clients/${clientId}/email-signature`)}
        >
          <div className="mc-icon">✉️</div>
          <div className="mc-name">Email Signature</div>
          <div className="mc-meta">{sigMeta}</div>
        </button>
      ) : (
        <div
          className="module-card-locked-wrap"
          onClick={() => alert('Interested in Email Signature?\nContact CALO&CO to add this to your package.')}
        >
          <div className="module-card module-card-locked-inner" style={{ minHeight: 120 }}>
            <div className="mc-icon">✉️</div>
            <div className="mc-name">Email Signature</div>
            <div className="mc-meta">Branded · Copy-paste HTML</div>
          </div>
          <div className="module-lock-overlay">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <div className="module-lock-label">Add-On</div>
            <div className="module-lock-cta">Unlock Email Signature →</div>
          </div>
        </div>
      )}

      {/* Brand Builder - agency only */}
      {!isClient && (
        <button
          className="module-card"
          onClick={() => router.push(`/clients/${clientId}/brand-builder`)}
        >
          <div className="mc-icon">🎨</div>
          <div className="mc-name">Brand Builder</div>
          <div className="mc-meta">Get started</div>
        </button>
      )}

      {/* Locked modules (future content) */}
      <div
        className="module-card-locked-wrap"
        onClick={() => alert('Want access to Content Suite?\nAsk us about adding this to your package.')}
      >
        <div className="module-card module-card-locked-inner" style={{ minHeight: 120 }}>
          <div className="mc-icon">📸</div>
          <div className="mc-name">Content Suite</div>
          <div className="mc-meta">Social media · Photo library · Scheduling</div>
        </div>
        <div className="module-lock-overlay">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div className="module-lock-label">Add-On</div>
          <div className="module-lock-cta">Unlock this module →</div>
        </div>
      </div>
    </div>
  );
}
