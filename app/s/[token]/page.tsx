/**
 * A published case study, as a stranger sees it.
 *
 * Server rendered, so the content is in the page when it arrives. Somebody
 * deciding whether to hire you should not be looking at a spinner, and this is
 * a page that wants to be readable by a search engine as well as a person.
 *
 * Quiet on purpose: no navigation, no sign-in, no product branding competing
 * with the work. The page is about the client, not about the tool that stored
 * it.
 *
 * Claims arrive already filtered. The database excludes anything unsourced,
 * which is why there is no check for it here.
 */

import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const INK = '#14161A';
const BODY = '#3A424C';
const MUTED = '#69727D';
const RULE = '#E4E7EB';

interface Claim {
  claim: string;
  source: string | null;
  dated: string | null;
  status: 'sourced' | 'estimated';
}

interface Study {
  client: string;
  title: string;
  summary: string | null;
  sector: string | null;
  year: string | null;
  roles: string[];
  situation: string | null;
  approach: string | null;
  execution: string | null;
  enablement: string | null;
  outcome: string | null;
  claims: Claim[];
  org: { name: string };
}

const MOVEMENTS: Array<[keyof Study, string]> = [
  ['situation', 'The situation'],
  ['approach', 'The approach'],
  ['execution', 'What shipped'],
  ['enablement', 'What the team got'],
  ['outcome', 'What happened'],
];

export async function generateMetadata({ params }: { params: { token: string } }) {
  const study = await read(params.token);
  if (!study) return { title: 'Case study' };
  return {
    title: `${study.client}: ${study.title}`,
    description: study.summary ?? undefined,
  };
}

async function read(token: string): Promise<Study | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { data } = await supabase.rpc('read_case_study', { token });
  return (data as Study | null) ?? null;
}

export default async function CaseStudyPage({ params }: { params: { token: string } }) {
  const study = await read(params.token);

  if (!study) {
    return (
      <main style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <h1 style={{ fontSize: 19, fontWeight: 600, color: INK, margin: '0 0 10px' }}>
            This link isn&apos;t available
          </h1>
          <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.65, margin: 0 }}>
            It may have been taken down, or the address may be wrong.
          </p>
        </div>
      </main>
    );
  }

  const meta = [study.sector, study.year].filter(Boolean).join(' · ');

  return (
    <main style={{ minHeight: '100vh', background: '#fff', padding: '56px 24px 96px' }}>
      <article style={{ maxWidth: 680, margin: '0 auto' }}>

        <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, fontWeight: 600, marginBottom: 18 }}>
          Case study
        </div>

        <h1 style={{ fontSize: 'clamp(30px, 5vw, 44px)', lineHeight: 1.12, letterSpacing: '-0.02em', color: INK, fontWeight: 600, margin: '0 0 6px' }}>
          {study.client}
        </h1>
        <div style={{ fontSize: 'clamp(19px, 3vw, 24px)', lineHeight: 1.25, color: BODY, fontWeight: 400, marginBottom: 20 }}>
          {study.title}
        </div>

        {study.summary && (
          <p style={{ fontSize: 18, lineHeight: 1.6, color: BODY, margin: '0 0 24px' }}>
            {study.summary}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 26, borderBottom: `1px solid ${RULE}`, marginBottom: 34 }}>
          {(study.roles ?? []).map((r) => (
            <span
              key={r}
              style={{
                fontSize: 13,
                color: BODY,
                background: '#F4F5F7',
                borderRadius: 20,
                padding: '5px 12px',
              }}
            >
              {r}
            </span>
          ))}
          {meta && (
            <span style={{ fontSize: 13, color: MUTED, marginLeft: 'auto', alignSelf: 'center' }}>
              {meta}
            </span>
          )}
        </div>

        {MOVEMENTS.map(([key, label]) => {
          const body = study[key] as string | null;
          if (!body?.trim()) return null;
          return (
            <section key={key} style={{ marginBottom: 34 }}>
              <h2 style={{ fontSize: 12, letterSpacing: '0.11em', textTransform: 'uppercase', color: MUTED, fontWeight: 600, margin: '0 0 10px' }}>
                {label}
              </h2>
              <p style={{ fontSize: 17, lineHeight: 1.7, color: BODY, margin: 0, whiteSpace: 'pre-wrap' }}>
                {body}
              </p>
            </section>
          );
        })}

        {study.claims.length > 0 && (
          <section style={{ borderTop: `1px solid ${RULE}`, paddingTop: 30 }}>
            <h2 style={{ fontSize: 12, letterSpacing: '0.11em', textTransform: 'uppercase', color: MUTED, fontWeight: 600, margin: '0 0 14px' }}>
              Results
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {study.claims.map((c, i) => (
                <div key={i}>
                  <div style={{ fontSize: 17, lineHeight: 1.6, color: INK }}>
                    {c.claim}
                    {c.status === 'estimated' && (
                      <span style={{ fontSize: 14, color: MUTED }}> (estimated)</span>
                    )}
                  </div>
                  {/* The source, shown rather than kept internally. A number
                      you are willing to attribute reads as a number you
                      checked, and the ones you cannot attribute are not on
                      this page at all. */}
                  {c.source && (
                    <div style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>
                      {[c.source, c.dated].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${RULE}`, fontSize: 13.5, color: MUTED }}>
          {study.org.name}
        </div>
      </article>
    </main>
  );
}
