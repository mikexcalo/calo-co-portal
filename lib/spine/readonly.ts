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
 * Two ways into somebody else's workspace, one guard.
 *
 *   null   your own workspace, or a client's as yourself. Nothing refused.
 *   view   looking. Every write refused.
 *   work   working, with consent. Writes allowed; sending refused unless the
 *          client said yes, and every write recorded.
 *
 * One switch rather than two booleans, because "view and work are both on" is
 * not a state and a shape that can express it will eventually hold it.
 */
export type WorkMode = null | 'view' | 'work';

/**
 * Module state, not React state, because the guard has to answer during a
 * fetch that no component is waiting on.
 */
let mode: WorkMode = null;
let canSend = false;
/** The open session a work-mode write belongs to. Null outside one. */
let grantId: string | null = null;
let actorId: string | null = null;

export function setMode(
  next: WorkMode,
  opts?: { canSend?: boolean; grantId?: string | null; actorId?: string | null }
): void {
  mode = next;
  canSend = next === 'work' ? Boolean(opts?.canSend) : false;
  grantId = next === 'work' ? opts?.grantId ?? null : null;
  actorId = next === 'work' ? opts?.actorId ?? null : null;
}

export const workSession = () => ({ grantId, actorId });

export function currentMode(): WorkMode {
  return mode;
}

/** Writes are refused only while looking. */
export function isReadOnly(): boolean {
  return mode === 'view';
}

/**
 * Sending is refused while looking, and while working without permission.
 *
 * Note which way round the default is. A work session with no grant loaded yet
 * cannot send, because the failure of "assume yes and check later" is an email
 * already in a customer's inbox.
 */
export function sendingBlocked(): boolean {
  if (mode === 'view') return true;
  if (mode === 'work') return !canSend;
  return false;
}

/** Kept so existing callers do not have to change. */
export function setReadOnly(on: boolean): void {
  setMode(on ? 'view' : null);
}

/**
 * What happened, whose fault it is, and whether retrying helps. Nothing is
 * broken and trying again will do the same thing, so it says the way out.
 */
export const READ_ONLY_MESSAGE =
  'Nothing was saved. View mode cannot change anything. Leave View mode to make this change.';

/**
 * Refusing to send says whose decision it was.
 *
 * Not "you do not have permission", which reads as a system saying no. The
 * client owns the relationship with their customers and has not handed it
 * over; that is a fact about them, not a restriction on you, and the sentence
 * should be the one you could repeat to them without embarrassment.
 */
export const SEND_BLOCKED_MESSAGE =
  'Nothing was sent. Sending to customers is theirs, and they have not allowed it.';

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

/**
 * Write it down, because the client was promised a record.
 *
 * Called from the same wrapper that refuses writes in View mode, after the
 * write comes back without an error. That placement is the point: a screen
 * cannot forget to log, a screen written next month is covered, and a write
 * that failed is not reported to the client as a change to their business.
 *
 * Never throws and never blocks. If the log fails the edit still stands, and
 * the alternative - refusing somebody's save because the audit row would not
 * insert - is worse. A missing line shows up as a shorter notice, not as lost
 * work.
 *
 * Re-entrancy guarded, or writing the log would log the log.
 */
/**
 * Writes that are not changes to anybody's business.
 *
 * The promise to the client is "you are told about every change", and a
 * read-receipt is not a change. Marking a notification read, recording that a
 * page was opened, or writing the log itself are bookkeeping: they alter no
 * number, no date and no document, and reporting them would bury the one line
 * that matters under noise the client cannot act on.
 *
 * Named individually rather than guessed at by prefix, because the cost of
 * wrongly excluding something is a change the client is never told about, and
 * that is the failure this whole mechanism exists to prevent. Anything not on
 * this list is reported.
 */
const NOT_A_CHANGE = new Set([
  'work_changes',
  'work_grants',
  'notification_reads',
  'access_events',
  /*
    These two are the session talking about itself.

    Handing back writes the notice and closes the request, both while the mode
    is still on, so the record ended up containing "the message telling you
    what changed" and "your own request being marked done". The client opened
    the list expecting their business and found the machinery.
  */
  'notifications',
  'feedback',
]);

