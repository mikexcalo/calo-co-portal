'use client';

/**
 * Who else can change things in here, and the button that stops them.
 *
 * `revokeGrant` shipped with the feature and nothing ever called it. The
 * client was told "you can take this back at any time" on the way in and then
 * given nowhere to do it, which made the sentence true in the database and
 * false on the screen.
 *
 * Standing grants turn that from untidy into serious. A permission with no
 * end date and no visible off switch is not a permission somebody gave, it is
 * a key somebody kept. So the list is plain: who, what they can do, since
 * when, and Revoke.
 *
 * Revoking is not a door slamming, and the copy says so. The studio can still
 * ask, or start a session of its own - the loud kind, where the client is
 * told every time. Taking back a standing grant means "check with me first",
 * not "never again", and somebody deciding whether to press it deserves to
 * know that before they press it rather than after.
 */

import { useCallback, useEffect, useState } from 'react';
import { liveGrants, revokeGrant, type LiveGrant } from '@/lib/spine/workin';
import { Confirm } from './Confirm';
import { Button, C, Card, Pill, SectionLabel, radius } from './ui';

export function WhoCanWorkInThis({ orgId }: { orgId: string | null }) {
  const [grants, setGrants] = useState<LiveGrant[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<LiveGrant | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      setGrants(await liveGrants(orgId));
    } catch {
      /* Never an empty list on a failed read. "Nobody can work in this" is
         the single most reassuring thing this card can say and the one thing
         it must not say without knowing. */
      setFailed(true);
    }
  }, [orgId]);

  useEffect(() => { void load(); }, [load]);

  const revoke = async () => {
    if (!confirming) return;
    setBusy(true);
    await revokeGrant(confirming.id);
    setBusy(false);
    setConfirming(null);
    await load();
  };

  if (!orgId) return null;

  return (
    <div style={{ marginTop: 26 }}>
      <SectionLabel>Who can work in this</SectionLabel>
      <Card>
        {failed ? (
          <p style={{ fontSize: 14.5, color: C.dim, lineHeight: 1.7, margin: 0 }}>
            This list didn&rsquo;t load, so it isn&rsquo;t showing who has access. Nothing has
            changed either way. Reload the page to try again.
          </p>
        ) : grants === null ? (
          <div className="skel" style={{ height: 44, borderRadius: radius.md }} />
        ) : grants.length === 0 ? (
          <p style={{ fontSize: 14.5, color: C.dim, lineHeight: 1.7, margin: 0 }}>
            Nobody outside your team can change anything in here. If your studio needs to,
            they&rsquo;ll ask, and you decide then.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {grants.map((g) => (
              <div
                key={g.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                  paddingBottom: 12, borderBottom: `1px solid ${C.border}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text, marginBottom: 3 }}>
                    {g.who}
                  </div>
                  <div style={{ fontSize: 13.5, color: C.dim }}>
                    {g.standing
                      ? 'Can work in this whenever, until you stop it'
                      : `Since ${new Date(g.grantedAt).toLocaleDateString(undefined, {
                          day: 'numeric', month: 'long',
                        })}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                  {g.canEdit && <Pill tone="neutral">Can edit</Pill>}
                  <Pill tone={g.canSend ? 'neutral' : 'amber'}>
                    {g.canSend ? 'Can send' : "Can't send"}
                  </Pill>
                </div>
                <Button variant="ghost" onClick={() => setConfirming(g)}>
                  Take it back
                </Button>
              </div>
            ))}
            <p style={{ fontSize: 13.5, color: C.faint, lineHeight: 1.7, margin: 0 }}>
              You&rsquo;re told what changed either way, every time.
            </p>
          </div>
        )}
      </Card>

      {confirming && (
        <Confirm
          title={`Take back ${confirming.who}'s access?`}
          body={
            `${confirming.who} won't be able to change anything in here until you let them ` +
            `back in. Nothing they've already done is undone. They can still ask, and you ` +
            `decide each time.`
          }
          confirmLabel="Take it back"
          busy={busy}
          onConfirm={revoke}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
