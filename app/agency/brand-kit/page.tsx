'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AgencyBrandKitRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/agency/design-studio?tab=brand-kit');
  }, [router]);
  return null;
}
