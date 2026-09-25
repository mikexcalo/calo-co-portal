/**
 * Supabase client initialization
 * Uses environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Uses createBrowserClient from @supabase/ssr so the client automatically
 * picks up the logged-in user's session cookies. This is required for RLS
 * policies to see auth.uid().
 *
 * Lazily initialized to avoid throwing during Next.js static generation (build time).
 */

import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  currentMode,
  isReadOnly,
  recordWrite,
  refusedWrite,
  rpcAllowedInViewMode,
  STORAGE_WRITE_METHODS,
  writableWhileViewing,
  WRITE_METHODS,
} from '@/lib/spine/readonly';

let _client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase configuration. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'
    );
  }

  _client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

/*
  Where View mode's read-only promise is actually kept.

  Every write in the product comes through one of the three things below, so
  this is the one place that has to know. See lib/spine/readonly.ts for why it
  is a door rather than 243 locks, and for the honest limit: this stops the
  product writing, it does not stop the person, because the person is the
  studio owner holding their own token.

  When View mode is off these wrappers hand straight through and cost nothing.
*/

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * insert / update / upsert / delete.
 *
 * Refused outright while looking. While working, allowed and written down: the
 * same wrapper that says no in View mode is the one that keeps the record in
 * Work mode, so a screen cannot do one without the other.
 */
function guardTable(builder: any, table: string): any {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === 'string' && WRITE_METHODS.has(prop) && typeof value === 'function') {
        return (...args: unknown[]) => {
          if (isReadOnly() && !writableWhileViewing(table)) return refusedWrite();
          const out = (value as (...a: unknown[]) => unknown).apply(target, args);
          if (currentMode() !== 'work') return out;
          /* Watched rather than awaited: the caller's promise is handed back
             untouched and the log happens beside it. */
          return watched(out, table, prop, { id: null });
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Hand back the builder, and record what it did when somebody awaits it.
 *
 * A Supabase builder is a thenable that is usually chained before it is
 * awaited, so wrapping `then` rather than the builder keeps every chain
 * working and catches the one moment the write actually resolves.
 */
function watched(
  builder: any,
  table: string,
  action: string,
  /*
    The row being written, picked up off the chain rather than the reply.

    An update without `.select()` resolves with no data at all, so the change
    row went in with entity_id null and the list could not mark what had been
    touched. The id is nearly always right there in the filter — `.eq('id', x)`
    — so it is read as the chain is built, and the reply still wins when it
    carries one.
  */
  found: { id: string | null }
): any {
  if (!builder || typeof builder.then !== 'function') return builder;
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === 'then' && typeof value === 'function') {
        return (onOk: any, onErr: any) =>
          (value as any).call(
            target,
            (res: unknown) => {
              recordWrite(table, action, res, found.id);
              return onOk ? onOk(res) : res;
            },
            onErr
          );
      }
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          if (prop === 'eq' && args[0] === 'id' && typeof args[1] === 'string') found.id = args[1];
          if (prop === 'match' && args[0] && typeof args[0] === 'object') {
            const id = (args[0] as Record<string, unknown>).id;
            if (typeof id === 'string') found.id = id;
          }
          const next = (value as (...a: unknown[]) => unknown).apply(target, args);
          /* Still the same write: keep watching down the chain. */
          return next && typeof (next as any).then === 'function'
            ? watched(next, table, action, found)
            : next;
        };
      }
      return value;
    },
  });
}

/** upload / remove / move / copy. Downloads and public urls are reads. */
function guardStorage(storage: any): any {
  return new Proxy(storage, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === 'from' && typeof value === 'function') {
        return (bucket: string) => {
          const bucketApi = (value as (b: string) => any).call(target, bucket);
          return new Proxy(bucketApi, {
            get(bTarget, bProp, bReceiver) {
              const bValue = Reflect.get(bTarget, bProp, bReceiver);
              if (
                typeof bProp === 'string' &&
                STORAGE_WRITE_METHODS.has(bProp) &&
                typeof bValue === 'function'
              ) {
                return (...args: unknown[]) =>
                  isReadOnly()
                    ? refusedWrite()
                    : (bValue as (...a: unknown[]) => unknown).apply(bTarget, args);
              }
              return typeof bValue === 'function' ? bValue.bind(bTarget) : bValue;
            },
          });
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Proxy that lazily initializes the Supabase client on first property access.
 * This prevents the client from being created during static page generation at build time.
 */
const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabase();

    if (prop === 'from') {
      return (table: string) => guardTable(client.from(table), table);
    }

    /*
      An allow list, not a deny list.

      Most rpc calls are reads, and blocking them all would take Home down.
      But a function added next month is more likely to write than not, so the
      default is no. record_access is refused on purpose: it writes a row, and
      a view that leaves a trace is not the read-only view the bar promises.
    */
    if (prop === 'rpc') {
      return (fn: string, args?: unknown, opts?: unknown) =>
        isReadOnly() && !rpcAllowedInViewMode(fn)
          ? refusedWrite()
          : (client.rpc as any)(fn, args, opts);
    }

    if (prop === 'storage') {
      return guardStorage(client.storage);
    }

    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export { supabase };
export default supabase;
