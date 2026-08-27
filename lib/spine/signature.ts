/**
 * Email signature generation.
 *
 * Email clients are stuck in about 2003. Flexbox, grid, and external CSS are
 * unreliable; nested tables with inline styles are not. Everything here is
 * deliberately old-fashioned HTML because that is what actually renders in
 * Outlook.
 *
 * The install steps differ per client, which is the whole reason this exists
 * as a guided thing rather than a single "copy HTML" button.
 */

export interface SignatureFields {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  logoUrl: string;
  accent: string;
  tagline: string;
}

export const EMPTY_SIGNATURE: SignatureFields = {
  name: '',
  title: '',
  company: '',
  email: '',
  phone: '',
  website: '',
  logoUrl: '',
  accent: '#2563eb',
  tagline: '',
};

export type SignatureStyle = 'stacked' | 'sidebar' | 'minimal';

export const SIGNATURE_STYLES: Array<{ id: SignatureStyle; name: string; note: string }> = [
  { id: 'stacked', name: 'Stacked', note: 'Logo above the details. Safest everywhere.' },
  { id: 'sidebar', name: 'Sidebar', note: 'Logo left, details right, divider between.' },
  { id: 'minimal', name: 'Minimal', note: 'Text only. Never breaks, never blocked.' },
];

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const href = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

/**
 * Inline styles only, tables for layout, no shorthand that Outlook mangles.
 */
