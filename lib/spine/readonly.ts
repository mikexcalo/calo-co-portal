'use client';

/**
 * Nothing can be written while View mode is on.
 *
 * WHAT THIS IS AND IS NOT
 *
 * It is not a security boundary, and pretending otherwise would be the
 * dishonest version of this feature. The person in View mode is the studio
 * owner, holding their own token and their own membership in the client's
 * workspace. Row-level security cannot tell "Mike, looking" from "Mike,
 * working", because the only thing that differs is a boolean in his own
 * browser that he could decline to set. Short of issuing a second, weaker
 * credential, no arrangement of policies changes that.
 *
 * What it is: a guarantee that nothing in the product can write while View
 * mode is on, including code nobody thought about. Greying a button out stops
 * the careful path and leaves every other one open — a keyboard shortcut, an
 * effect that saves on unmount, a debounce that fires after you have left. The
 * failure this prevents is the realistic one: changing a client's data by
 * accident while looking at it.
 *
 * WHY HERE AND NOT AT THE CALL SITES
 *
 * There are 243 places that insert, update, upsert or delete, and around
 * thirty API routes that write server-side. Guarding them one at a time is a
 * guarantee about today's code and nothing about next month's. Everything goes
 * through two doors — the Supabase client and fetch to /api — so the guard is
 * on the doors.
 *
 * A refused write does not throw. It resolves the way a rejected write from
 * the database resolves, `{ data: null, error }`, so the 188 call sites
 * wrapped in save() surface a sentence and the ones that call unwrap() throw
 * the same way they already do. No screen needs to know this file exists.
 */

/**
 * Module state, not React state, because the guard has to answer during a
 * fetch that no component is waiting on.
 */
let readOnly = false;

export function setReadOnly(on: boolean): void {
  readOnly = on;
}

export function isReadOnly(): boolean {
  return readOnly;
}

/**
 * What happened, whose fault it is, and whether retrying helps. Nothing is
 * broken and trying again will do the same thing, so it says the way out.
 */
export const READ_ONLY_MESSAGE =
  'Nothing was saved. View mode cannot change anything. Leave View mode to make this change.';

const refusal = () => ({
  data: null,
  error: { message: READ_ONLY_MESSAGE, code: 'VIEW_ONLY', details: '', hint: '' },
  count: null,
  status: 403,
  statusText: 'View mode',
});

/**
 * Something that looks like a Supabase query builder and is not one.
 *
 * `.insert(row).select().single()` has to keep working as an expression, so
 * every property returns something callable that returns this same object, and
 * awaiting it anywhere along the chain gives the refusal. No request is made.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function refusedWrite(): any {
  const settled = Promise.resolve(refusal());
  const stub: any = new Proxy(function () {} as unknown as Record<string, unknown>, {
    get(_target, prop) {
      if (prop === 'then') return settled.then.bind(settled);
      if (prop === 'catch') return settled.catch.bind(settled);
      if (prop === 'finally') return settled.finally.bind(settled);
      return () => stub;
    },
    apply() {
      return stub;
    },
  });
  return stub;
}

/**
 * The reads that still have to run.
 *
 * Blocking every rpc would take Home down with it, so this is an allow list
 * rather than a deny list: a function nobody has thought about is refused,
 * which is the right way round. `record_access` is deliberately NOT here — it
 * writes a row, and a view that leaves a trace is not the read-only view the
 * bar promises.
 */
const READ_ONLY_RPCS = new Set([
  'home_signals',
  'current_org_id',
  'customer_logo_path',
  'mfa_enabled',
  'mfa_pending',
  'mfa_recovery_remaining',
]);

export const rpcAllowedInViewMode = (fn: string): boolean => READ_ONLY_RPCS.has(fn);

/** Builder methods that change something. */
export const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);

/** Storage methods that change something. Downloads and reads are fine. */
export const STORAGE_WRITE_METHODS = new Set([
  'upload',
  'uploadToSignedUrl',
  'update',
  'remove',
  'move',
  'copy',
  'createSignedUploadUrl',
]);

/**
 * The other door.
 *
 * About thirty API routes do work the caller could not do directly — send an
 * invoice, email a customer, hand over a drop — on the service-role key, which
 * walks straight past row-level security. They are reached by fetch, so the
 * guard is on fetch: same origin, /api, anything that is not a GET or a HEAD.
 *
 * Installed once. Supabase talks to a different origin and passes straight
 * through.
 */
let installed = false;

export function guardApiWrites(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const original = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!readOnly) return original(input, init);

    const method = (
      init?.method ??
      (typeof input === 'object' && 'method' in input ? input.method : 'GET') ??
      'GET'
    ).toUpperCase();

    if (method !== 'GET' && method !== 'HEAD') {
      const href =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      let path = href;
      try {
        const url = new URL(href, window.location.origin);
        path = url.origin === window.location.origin ? url.pathname : '';
      } catch {
        /* a url we cannot parse is not one of ours */
        path = '';
      }
      if (path.startsWith('/api/')) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: READ_ONLY_MESSAGE }), {
            status: 403,
            headers: { 'content-type': 'application/json' },
          })
        );
      }
    }

    return original(input, init);
  };
}
