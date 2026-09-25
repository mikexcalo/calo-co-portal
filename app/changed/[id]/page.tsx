'use client';

/**
 * What the studio changed, for the person whose business it was.
 *
 * The notice on Home says "he changed 1 line on the Kinney Ave estimate". This
 * is the receipt behind that sentence, and it exists because a summary nobody
 * can open is a claim rather than a record.
 *
 * Every row here was written at the moment of the write, by the same wrapper
 * that refuses writes in View mode. Nothing on this page is reconstructed from
 * timestamps afterwards, which matters: a reconstruction is a guess, and this
 * particular guess would be a guess about somebody else's money.
 *
 * Readable by the workspace, which is both sides. The client checks what was
 * done to them; the studio checks what it did. Same page, same rows, no
 * version of events that only one party can see.
 */

import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/lib/spine/org';
import supabase from '@/lib/supabase';
import { entityWords, type Change } from '@/lib/spine/workin';
import { C, Card, Empty, Page, SectionLabel } from '@/components/spine/ui';

interface Session {
  id: string;
  granted_at: string;
  ended_at: string | null;
  revoked_at: string | null;
  granted_by: string | null;
  can_send: boolean;
}

export default function ChangedPage({ params }: { params: { id: string } }) {
  const { org } = useOrg();
  const [session, setSession] = useState<Session | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [actor, setActor] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const g = await supabase
      .from('work_grants')
      .select('id, granted_at, ended_at, revoked_at, granted_by, can_send, granted_to')
      .eq('id', params.id)
      .maybeSingle();

    const row = g.data as (Session & { granted_to: string }) | null;
    setSession(row);

    if (row) {
      const [c, p] = await Promise.all([
        supabase
          .from('work_changes')
          .select('entity, entity_id, action, label, at')
          .eq('grant_id', row.id)
          .order('at', { ascending: false }),
        supabase.from('profiles').select('full_name').eq('id', row.granted_to).maybeSingle(),
      ]);
      setChanges(((c.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        entity: String(r.entity),
        entityId: (r.entity_id as string | null) ?? null,
        action: String(r.action),
        label: (r.label as string | null) ?? null,
        at: String(r.at),
      })));
      const whole = ((p.data as { full_name?: string } | null)?.full_name ?? '').trim();
      setActor(whole ? whole.split(/\s+/)[0] : 'They');
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Page title="What changed"><Card><Empty>Loading…</Empty></Card></Page>;

  if (!session) {
    return (
      <Page title="What changed">
        <Card>
          <Empty>
            That session is not on this workspace. If you were sent this link by
            somebody else, ask them to open it from their own account.
          </Empty>
        </Card>
      </Page>
    );
  }

  const asked = Boolean(session.granted_by);
  const when = new Date(session.granted_at);
  const ended = session.ended_at ? new Date(session.ended_at) : null;

  /* Grouped by what was touched, because eighteen identical lines reading
     "estimate line changed" answer nothing that one line and a count does
     not. */
  const byEntity = new Map<string, Change[]>();
  for (const c of changes) byEntity.set(c.entity, [...(byEntity.get(c.entity) ?? []), c]);

  return (
    <Page
      title="What changed"
      subtitle={
        asked
          ? `${actor} worked in ${org?.name ?? 'your workspace'} because you asked.`
          : `${actor} worked in ${org?.name ?? 'your workspace'}.`
      }
    >
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: 'grid', gap: 6, fontSize: 13.5 }}>
          <Row k="Started" v={when.toLocaleString()} />
          <Row k="Finished" v={ended ? ended.toLocaleString() : 'Still open'} />
          <Row k="Could send to your customers" v={session.can_send ? 'Yes, you allowed it' : 'No'} />
          {session.revoked_at && <Row k="You stopped it" v={new Date(session.revoked_at).toLocaleString()} />}
        </div>
      </Card>

      {changes.length === 0 ? (
        <Card>
          {/* A real answer, and the commonest one. Looking is not changing. */}
          <Empty>Nothing was changed.</Empty>
        </Card>
      ) : (
        <>
          <SectionLabel>{changes.length} change{changes.length === 1 ? '' : 's'}</SectionLabel>
          <Card>
            <div style={{ display: 'grid', gap: 10 }}>
              {[...byEntity.entries()].map(([entity, rows]) => (
                <div key={entity} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 9 }}>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>
                    {rows.length} {entityWords(entity, rows.length)}
                  </div>
                  <div style={{ fontSize: 12.5, color: C.faint, marginTop: 3 }}>
                    {rows[0].label ? `${rows[0].label} · ` : ''}
                    last at {new Date(rows[0].at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </Page>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: C.faint }}>{k}</span>
      <span style={{ color: C.text }}>{v}</span>
    </div>
  );
}