export function renderSignature(f: SignatureFields, style: SignatureStyle): string {
  const font =
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const accent = esc(f.accent || '#2563eb');

  const name = f.name
    ? `<div style="${font};font-size:15px;font-weight:600;color:#111111;line-height:1.3;">${esc(f.name)}</div>`
    : '';
  const title =
    f.title || f.company
      ? `<div style="${font};font-size:13px;color:#555555;line-height:1.45;padding-top:2px;">${[
          f.title && esc(f.title),
          f.company && esc(f.company),
        ]
          .filter(Boolean)
          .join(' · ')}</div>`
      : '';

  const contact: string[] = [];
  if (f.phone)
    contact.push(
      `<a href="tel:${esc(f.phone.replace(/[^\d+]/g, ''))}" style="color:#555555;text-decoration:none;">${esc(f.phone)}</a>`
    );
  if (f.email)
    contact.push(
      `<a href="mailto:${esc(f.email)}" style="color:#555555;text-decoration:none;">${esc(f.email)}</a>`
    );
  if (f.website)
    contact.push(
      `<a href="${esc(href(f.website))}" style="color:${accent};text-decoration:none;">${esc(
        f.website.replace(/^https?:\/\//i, '')
      )}</a>`
    );

  const contactRow = contact.length
    ? `<div style="${font};font-size:12.5px;color:#555555;line-height:1.6;padding-top:6px;">${contact.join(
        '<span style="color:#cccccc;"> &nbsp;|&nbsp; </span>'
      )}</div>`
    : '';

  const tagline = f.tagline
    ? `<div style="${font};font-size:11.5px;color:#888888;line-height:1.45;padding-top:8px;font-style:italic;">${esc(
        f.tagline
      )}</div>`
    : '';

  const logo = f.logoUrl
    ? `<img src="${esc(href(f.logoUrl))}" alt="${esc(f.company || 'Logo')}" width="120" style="display:block;border:0;outline:none;max-width:120px;height:auto;" />`
    : '';

  if (style === 'minimal') {
    return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="padding:0;">
${name}${title}${contactRow}${tagline}
</td></tr></table>`;
  }

  if (style === 'sidebar') {
    return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>
${logo ? `<td valign="top" style="padding:0 16px 0 0;">${logo}</td>
<td valign="top" style="padding:0 16px 0 0;border-left:2px solid ${accent};">&nbsp;</td>` : ''}
<td valign="top" style="padding:0;">
${name}${title}${contactRow}${tagline}
</td></tr></table>`;
  }

  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="padding:0;">
${logo ? `<div style="padding-bottom:10px;">${logo}</div>` : ''}
<div style="border-top:2px solid ${accent};width:44px;padding-bottom:10px;font-size:0;line-height:0;">&nbsp;</div>
${name}${title}${contactRow}${tagline}
</td></tr></table>`;
}

// ---------------------------------------------------------------------------
// Install instructions, per client
// ---------------------------------------------------------------------------

export interface InstallGuide {
  id: string;
  name: string;
  /** How the HTML gets in: paste rendered, or paste source. */
  method: 'rendered' | 'source';
  steps: string[];
  gotcha?: string;
}

export const INSTALL_GUIDES: InstallGuide[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    method: 'rendered',
    steps: [
      'Click "Copy signature" above — that copies the rendered version, not the code.',
      'In Gmail, open Settings (the gear icon) → See all settings.',
      'Scroll down the General tab to "Signature" and click Create new.',
      'Give it a name, then click into the big editing box.',
      'Paste with Cmd+V (Mac) or Ctrl+V (Windows).',
      'Under "Signature defaults", pick it for new emails and replies.',
      'Scroll to the bottom and click Save Changes. Gmail does not autosave.',
    ],
    gotcha:
      'If the logo does not appear, the image URL must be publicly reachable — Gmail will not load a file from your computer.',
  },
  {
    id: 'outlook-web',
    name: 'Outlook (web)',
    method: 'rendered',
    steps: [
      'Click "Copy signature" above.',
      'Open Settings (gear, top right) → Mail → Compose and reply.',
      'Under "Email signature", click into the editing box.',
      'Paste with Cmd+V or Ctrl+V.',
      'Tick both boxes to add it to new messages and replies.',
      'Click Save.',
    ],
    gotcha:
      'Outlook strips some spacing. If it looks cramped, use the Minimal style — it survives Outlook better than anything with a logo.',
  },
  {
    id: 'outlook-desktop',
    name: 'Outlook (desktop)',
    method: 'rendered',
    steps: [
      'Click "Copy signature" above.',
      'In Outlook, go to File → Options → Mail → Signatures.',
      'Click New, name it, and click OK.',
      'Click into the "Edit signature" box and paste.',
      'Set it as the default for New messages and Replies/forwards.',
      'Click OK to close, then OK again.',
    ],
    gotcha:
      'Outlook for Windows renders email with Microsoft Word, which is why layouts break there and nowhere else. Test before rolling it out to a team.',
  },
  {
    id: 'apple-mail',
    name: 'Apple Mail',
    method: 'rendered',
    steps: [
      'Click "Copy signature" above.',
      'Open Mail → Settings (or Preferences) → Signatures.',
      'Pick the account on the left, then click + to add one.',
      'Untick "Always match my default message font" — this matters, it strips your formatting otherwise.',
      'Select any placeholder text in the box and paste over it.',
      'Choose the signature from the "Choose Signature" dropdown for that account.',
    ],
    gotcha:
      'The "match my default message font" checkbox is the single most common reason a pasted signature loses its styling in Apple Mail.',
  },
  {
    id: 'iphone',
    name: 'iPhone / iPad',
    method: 'rendered',
    steps: [
      'Email the finished signature to yourself from a desktop first.',
      'Open that email on the phone and select the whole signature by touch and hold → Select All.',
      'Copy it.',
      'Go to Settings → Apps → Mail → Signature.',
      'Clear what is there, paste, then shake the phone and choose Undo — this converts it back to rich text.',
    ],
    gotcha:
      'iOS strips formatting on paste unless you use the shake-to-undo trick. It looks absurd; it works.',
  },
  {
    id: 'html',
    name: 'Raw HTML',
    method: 'source',
    steps: [
      'Click "Copy HTML" above to get the source.',
      'Paste into whatever accepts raw HTML — a CRM, a helpdesk, a mail client with an HTML source view.',
      'Everything is inline-styled with table layout, so it survives clients that strip stylesheets.',
    ],
  },
];
