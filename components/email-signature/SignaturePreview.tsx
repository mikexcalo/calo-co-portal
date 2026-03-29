'use client';

import { useState } from 'react';
import { Client, Contact, BrandKit, SignatureFields } from '@/lib/types';
import InstallGuide from './InstallGuide';
import styles from './SignaturePreview.module.css';

interface SignaturePreviewProps {
  client: Client;
  contacts: Contact[];
  brandKit: BrandKit;
  signatureFields: SignatureFields;
  emailSignatureHtml: string;
}

export default function SignaturePreview({
  client,
  contacts,
  brandKit,
  signatureFields,
  emailSignatureHtml,
}: SignaturePreviewProps) {
  const [layout, setLayout] = useState<'horizontal' | 'stacked'>(
    (signatureFields?.layout as 'horizontal' | 'stacked') || 'horizontal'
  );
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('gmail');

  const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

  // Build signature HTML
  function buildSignatureHtml(): string {
    const fields = {
      name: signatureFields?.name || primaryContact?.name || client.name || '',
      title: signatureFields?.title || primaryContact?.title || primaryContact?.role || '',
      company: signatureFields?.company || client.company || client.name || '',
      email: signatureFields?.email || primaryContact?.email || client.email || '',
      website: signatureFields?.website || client.website || '',
      brandColor: signatureFields?.brandColor || '#333333',
    };

    const visible = signatureFields?.visible || {
      name: true,
      title: true,
      company: true,
      email: true,
      website: false,
      logo: true,
    };

    // Fall back to brand kit primary logo if signatureFields doesn't have a logoSrc
    let logoSrc = (signatureFields?.logoSrc as string) || '';
    if (!logoSrc && brandKit?.logos) {
      const slots = ['color', 'light', 'dark', 'icon', 'secondary', 'favicon'] as const;
      for (const slot of slots) {
        const logos = brandKit.logos[slot] || [];
        const primary = logos.find((f) => f.isPrimary);
        if (primary?.data) { logoSrc = primary.data; break; }
        if (logos.length > 0 && logos[0]?.data) { logoSrc = logos[0].data; break; }
      }
    }
    const isStacked = layout === 'stacked';

    const showLogo = visible.logo !== false;
    const showName = visible.name !== false;
    const showTitle = visible.title !== false;
    const showCompany = visible.company !== false;
    const showEmail = visible.email !== false;
    const showWebsite = visible.website !== false;

    const brandColor = fields.brandColor || '#333333';
    const textColor = '#333333';
    const websiteHref = fields.website
      ? fields.website.startsWith('http')
        ? fields.website
        : 'https://' + fields.website
      : '';

    const altTxt = (fields.company || '').replace(/"/g, '&quot;');

    // Build name + title section
    let nameHtml = '';
    let titleHtml = '';

    if (showName && fields.name && showTitle && fields.title) {
      nameHtml = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;margin:0 0 2px 0;"><span style="font-weight:bold;color:${brandColor};">${fields.name}</span><span style="color:${textColor};">, ${fields.title}</span></div>`;
    } else {
      if (showName && fields.name)
        nameHtml = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${brandColor};margin:0 0 2px 0;">${fields.name}</div>`;
      if (showTitle && fields.title)
        titleHtml = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${textColor};margin:0 0 1px 0;">${fields.title}</div>`;
    }

    const companyHtml =
      showCompany && fields.company
        ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${textColor};margin:0 0 1px 0;">${fields.company}</div>`
        : '';

    const emailHtml =
      showEmail && fields.email
        ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;margin:0 0 1px 0;"><a href="mailto:${fields.email}" style="color:${textColor};text-decoration:none;">${fields.email}</a></div>`
        : '';

    const websiteHtml =
      showWebsite && fields.website
        ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;margin:0;"><a href="${websiteHref}" style="color:${textColor};text-decoration:none;">${fields.website}</a></div>`
        : '';

    const content = nameHtml + titleHtml + companyHtml + emailHtml + websiteHtml;

    if (isStacked) {
      const logoRow = showLogo && logoSrc
        ? `<tr><td style="padding:0 0 10px 0;text-align:center;"><img src="${logoSrc}" width="auto" height="60" style="max-height:60px;max-width:200px;display:inline-block;" alt="${altTxt}"></td></tr>`
        : '';
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;border-collapse:collapse;text-align:center;"><tbody>${logoRow}<tr><td style="padding:0;text-align:center;">${content}</td></tr></tbody></table>`;
    }

    const logoCell =
      showLogo && logoSrc
        ? `<td style="padding:0 16px 0 0;vertical-align:middle;"><img src="${logoSrc}" width="auto" height="48" style="max-height:48px;max-width:120px;display:block;" alt="${altTxt}"></td>`
        : '';

    const dividerCell =
      showLogo && logoSrc
        ? `<td style="padding:0 16px 0 0;vertical-align:middle;border-left:1px solid ${brandColor};width:1px;height:40px;">&nbsp;</td>`
        : '';

    return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;border-collapse:collapse;"><tbody><tr>${logoCell}${dividerCell}<td style="padding:0;vertical-align:middle;">${content}</td></tr></tbody></table>`;
  }

  const html = buildSignatureHtml();

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = html;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  function downloadAsHtml() {
    const company = (signatureFields?.company || 'signature')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${company}-signature.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.esigPreviewCard}>
      {/* Header with Layout Toggle */}
      <div className={styles.previewHeader}>
        <div className={styles.previewTitle}>Live Preview</div>
        <div className={styles.layoutToggle}>
          <button
            onClick={() => setLayout('horizontal')}
            className={`${styles.layoutBtn} ${layout === 'horizontal' ? styles.active : ''}`}
          >
            Horizontal
          </button>
          <span className={styles.layoutSep}> · </span>
          <button
            onClick={() => setLayout('stacked')}
            className={`${styles.layoutBtn} ${layout === 'stacked' ? styles.active : ''}`}
          >
            Stacked
          </button>
        </div>
      </div>

      {/* Preview Box */}
      <div
        className={styles.previewBox}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Action Buttons */}
      <div className={styles.actions}>
        <button
          onClick={copyToClipboard}
          className={styles.btnPrimary}
          title="Copy HTML signature to clipboard"
        >
          Copy HTML
        </button>
        <button
          onClick={downloadAsHtml}
          className={styles.btnGhost}
          title="Download HTML file"
        >
          Download HTML
        </button>
        {copied && <span className={styles.copyConfirm}>✓ Copied to clipboard</span>}
      </div>

      {/* Installation Guide */}
      <InstallGuide activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
