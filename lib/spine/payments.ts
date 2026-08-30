/**
 * How a business gets paid.
 *
 * Card is one option among several, not the default. At ~2.9% it costs $564
 * to move $19,433 that a bank transfer moves for $5 — so on the invoice sizes
 * a contractor deals in, forcing everything through cards is a meaningful tax
 * on their revenue.
 *
 * SECURITY NOTE, because it shapes the whole design: only public handles are
 * ever stored. A Venmo username or a PayPal address is meant to be shared —
 * knowing it lets someone send you money, not take it. Bank account and
 * routing numbers are the opposite, so bank transfer says "ask for details"
 * rather than holding numbers that would make this database worth attacking.
 */

export type PaymentMethodId =
  | 'stripe'
  | 'venmo'
  | 'paypal'
  | 'zelle'
  | 'check'
  | 'bank'
  | 'cash';

export interface PaymentMethod {
  id: PaymentMethodId;
  /** Venmo username, PayPal address, mailing address. Never account numbers. */
  handle?: string;
  note?: string;
  enabled: boolean;
}

export interface MethodSpec {
  id: PaymentMethodId;
  label: string;
  /** What to ask the business for. */
  handleLabel: string | null;
  placeholder?: string;
  /** Roughly what it costs them to receive money this way. */
  cost: (amount: number) => number;
  costLabel: string;
  /** Shown to the customer paying. */
  customerHint: string;
  /** Warn when a handle looks like something it shouldn't be. */
  sensitive?: boolean;
  /**
   * Needs a connected Stripe account before it can be offered. Everything
   * else works the day you type a handle in, because everything else is you
   * telling a customer where to send money — no integration involved.
   */
  needsStripe?: boolean;
}

export const METHODS: MethodSpec[] = [
  {
    id: 'stripe',
    label: 'Card or bank transfer online',
    handleLabel: null,
    needsStripe: true,
    cost: (a) => a * 0.029 + 0.3,
    costLabel: '2.9% + 30¢ on cards, ~0.8% on bank transfer',
    customerHint: 'Pay online by card or bank transfer. Instant confirmation.',
  },
  {
    id: 'venmo',
    label: 'Venmo',
    handleLabel: 'Your Venmo username',
    placeholder: '@your-username',
    // Personal Venmo is free; business profiles take a cut.
    cost: () => 0,
    costLabel: 'Free between personal accounts; 1.9% + 10¢ on business profiles',
    customerHint: 'Send to this Venmo username.',
  },
  {
    id: 'paypal',
    label: 'PayPal',
    handleLabel: 'Your PayPal email or PayPal.me link',
    placeholder: 'you@yourbusiness.com',
    cost: (a) => a * 0.0349 + 0.49,
    costLabel: '3.49% + 49¢ for goods and services',
    customerHint: 'Send to this PayPal account.',
  },
  {
    id: 'zelle',
    label: 'Zelle',
    handleLabel: 'The email or phone your Zelle is registered to',
    placeholder: 'you@yourbusiness.com',
    cost: () => 0,
    costLabel: 'Free — bank to bank',
    customerHint: 'Send through your bank’s Zelle to this address.',
  },
  {
    id: 'check',
    label: 'Check',
    handleLabel: 'Where to mail it',
    placeholder: '123 Main St, Suite 4, Your City, ST 00000',
    cost: () => 0,
    costLabel: 'Free, but slow to arrive and slow to clear',
    customerHint: 'Make it out to the business name and mail it here.',
  },
  {
    id: 'bank',
    label: 'Bank transfer / ACH',
    // Deliberately not a field for account numbers.
    handleLabel: 'A note on how to request details',
    placeholder: 'Call or email us and we’ll send account details',
    cost: (a) => Math.min(a * 0.008, 5),
    costLabel: 'Usually free or a few dollars',
    customerHint: 'Ask for account details and pay from your bank.',
    sensitive: true,
  },
  {
    id: 'cash',
    label: 'Cash',
    handleLabel: null,
    cost: () => 0,
    costLabel: 'Free',
    customerHint: 'Hand it over on site.',
  },
];

export const specFor = (id: PaymentMethodId): MethodSpec | undefined =>
  METHODS.find((m) => m.id === id);

export function enabledMethods(org: { payment_methods?: unknown } | null): PaymentMethod[] {
  const raw = (org?.payment_methods ?? []) as PaymentMethod[];
  return Array.isArray(raw) ? raw.filter((m) => m.enabled) : [];
}

/**
 * What each accepted method would cost on this amount, cheapest first.
 * The point is to make the difference visible at the moment it matters.
 */
export function costComparison(
  methods: PaymentMethod[],
  amount: number
): Array<{ method: PaymentMethod; spec: MethodSpec; cost: number }> {
  return methods
    .map((m) => ({ method: m, spec: specFor(m.id)! }))
    .filter((x) => x.spec)
    .map((x) => ({ ...x, cost: x.spec.cost(amount) }))
    .sort((a, b) => a.cost - b.cost);
}

/** Flags a handle that looks like a bank account number rather than a handle. */
export function looksLikeAccountNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 && digits.length / Math.max(value.length, 1) > 0.6;
}