let logging = false;

export function recordWrite(
  entity: string,
  action: string,
  result: unknown,
  fallbackId?: string | null
): void {
  if (mode !== 'work' || !grantId || !actorId || logging) return;
  if (NOT_A_CHANGE.has(entity)) return;

  const res = result as { error?: unknown; data?: unknown } | null;
  if (!res || res.error) return;

  /* The id, from the reply where there is one and from the chain's own
     `.eq('id', …)` where there is not. Still absent is fine: the entity and
     the count are what the notice is built from. */
  let entityId: string | null = null;
  const data = res.data as Record<string, unknown> | Array<Record<string, unknown>> | null;
  const first = Array.isArray(data) ? data[0] : data;
  if (first && typeof first === 'object' && typeof first.id === 'string') entityId = first.id;
  if (!entityId && typeof fallbackId === 'string') entityId = fallbackId;

  const org = orgForLog;
  if (!org) return;

  logging = true;
  void (async () => {
    try {
      const { default: supabase } = await import('@/lib/supabase');
      await supabase.from('work_changes').insert({
        grant_id: grantId,
        org_id: org,
        actor_id: actorId,
        entity,
        entity_id: entityId,
        action,
      });
    } catch {
      /* Deliberately silent. See above: the edit is the thing that matters. */
    } finally {
      logging = false;
    }
  })();
}

/** The workspace being worked in, so a change row can name it. */
let orgForLog: string | null = null;
export function setWorkOrg(orgId: string | null): void {
  orgForLog = orgId;
}

/**
 * The one table View mode may still write to.
 *
 * Starting a work session is a write, and it is the write that ends View mode.
 * Refusing it made "Work in it" a button that did nothing at all: the insert
 * was blocked, no grant came back, the mode never changed, and there was no
 * error anywhere because a refusal resolves rather than throws.
 *
 * Letting it through is not a hole. A grant records that somebody asked to
 * edit; it alters no number, no date and no document belonging to the client,
 * and every actual edit still has to pass the guard afterwards with the mode
 * set to work. Refusing it only prevented the transition, never a change.
 */
const WRITABLE_WHILE_VIEWING = new Set(['work_grants']);

export const writableWhileViewing = (table: string): boolean =>
  WRITABLE_WHILE_VIEWING.has(table);

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
/**
 * The routes that reach the client's own customers.
 *
 * Named rather than pattern-matched, because "does this send" is a judgement
 * about each route and a regex would decide it by spelling. Every one of these
 * ends in an email, a link or a document arriving with somebody who is not a
 * user of this product.
 *
 * The server refuses the same calls at postEmail(), so a request that gets
 * past this list still does not reach a customer. This one exists to fail
 * early and say why, on the screen, rather than after a round trip.
 */
const SEND_ROUTES = [
  '/api/estimates/send',
  '/api/estimates/decide',
  '/api/invoices/send',
  '/api/invoices/email',
  '/api/invoices/share',
  '/api/invoices/pay-link',
  '/api/reviews/send',
  '/api/followups/send',
  '/api/updates/send',
  '/api/drops/hand-over',
  '/api/team/invite',
];

export const isSendRoute = (path: string): boolean =>
  SEND_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));

let installed = false;

export function guardApiWrites(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const original = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (mode === null) return original(input, init);

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
      /*
        Two different refusals, and which one depends on the route.

        In View mode nothing may be written at all, so every /api write is
        refused. In Work mode writing is the point, and only the routes that
        reach the client's own customers are held back. Anything not on that
        list is ordinary work and goes through.
      */
      if (path.startsWith('/api/')) {
        if (mode === 'view') {
          return Promise.resolve(
            new Response(JSON.stringify({ error: READ_ONLY_MESSAGE }), {
              status: 403,
              headers: { 'content-type': 'application/json' },
            })
          );
        }
        if (mode === 'work' && !canSend && isSendRoute(path)) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: SEND_BLOCKED_MESSAGE }), {
              status: 403,
              headers: { 'content-type': 'application/json' },
            })
          );
        }
      }
    }

    return original(input, init);
  };
}
