import NautilusSpinner from '@/components/shared/NautilusSpinner';

/**
 * Route-level loading indicator for App Router.
 * Renders while async Server Components are loading.
 * Client-side pages ('use client') render their shell instantly,
 * so this primarily shows during initial page load / hard navigation.
 */
export default function Loading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flex: 1, minHeight: '60vh',
    }}>
      <NautilusSpinner spinning size={48} />
    </div>
  );
}
