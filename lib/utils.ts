/**
 * Utility helper functions for CALO&CO Portal
 */

import { Invoice, InvoiceItem, Client, ClientStats, AgencyStats } from './types';

/**
 * Format a client's structured address into a display string
 */
export function formatClientAddress(client: Client): string {
  const cityStateZip = [
    client.city,
    client.state && client.postal_code
      ? `${client.state} ${client.postal_code}`
      : client.state || client.postal_code,
  ].filter(Boolean).join(', ');
  return [client.address_line_1, client.address_line_2, cityStateZip]
    .filter(Boolean).join('\n');
}

/**
 * Extract hex color from various color formats
 */
export function extractHex(color: any): string | null {
  if (!color) return null;
  if (typeof color === 'string') return color;
  if (typeof color === 'object') {
    return color.hex || color.value || color.color || null;
  }
  return null;
}

/**
 * Format number as currency string
 */
export function currency(n: number): string {
  return '$' + Math.abs(n).toFixed(2);
}

/**
 * Parse amount from string, removing non-numeric characters
 */
export function parseAmt(s: string | number | null | undefined): number {
  if (s === null || s === undefined) return 0;
  return parseFloat((s || '').toString().replace(/[^0-9.]/g, '')) || 0;
}

/**
 * Generate initials from a name
 */
export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Convert ISO date string (YYYY-MM-DD) to display format
 * Example: "2024-03-28" -> "March 28, 2024"
 */
export function isoToDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

/**
 * Convert display date to ISO format (YYYY-MM-DD)
 * Example: "March 28, 2024" -> "2024-03-28"
 */
export function displayToIso(str: string | null | undefined): string | null {
  if (!str) return null;
  try {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  } catch (e) {
    return null;
  }
}

/**
 * Calculate days until a date string (display format)
 * Returns null if date cannot be parsed
 */
export function daysUntil(str: string | null | undefined): number | null {
  if (!str) return null;
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return Math.ceil((d.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  } catch (e) {
    return null;
  }
}

/**
 * Calculate subtotal for an invoice (items only, no tax/shipping)
 */
export function invSubtotal(inv: Invoice | null | undefined): number {
  if (!inv || !inv.items) return 0;
  return inv.items.reduce((sum, item) => sum + item.qty * item.price, 0);
}

/**
 * Calculate total for an invoice (items + tax + shipping)
 */
export function invTotal(inv: Invoice | null | undefined): number {
  if (!inv) return 0;
  return invSubtotal(inv) + (inv.tax || 0) + (inv.shipping || 0);
}

/**
 * Calculate statistics for a client's invoices
 */
export function clientStats(
  invoices: Invoice[],
  clientId: string
): ClientStats {
  let billed = 0;
  let paid = 0;
  let outstanding = 0;
  let drafts = 0;
  let reimbursed = 0;

  invoices
    .filter((i) => i.clientId === clientId)
    .forEach((inv) => {
      const total = invTotal(inv);
      if (inv.isReimbursement) {
        reimbursed += total;
      } else {
        billed += total;
      }
      if (inv.status === 'paid') {
        paid += total;
      } else if (inv.status === 'draft') {
        drafts += total;
      } else {
        outstanding += total;
      }
    });

  const count = invoices.filter((i) => i.clientId === clientId).length;

  return { billed, paid, outstanding, drafts, reimbursed, count };
}

/**
 * Calculate statistics for the entire agency
 */
export function agencyStats(
  invoices: Invoice[],
  clients: Client[]
): AgencyStats {
  let billed = 0;
  let paid = 0;
  let outstanding = 0;
  let drafts = 0;
  let reimbursed = 0;

  invoices.forEach((inv) => {
    const total = invTotal(inv);
    if (inv.isReimbursement) {
      reimbursed += total;
    } else {
      billed += total;
    }
    if (inv.status === 'paid') {
      paid += total;
    } else if (inv.status === 'draft') {
      drafts += total;
    } else {
      outstanding += total;
    }
  });

  return {
    billed,
    paid,
    outstanding,
    drafts,
    reimbursed,
    clients: clients.length,
    invoices: invoices.length,
  };
}

/**
 * Get Tailwind classes for invoice status pill
 */
export function statusPillClass(status: string): string {
  const baseClasses =
    'inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium';

  switch (status) {
    case 'paid':
      return `${baseClasses} border-green-300 bg-green-50 text-green-700`;
    case 'unpaid':
      return `${baseClasses} border-amber-300 bg-amber-50 text-amber-900`;
    case 'overdue':
      return `${baseClasses} border-red-300 bg-red-50 text-red-900`;
    case 'draft':
      return `${baseClasses} border-slate-300 bg-slate-50 text-slate-700`;
    case 'sent':
      return `${baseClasses} border-blue-300 bg-blue-50 text-blue-700`;
    default:
      return `${baseClasses} border-gray-300 bg-gray-50 text-gray-700`;
  }
}

/**
 * Tint a brand color (mix with white at 15%)
 * Used for subtle client card backgrounds
 * Input: hex color (e.g., "#ff0000")
 * Output: hex color tinted 15% toward white
 */
export function tintColor(hexColor: string | null, opacity: number = 0.15): string {
  if (!hexColor) return '#f8f8f8';

  try {
    // Remove # if present
    const hex = hexColor.replace('#', '');

    // Parse hex to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Mix with white (255, 255, 255) at specified opacity
    const tintedR = Math.round(r + (255 - r) * opacity);
    const tintedG = Math.round(g + (255 - g) * opacity);
    const tintedB = Math.round(b + (255 - b) * opacity);

    // Convert back to hex
    const toHex = (n: number) => {
      const hex = n.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(tintedR)}${toHex(tintedG)}${toHex(tintedB)}`;
  } catch (e) {
    return '#f8f8f8';
  }
}

/**
 * Get status pill label for display
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    unpaid: 'Unpaid',
    paid: 'Paid',
    overdue: 'Overdue',
    draft: 'Draft',
    sent: 'Sent',
  };
  return labels[status] || status;
}

/**
 * Format phone number to (XXX) XXX-XXXX on blur.
 * 10 digits → (XXX) XXX-XXXX
 * 11 digits starting with 1 → (XXX) XXX-XXXX (drops leading 1)
 * Otherwise returns as-is.
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

/**
 * Return positiveColor for non-zero values, neutralColor for zero.
 */
export function metricColor(value: number, positiveColor: string, neutralColor: string): string {
  return value === 0 ? neutralColor : positiveColor;
}
