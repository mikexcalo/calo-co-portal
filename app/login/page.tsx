'use client';

/**
 * Sign in.
 *
 * This is where a client lands from the "Log in" link on calo.company, so it
 * has to make sense to someone who has never seen this product and was told
 * "your portal is here" - not just to Mike.
 *
 * There is deliberately no self-signup. Accounts are created for a client
 * when their workspace is set up; an open signup form would let anyone make
 * an orphan account with no business attached, which looks broken and is
 * worse than an honest "ask whoever set yours up".
 *
 * The form lives in `components/public/SignInForm` because the other door -
 * a workspace's own link at /in/[workspace] - has to be the same sign-in with
 * a different name above it, and two copies would be two sign-ins.
 */

import { Suspense } from 'react';
import { SignInForm } from '@/components/public/SignInForm';

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary during static generation.
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
