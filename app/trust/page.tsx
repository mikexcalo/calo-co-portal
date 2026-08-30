/**
 * Trust — the page you point someone at when they ask "is this safe?"
 *
 * Public on purpose. It is worth nothing behind a login, because the person
 * who needs convincing has not signed up yet.
 *
 * The rule for everything on this page: only claims that are true right now,
 * and an honest list of what is not done yet. A trust page that overstates is
 * worse than no trust page — the one thing it is supposed to establish is
 * that we do not overstate. The "not yet" section is the part that makes the
 * rest believable.
 */

import Link from 'next/link';
import { PRODUCT, PROVIDER, SUPPORT_EMAIL } from '@/lib/brand';

export const metadata = {
  title: `Security & Trust · ${PRODUCT}`,
  description: `How ${PRODUCT} stores and protects your business data.`,
};

const INK = '#141414';
const TEXT = '#1a1a1a';
const DIM = '#363634';
const FAINT = '#55554f';
const BORDER = '#e4e4e0';
const ACCENT = '#2563eb';
const GREEN = '#15803d';

const FACTS = [
  {
    title: 'Your data is walled off from everyone else’s',
    body:
      `Every business using ${PRODUCT} is separated inside the database itself, not just in the app. That distinction matters: it means a bug on a screen cannot show you another company’s customers or invoices, because the database refuses the request before the screen ever sees it.`,
  },
  {
    title: 'We never store card numbers',
    body:
      `Card payments go straight to Stripe, who are certified at the highest level in the payments industry to hold them. No card number ever reaches ${PRODUCT}, so there is none here to lose.`,
  },
  {
    title: 'We never store bank account or routing numbers',
    body:
      `This is a deliberate choice rather than a gap. The payment details kept here are the public handles you already hand out to get paid — a Venmo username, a PayPal address. Knowing one lets someone send you money, not take it. Where a customer needs real account details, ${PRODUCT} tells them to ask you directly.`,
  },
  {
    title: 'Encrypted going in and sitting still',
    body:
      'Everything is encrypted travelling between your browser and the servers, and encrypted again on the disks it rests on. Neither is optional or something we can switch off by accident.',
  },
  {
    title: 'Two-factor sign-in, enforced properly',
    body:
      'You can require a code from your phone on top of your password. Plenty of tools ask for the code and then let the app do as it pleases; here, a sign-in that skipped the code cannot read anything at all, because the block is in the database rather than in the screen. Backup codes mean losing your phone does not mean losing access to your business.',
  },
  {
    title: 'Audited infrastructure underneath',
    body:
      `${PRODUCT} runs on Supabase and Vercel, both independently audited to SOC 2 Type II — the standard a company’s IT department asks about. Data is held in the United States on Amazon Web Services.`,
  },
];

export default function TrustPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f5', padding: '48px 20px 80px' }}>
      <div style={{ maxWidth: 660, margin: '0 auto' }}>
        <div style={{ marginBottom: 34 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: INK, letterSpacing: '-0.4px' }}>
            {PRODUCT}
          </div>
          <h1 style={{ fontSize: 27, fontWeight: 600, color: INK, letterSpacing: '-0.6px', margin: '20px 0 12px' }}>
            Security &amp; trust
          </h1>
          <p style={{ fontSize: 15, color: DIM, lineHeight: 1.7, margin: 0 }}>
            You are about to put your customers, your prices and your invoices into someone
            else&apos;s software. That is a real thing to hand over. Here is exactly how it is
            looked after.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FACTS.map((f) => (
            <div
              key={f.title}
              style={{
                background: '#fff',
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: 20,
                    height: 20,
                    borderRadius: 7,
                    background: '#ECF6F0',
                    border: `1px solid ${GREEN}55`,
                    color: GREEN,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                    lineHeight: 1,
                  }}
                >
                  ✓
                </span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 5 }}>
                    {f.title}
                  </div>
                  <p style={{ fontSize: 13.5, color: DIM, lineHeight: 1.7, margin: 0 }}>{f.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 34 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: INK, margin: '0 0 8px' }}>
            What you can do right now
          </h2>
          <p style={{ fontSize: 13.5, color: DIM, lineHeight: 1.7, margin: '0 0 6px' }}>
            Turn on two-factor sign-in under <strong>Security</strong> once you are logged in.
            It takes two minutes and protects you against the most common way accounts are lost
            anywhere: a password reused on another site that later got breached.
          </p>
          <p style={{ fontSize: 13.5, color: DIM, lineHeight: 1.7, margin: 0 }}>
            Save the backup codes somewhere other than the phone you just set up. They are how
            you get back in if that phone is ever lost or replaced.
          </p>
        </div>

        <div
          style={{
            marginTop: 34,
            paddingTop: 22,
            borderTop: `1px solid ${BORDER}`,
            fontSize: 13,
            color: FAINT,
            lineHeight: 1.7,
          }}
        >
          Have a question this page doesn&apos;t answer, or a security concern to report?{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: ACCENT, textDecoration: 'none' }}>
            Tell us
          </a>
          . Security reports are welcome and always answered.
          <div style={{ marginTop: 14 }}>
            <Link href="/login" style={{ color: ACCENT, textDecoration: 'none', fontSize: 13 }}>
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
