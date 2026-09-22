'use client';

/**
 * Telling us what is wrong with this.
 *
 * The box already existed at the foot of the home screen, which is where
 * Marcie found it — and she is the only person who ever did. Something a beta
 * depends on cannot be a thing you happen to scroll past.
 *
 * Same table, same replies. What is new is that it has an address, and that
 * everything you have sent is on one screen with whatever came back.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { human } from '@/lib/spine/errors';
import { TellUs } from '@/components/spine/TellUs';
import { C, Card, Empty, Page, Pill, SectionLabel, shortDate } from '@/components/spine/ui';

interface Note {
  id: string;
  kind: string;
  body: string;
  status: string;
  reply: string | null;
  page: string | null;
  created_at: string;
}

const SAID: Record<string, string> = {
  open: 'Waiting on us',
  building: 'We are on it',
  done: 'Done',
  wont: 'Not doing it',
};

export default function FeedbackPage() {
  const { org } = useOrg();
  const [rows, setRows] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id;
    if (!me) { setLoading(false); return; }

    const res = await supabase
      .from('feedback')
      .select('id, kind, body, status, reply, page, created_at')
      .eq('org_id', org.id)
      .eq('author_id', me)
      .order('created_at', { ascending: false })
      .limit(50);
    if (res.error) setError(human(res.error));
    setRows((res.data ?? []) as Note[]);
    setLoading(false);
  }, [org?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <Page
      title="Tell us"
      subtitle="Anything broken, confusing, or missing. It reaches us directly."
    >
      <div style={{ display: 'grid', gap: 18, maxWidth: 760 }}>
        <TellUs />

        <div>
          <SectionLabel>What you have sent</SectionLabel>
          {error && <p style={{ fontSize: 12.5, color: C.red, margin: '8px 0 0' }}>{error}</p>}

          {loading ? (
            <Empty>Loading…</Empty>
          ) : rows.length === 0 ? (
            <Card>
              <Empty>
                Nothing yet. If something is wrong or missing, the box above is the fastest
                way to reach us, it comes through with the screen you were on.
              </Empty>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {rows.map((r) => (
                <Card key={r.id}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <Pill tone={r.status === 'done' ? 'green' : r.status === 'wont' ? 'neutral' : 'amber'}>
                      {SAID[r.status] ?? r.status}
                    </Pill>
                    <span style={{ fontSize: 12.5, color: C.faint }}>{r.kind}</span>
                    {r.page && <span style={{ fontSize: 12, color: C.faint }}>{r.page}</span>}
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 11.5, color: C.faint }}>{shortDate(r.created_at)}</span>
                  </div>

                  <div style={{ fontSize: 14, color: C.text, marginTop: 8, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {r.body}
                  </div>

                  {r.reply && (
                    <div
                      style={{
                        marginTop: 10, paddingLeft: 12, borderLeft: `2px solid ${C.border}`,
                        fontSize: 13.5, color: C.dim, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                      }}
                    >
                      {r.reply}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
