'use client';

import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-[#1e293b] border-b border-[#334155]">
      <div className="max-w-[980px] mx-auto h-[52px] flex items-center justify-between px-6">
        <Link href="/" className="text-white font-bold text-sm tracking-wider">
          AGENCY DASHBOARD
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="btn btn-ghost"
          >
            Settings
          </Link>
        </div>
      </div>
    </nav>
  );
}
