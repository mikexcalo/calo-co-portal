/**
 * Shown when an estimate token doesn't resolve. Deliberately vague: it should
 * not distinguish "never existed" from "expired" from "wrong link", because
 * an endpoint that tells you which is a way to probe for valid tokens.
 */
export default function EstimateNotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f3',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#111' }}>
          This link isn&apos;t working
        </div>
        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.65, marginTop: 10 }}>
          It may have been replaced by a newer version, or the estimate may have already been
          decided. Reply to the email it came from and they&apos;ll send a fresh one.
        </p>
      </div>
    </div>
  );
}
