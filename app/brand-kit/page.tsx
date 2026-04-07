'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BrandKitRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/agency/brand-kit'); }, [router]);
  return null;
}
