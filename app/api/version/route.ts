/**
 * What is actually deployed.
 *
 * Every screen redirects to /login when signed out, so fetching a URL proves
 * nothing about whether a push has landed — which is how an afternoon gets
 * spent looking at a stale sidebar and wondering whether the code is wrong.
 *
 * Public on purpose, and deliberately thin: a commit hash and a branch. It
 * says what is running, nothing about who is running it.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  return NextResponse.json(
    {
      commit: sha ? sha.slice(0, 7) : 'local',
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'local',
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split('\n')[0] ?? null,
      env: process.env.VERCEL_ENV ?? 'development',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
