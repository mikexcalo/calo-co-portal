'use client';

/**
 * Settings — account only. Anything about a *business* (rates, markup, tax,
 * brand) lives on /business, because those are per-business and this is not.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { Button, C, Card, Empty, Page, Pill, SectionLabel } from '@/components/spine/ui';

export default function SettingsPage() {
  const router = useRouter();
  const { org, orgs } = useOrg();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data?.user?.email ?? null);
      setLoading(false);
    })();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <Page title="Settings" subtitle="Your account. Business settings live under Business.">
      {loading ? (
        <Empty>Loading…</Empty>
      ) : (
        <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
          <Card>
            <SectionLabel>Signed in as</SectionLabel>
            <div style={{ fontSize: 14 }}>{email ?? 'Not signed in'}</div>
          </Card>

          <Card>
            <SectionLabel>Businesses you belong to</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orgs.map((o) => (
                <div
                  key={o.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}
                >
                  <span
                    style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: o.kind === 'agency' ? C.blue : C.green,
                    }}
                  />
                  <span style={{ flex: 1 }}>{o.name}</span>
                  {o.id === org?.id && <Pill tone="blue">Active</Pill>}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 12 }}>
              Switch between them from the top of the sidebar.
            </div>
          </Card>

          <Card>
            <SectionLabel>Session</SectionLabel>
            <Button variant="danger" onClick={signOut}>Sign out</Button>
          </Card>
        </div>
      )}
    </Page>
  );
}
