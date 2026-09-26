/**
 * What is due when somebody says yes.
 *
 * A deposit is two settings in one product: what this business usually asks
 * for, and what this proposal actually asks for. They are stored separately
 * on purpose - the workspace one is a starting point and the estimate one is
 * the record of what was offered, and confusing the two is how a customer
 * ends up agreeing to a figure nobody meant.
 *
 * Kind and value rather than a resolved amount, because a percentage has to
 * survive the total changing while somebody is still editing the lines.
 */

export type DepositKind = 'none' | 'percent' | 'fixed';

export interface Deposit {
  kind: DepositKind;
  /** A percentage when kind is percent, money when fixed, 0 when none. */
  value: number;
}

export const NO_DEPOSIT: Deposit = { kind: 'none', value: 0 };

/** Read a workspace's default. Anything malformed reads as none. */
export function depositOf(settings: unknown): Deposit {
  const raw = (settings as Record<string, unknown> | null | undefined)?.deposit;
  if (!raw || typeof raw !== 'object') return NO_DEPOSIT;
  const d = raw as Record<string, unknown>;
  const kind = d.kind === 'percent' || d.kind === 'fixed' ? d.kind : 'none';
  const value = Number(d.value);
  if (kind === 'none' || !Number.isFinite(value) || value <= 0) return NO_DEPOSIT;
  if (kind === 'percent' && value > 100) return NO_DEPOSIT;
  return { kind, value };
}

/**
 * The money, given a total.
 *
 * Never more than the total: a fixed deposit left over from a bigger version
 * of a job must not ask for more than the job now costs, and "deposit
 * $5,000" under "total $3,200" is the kind of thing somebody stops reading
 * at.
 *
 * Returns 0 for none, which every caller treats as "show nothing".
 */
export function depositAmount(deposit: Deposit, total: number): number {
  if (deposit.kind === 'none' || !(total > 0)) return 0;
  const raw = deposit.kind === 'percent' ? total * (deposit.value / 100) : deposit.value;
  return Math.min(Math.round(raw * 100) / 100, Math.round(total * 100) / 100);
}

/** "30% deposit" / "$2,500 deposit". For the settings screen and the builder. */
export function describeDeposit(deposit: Deposit): string {
  if (deposit.kind === 'none') return 'No deposit';
  if (deposit.kind === 'percent') return `${deposit.value}% deposit`;
  return `$${deposit.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} deposit`;
}
