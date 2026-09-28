'use client';

/**
 * Showing the studio out.
 *
 * The one thing owning your own workspace adds. Everything else the studio
 * does here - opening it, editing under a grant, View mode, the change log -
 * is unchanged by who holds `owner`, because every check in the product asks
 * for `owner or admin` and the client already had admin.
 *
 * It sits under "Who can work in this", because that card answers the same
 * question one step less finally: Revoke ends a session, this ends the
 * arrangement. Only the workspace's own owner sees it, and only where a
 * studio actually holds a membership.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button, C, Card, SectionLabel } from './ui';
import { Confirm } from './Confirm';
import { human } from '@/lib/spine/errors';
import { removeStudio, studioRemovable, studioFor, type Studio } from '@/lib/spine/workin';

export function RemoveStudio({ orgId, onDone }: { orgId: string | null; onDone?: () => void }) {
  const [state, setState] = useState<{ allowed: boolean; studioMembers: number } | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [s, who] = await Promise.all([studioRemovable(orgId), studioFor(orgId)]);
      setState(s);
      setStudio(who.studio);
    } catch {
      /* A card about ending an arrangement must not appear because a read
         failed. Silence is the safe direction here. */
      setState({ allowed: false, studioMembers: 0 });
    }
  }, [orgId]);

  useEffect(() => { void load(); }, [load]);

  const go = async () => {
    if (!orgId) return;
    setBusy(true);
    setError(null);
    try {
      await removeStudio(orgId);
      setGone(true);
      setAsking(false);
      await load();
      onDone?.();
    } catch (e) {
      setError(human(e));
    } finally {
      setBusy(false);
    }
  };

  if (!orgId || !state) return null;
  if (gone) {
    return (
      <Card style={{ marginTop: 14 }}>
        <div style={{ fontSize: 13.5, color: C.green, lineHeight: 1.6 }}>
          They are out. Their access ended and every live session with it. Nothing
          they wrote has been removed: the work is yours and it stays.
        </div>
      </Card>
    );
  }
  if (!state.allowed || state.studioMembers === 0) return null;

  const name = studio?.name ?? 'the studio that set this up';

  return (
    <div style={{ marginTop: 22 }}>
      <SectionLabel>Ending the arrangement</SectionLabel>
      <Card>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6, maxWidth: '62ch' }}>
          This workspace is yours. You can remove {name} from it, which ends every
          way they reach it: their access, any standing permission to work in it,
          and any session open right now.
        </div>
        <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.6, marginTop: 8, maxWidth: '62ch' }}>
          Everything they have written stays. What you lose is the help: nobody
          will be able to set up a module, fix something for you or answer Get
          help until you ask them back.
        </div>
        {error && (
          <div style={{ fontSize: 13, color: C.red, marginTop: 10, lineHeight: 1.6 }}>{error}</div>
        )}
        <div style={{ marginTop: 14 }}>
          <Button variant="danger" onClick={() => setAsking(true)}>
            Remove {name}
          </Button>
        </div>
      </Card>

      {asking && (
        <Confirm
          title={`Remove ${name}?`}
          body={
            `They lose access to this workspace immediately, along with any standing ` +
            `permission and any session open now. Everything they have written stays. ` +
            `You can ask them back, and they would need your permission again.`
          }
          confirmLabel="Remove them"
          busy={busy}
          onConfirm={go}
          onCancel={() => setAsking(false)}
        />
      )}
    </div>
  );
}
