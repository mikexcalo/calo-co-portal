/**
 * A write that cannot fail quietly.
 *
 * Forty-nine places wrote to the database and never looked at the result, so
 * a rejected save looked exactly like a successful one: the row vanished from
 * the screen on the next load and nobody could say why. Wrapping the call
 * says so, once, in words, without every screen needing its own error state.
 */

import { human } from './errors';

export const SAVE_FAILED = 'nautilus:save-failed';

export interface Saveable<T> { then: Promise<T>['then'] }

export async function save<T extends { error?: { message?: string } | null }>(
  op: PromiseLike<T>,
  what?: string
): Promise<T> {
  let res: T;
  try {
    res = await op;
  } catch (e) {
    announce(human(e), what);
    throw e;
  }
  if (res?.error) announce(human(res.error), what);
  return res;
}

function announce(message: string, what?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(SAVE_FAILED, { detail: { message, what: what ?? null } })
  );
}
