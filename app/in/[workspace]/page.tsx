/**
 * A workspace's own front door.
 *
 * The same sign-in, with the business's name and mark above it instead of
 * ours. It is the link that belongs in an invitation, in a reset email, and
 * anywhere a client is told "your portal is here" - because at that moment
 * we know whose business it is, and making them check they are in the right
 * place is a cost we do not have to charge them.
 *
 * Resolved by slug, server side, with the service role. There is nothing
 * secret in the answer: a business name and a logo are what this workspace
 * puts on its own documents. A slug that does not resolve falls through to
 * our own door rather than to a not-found, because somebody mistyping a link
 * still wants to sign in.
 */

import { createClient } from '@supabase/supabase-js';
import { Suspense } from 'react';
import { SignInForm } from '@/components/public/SignInForm';
import { clientFace } from '@/lib/spine/client-face';
import type { DoorWorkspace } from '@/components/public/Door';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

async function workspaceFor(slug: string): Promise<DoorWorkspace | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db
    .from('orgs')
    .select('name, slug, kind, settings')
    .eq('slug', slug)
    .maybeSingle();

  if (!data) return null;
  const face = clientFace(data as Parameters<typeof clientFace>[0]);
  return {
    name: (data as { name?: string }).name ?? 'Your workspace',
    logo: face.logo ?? null,
    initials: initialsOf((data as { name?: string }).name ?? ''),
  };
}

export async function generateMetadata({ params }: { params: { workspace: string } }) {
  const ws = await workspaceFor(params.workspace);
  return { title: ws ? `Sign in to ${ws.name}` : 'Sign in' };
}

export default async function WorkspaceDoor({ params }: { params: { workspace: string } }) {
  const ws = await workspaceFor(params.workspace);
  return (
    <Suspense fallback={null}>
      <SignInForm workspace={ws} />
    </Suspense>
  );
}
