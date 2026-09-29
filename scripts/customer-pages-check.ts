/**
 * The two pages a customer sees, rendered before anything is pushed.
 *
 * WHY THIS EXISTS
 *
 * `vocabFor` was moved into `lib/spine/org.tsx`, which opens with
 * `'use client'`, and imported from `app/e/[token]/page.tsx`, which is a
 * server component. A server component importing a value from a client module
 * does not get the function; it gets a reference to something that will exist
 * in the browser, and calling it throws. Every proposal link in the product
 * was a blank page for forty-one hours and nothing anywhere said so: the page
 * still answered 200, because the error boundary is itself a client component,
 * so the failure only appears once the browser hydrates.
 *
 * No type error, no lint error, no build failure. `next build` compiled it
 * happily. The only thing that catches it is asking the server to render the
 * page and looking at what comes back, which is what this does.
 *
 * WHY IT RENDERS RATHER THAN READS THE SOURCE
 *
 * A rule like "no server page may import from a client module" is checkable
 * and would have caught this one. It would not have caught the next one:
 * these two documents are the only screens in the product with no session, no
 * shell and no second chance, and the ways to break them are not a list. A
 * rendered page that says what it should say is the assertion that does not
 * need updating.
 *
 * WHAT IT DOES
 *
 * Starts a dev server on a spare port, asks it for one demo proposal and one
 * demo invoice as a signed-out stranger would, and insists that each comes
 * back with the document's own footer in it. That footer is in `DocShell`,
 * which both pages render last, so it cannot be there unless everything above
 * it rendered too.
 *
 * NOT the production documents. The demo workspaces are seeded, they hold
 * tokens that do not change, and a check that reads a client's real proposal
 * on every push is a check that logs somebody's business into a terminal.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

/** Somewhere nothing else is listening. `next dev` owns 3000. */
const PORT = 3457;
const BASE = `http://127.0.0.1:${PORT}`;

/**
 * Rendered by `DocShell`, which is the outermost thing on both documents and
 * therefore the last thing to render. Present means the page got to the end.
 */
const FOOTER = 'Sent securely through';

/**
 * The service-role key, without which both pages answer not-found.
 *
 * Read from the environment first, then from `.env.production.local`, which is
 * where `vercel env pull` puts it and where the handoff says it lives. Never
 * copied into `.env.local`: these two routes are the only thing locally that
 * wants it, and a key in the file the dev server loads by default is a key
 * every other screen runs with.
 */
function serviceKey(): string | null {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  for (const f of ['.env.production.local', '.env.local']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/);
      if (m) return m[1].replace(/^["']|["']$/g, '').trim();
    }
  }
  return null;
}

function env(name: string): string | null {
  if (process.env[name]) return process.env[name] as string;
  for (const f of ['.env.local', '.env.production.local']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(new RegExp(`^${name}=(.+)$`));
      if (m) return m[1].replace(/^["']|["']$/g, '').trim();
    }
  }
  return null;
}

/**
 * One demo document of each kind, asked for rather than hardcoded.
 *
 * A token written into this file is a token that goes stale the next time
 * anybody reseeds a demo workspace, and a check that fails for a reason that
 * is not the reason it exists gets switched off within a week.
 */
async function demoTokens(url: string, key: string): Promise<{ estimate: string; invoice: string } | null> {
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const demoOrgs = await fetch(`${url}/rest/v1/orgs?select=id&is_demo=eq.true`, { headers })
    .then((r) => r.json() as Promise<Array<{ id: string }>>)
    .catch(() => null);
  if (!demoOrgs?.length) return null;
  const ids = demoOrgs.map((o) => o.id).join(',');

  const jobs = await fetch(`${url}/rest/v1/jobs?select=id&org_id=in.(${ids})`, { headers })
    .then((r) => r.json() as Promise<Array<{ id: string }>>)
    .catch(() => null);
  if (!jobs?.length) return null;
  const jobIds = jobs.map((j) => j.id).join(',');

  const one = async (table: string): Promise<string | null> => {
    const rows = await fetch(
      `${url}/rest/v1/${table}?select=public_token&job_id=in.(${jobIds})&public_token=not.is.null&limit=1`,
      { headers }
    )
      .then((r) => r.json() as Promise<Array<{ public_token: string }>>)
      .catch(() => null);
    return rows?.[0]?.public_token ?? null;
  };

  const [estimate, invoice] = await Promise.all([one('estimates'), one('job_invoices')]);
  return estimate && invoice ? { estimate, invoice } : null;
}

async function waitForServer(ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(`${BASE}/api/version`, { signal: AbortSignal.timeout(2000) });
      if (r.status) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/** Everything a reader would see, with the scripts and styles taken out. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function check(path: string, what: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(45000) });
  } catch (e) {
    return `${what} could not be fetched at all: ${(e as Error).message}`;
  }

  const html = await res.text();
  const text = visibleText(html);

  if (res.status !== 200) return `${what} answered ${res.status}, not 200.`;

  /*
    A thrown render answers 200 with almost nothing in it.

    `app/error.tsx` is a client component, so the server sends an empty shell
    and the words "That screen did not load" are painted by the browser after
    it hydrates. Judging this on the status code would pass every time. What
    separates the two is whether the document is in there.
  */
  if (!html.includes(FOOTER)) {
    return (
      `${what} rendered nothing. The page answered 200 but the document is not in it, ` +
      `which is what a server component throwing looks like from out here.\n` +
      `      What came back, in full: ${text.length ? `"${text.slice(0, 160)}"` : '(empty)'}`
    );
  }

  return null;
}

async function main() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL');
  const key = serviceKey();

  if (!url || !key) {
    /*
      Loud, and not a failure.

      A check nobody can run is a check somebody turns off. A fresh clone with
      no `vercel env pull` behind it should say what is missing and let the
      push through, rather than blocking work on a key the pusher may not be
      entitled to.
    */
    console.warn('Customer pages: SKIPPED. No service-role key found, so /e and /i cannot render.');
    console.warn('  Run `vercel env pull .env.production.local` to turn this check on.');
    return;
  }

  const tokens = await demoTokens(url, key);
  if (!tokens) {
    console.warn('Customer pages: SKIPPED. No demo proposal and invoice with public tokens to render.');
    return;
  }

  let server: ChildProcess | null = null;
  const stop = () => {
    if (server && !server.killed) {
      try { process.kill(-server.pid!, 'SIGTERM'); } catch { server.kill('SIGTERM'); }
    }
  };

  try {
    server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
      env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: key },
      stdio: 'ignore',
      detached: true,
    });

    if (!(await waitForServer(90_000))) {
      console.error('Customer pages: the dev server did not start, so nothing was checked.');
      process.exitCode = 1;
      return;
    }

    const problems = (
      await Promise.all([
        check(`/e/${tokens.estimate}`, 'The proposal at /e/[token]'),
        check(`/i/${tokens.invoice}`, 'The invoice at /i/[token]'),
      ])
    ).filter(Boolean) as string[];

    if (problems.length) {
      console.error('');
      console.error('The documents a customer receives do not render:');
      console.error('');
      for (const p of problems) console.error(`  - ${p}`);
      console.error('');
      console.error('  The commonest cause is a server component importing a value from a');
      console.error("  file that opens with 'use client'. See docs/ux-rulebook.md, section 4b.");
      console.error('');
      process.exitCode = 1;
      return;
    }

    console.log('Customer pages: the proposal and the invoice both render.');
  } finally {
    stop();
  }
}

main().catch((e) => {
  console.error('Customer pages: the check itself fell over.', e);
  process.exitCode = 1;
});
