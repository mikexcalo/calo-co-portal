/** Route-level loading indicator. */
export default function Loading() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        minHeight: '60vh',
        color: '#6b6b73',
        fontSize: 14,
      }}
    >
      Loading…
    </div>
  );
}
