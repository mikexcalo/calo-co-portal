/**
 * Shown when a proposal token doesn't resolve. Deliberately vague: it should
 * not distinguish "never existed" from "expired" from "wrong link", because
 * an endpoint that tells you which is a way to probe for valid tokens.
 *
 * It says "document" rather than the business's own word for one. There is no
 * org to read a vocabulary from here, and there must not be: the word is
 * itself a fact about which business sent this, and this page exists to answer
 * without saying who.
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
        <p style={{ fontSize: 15, color: '#555', lineHeight: 1.65, marginTop: 10 }}>
          It may have been replaced by a newer version, or the document may have already been
          decided. Reply to the email it came from and they&apos;ll send a fresh one.
        </p>
      </div>
    </div>
  );
}
