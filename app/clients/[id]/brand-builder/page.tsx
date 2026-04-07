'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function BrandBuilderRedirect() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    router.replace(`/design?client=${params.id}&template=yard-sign`);
  }, [router, params]);
  return null;
}
