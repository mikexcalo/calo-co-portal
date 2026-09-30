/**
 * The email signature, as markup a mail client will actually honour.
 *
 * WHY A TABLE AND NOT A DIV
 *
 * Outlook on Windows renders through Word's HTML engine, which has no flexbox
 * and no reliable float. Tables are the only layout primitive every client
 * from Word to the Gmail app agrees on, and they have been for twenty years.
 * This is not nostalgia; it is the difference between a signature that holds
 * its shape and one that stacks into a column in the one client your client's
 * customers use most.
 *
 * WHY EVERY STYLE IS INLINE
 *
 * Gmail strips <style> blocks from the body of a message. Anything that has
 * to survive being pasted into a compose window has to be on the element.
 * The one <style> here carries the narrow-screen step down, which Gmail
 * discards and Apple Mail keeps; the base size is chosen so that losing it
 * costs nothing on a 360px screen.
 */

export interface SignatureInput {
  /** The business, and the person sending. */
  business: string;
  person: string;
  /** Permanent URL of the stacked lockup PNG, already sized for 2x. */
  logoUrl: string | null;
  /** How wide the logo is DRAWN. The file behind it is twice this. */
  logoWidth: number;
  /** The brand's dark color, used for the name. */
  dark: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  /** Ticked on by the person, all off by default. */
  showTitle: boolean;
  title: string;
  showCompany: boolean;
  showEmail: boolean;
}

export const SIGNATURE_DEFAULTS = {
  logoWidth: 96,
  title: 'Founder',
} as const;

/** Digits only, for a tel: link that dials on every phone. */
export function telDigits(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (!d) return '';
  return d.length === 10 ? `+1${d}` : `+${d.replace(/^\+/, '')}`;
}

/** 8459012195 reads as a number; 845-901-2195 reads as a phone number. */
export function prettyPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return ten.length === 10
    ? `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`
    : phone.trim();
}

/** globalseafood.partners, however it was typed in. */
export function bareHost(site: string): string {
  return site.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";
const GREY = '#6B7280';
const RULE = '#DDDDDD';

/**
 * The block, in the order a reader expects: who, what they do, how to reach
 * them. Name, then title and company, then phone, then email, then website,
 * always, whichever options are on.
 */
export function renderSignatureBlock(f: SignatureInput): string {
  const line = (html: string) =>
    `<tr><td style="padding:0;font-family:${FONT};font-size:13px;line-height:1.3;color:${GREY};white-space:nowrap;" class="sig-l">${html}</td></tr>`;

  const rows: string[] = [];

  rows.push(
    `<tr><td style="padding:0 0 1px;font-family:${FONT};font-size:14px;line-height:1.3;font-weight:bold;color:${esc(f.dark)};white-space:nowrap;" class="sig-n">${esc(f.person)}</td></tr>`
  );

  /*
    Title and company share a line when both are on, because "Founder" over
    "Global Seafood Partners" is two lines saying one thing, and this block
    has to stay about as tall as the logo beside it.
  */
  const title = f.showTitle ? f.title.trim() : '';
  const company = f.showCompany ? f.business.trim() : '';
  const role = [title, company].filter(Boolean).join(', ');
  if (role) rows.push(line(esc(role)));

  if (f.phone) {
    const shown = prettyPhone(f.phone);
    const dial = telDigits(f.phone);
    rows.push(line(`<a href="tel:${esc(dial)}" style="color:${GREY};text-decoration:none;">${esc(shown)}</a>`));
  }

  if (f.showEmail && f.email) {
    rows.push(line(`<a href="mailto:${esc(f.email)}" style="color:${GREY};text-decoration:none;">${esc(f.email)}</a>`));
  }

  if (f.website) {
    const host = bareHost(f.website);
    rows.push(line(`<a href="https://${esc(host)}" style="color:${esc(f.dark)};text-decoration:none;font-weight:bold;">${esc(host)}</a>`));
  }

  const logoCell = f.logoUrl
    ? `<td style="padding:0 14px 0 0;vertical-align:middle;">` +
      `<img src="${esc(f.logoUrl)}" width="${f.logoWidth}" alt="${esc(f.business)}" ` +
      `style="display:block;width:${f.logoWidth}px;max-width:${f.logoWidth}px;height:auto;border:0;" class="sig-logo"></td>`
    : '';

  const dividerCell = f.logoUrl
    ? `<td style="padding:0;width:1px;background:${RULE};font-size:0;line-height:0;">&nbsp;</td>`
    : '';

  return [
    /* Gmail drops this; Apple Mail keeps it. The base size already fits 360,
       so losing it costs nothing and having it buys a little more room. */
    `<style>@media only screen and (max-width:380px){.sig-n{font-size:13px !important}.sig-l{font-size:12px !important}.sig-logo{width:82px !important;max-width:82px !important}}</style>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">`,
    `<tr>`,
    logoCell,
    dividerCell,
    `<td style="padding:0 0 0 14px;vertical-align:middle;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">`,
    rows.join(''),
    `</table>`,
    `</td>`,
    `</tr>`,
    `</table>`,
  ].join('');
}

/** What to do with it once it is on the clipboard. */
export const GMAIL_STEPS = [
  'In Gmail, open Settings, then See all settings.',
  'Scroll down the General tab to Signature and press Create new.',
  'Click into the box and paste. Keep the formatting; do not paste as plain text.',
  'Under Signature defaults, pick it for new emails and for replies.',
  'Save Changes at the bottom of the page.',
];
