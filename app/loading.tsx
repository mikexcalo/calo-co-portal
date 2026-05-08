import NautilusSpinner from '@/components/shared/NautilusSpinner';

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
