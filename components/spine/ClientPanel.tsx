'use client';

/**
 * The column the client will never see.
 *
 * It sits outside the framed workspace on purpose. Everything inside the blue
 * frame is theirs — their sidebar, their words, their numbers — and everything
 * in this column is yours. Putting a studio note inside their screen, however
 * neatly, would undo the one thing the frame is for.
 *
 * Three cards, and one rule running through all of them: a line appears only
 * when a column exists and is filled in. No card is padded to look complete,
 * and an empty card does not render at all. The panel can legitimately be
 * empty, which is what a brand-new workspace looks like, and that is a truer
 * screen than three headings over invented content.
 *
 * The reason is practical rather than tasteful. The point of this column is to
 * let somebody pick up the phone and say a true thing. One sentence that turns
 * out to have been generated from nothing costs more than the silence it
 * replaced, and it costs it in front of a client.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/spine/org';
import { useViewAs } from '@/lib/spine/viewas';
import {
  clientOwner,
  clientSetup,
  clientUsage,
  sinceWords,
  worthAWord,
  type Setup,
  type Usage,
} from '@/lib/spine/client-view';
import { MODULE_LABEL, modulesFor } from '@/lib/spine/modules';
import type { ModuleId } from '@/lib/spine/modules';
import supabase from '@/lib/supabase';
import { C, radius, useIsPhone } from './ui';

export function ClientPanel() {
  const { org, orgs, switchOrg } = useOrg();
  const { setViewAs } = useViewAs();
  const router = useRouter();
  const phone = useIsPhone();

  const [usage, setUsage] = useState<Usage | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      if (!org?.id) return;
      setReady(false);
      const { data: session } = await supabase.auth.getSession();
      const me = session.session?.user?.id ?? null;

      const [u, w, o] = await Promise.all([
        clientUsage(org),
        worthAWord(org),
        clientOwner(org.id, me),
      ]);
      if (off) return;
      setUsage(u);
      setNotes(w);
      setOwnerName(o?.firstName ?? null);
      setSetup(clientSetup(org));
      setReady(true);
    })();
    return () => { off = true; };

    function setOwnerName(n: string | null) { setFirstName(n); }
  }, [org?.id]);

  if (!org) return null;

  const live = modulesFor(org);
  const label = (id: ModuleId) => MODULE_LABEL[id];

  const usageLines: Array<[string, string, boolean]> = [];
  if (usage) {
    const last = sinceWords(usage.lastAt);
    if (last) usageLines.push(['Last signed in', last, false]);
    if (usage.usedThisWeek.length) {
      usageLines.push(['Used this week', usage.usedThisWeek.map(label).join(', '), false]);
    }
    if (usage.neverOpened.length) {
      usageLines.push([
        'Never opened',
        usage.neverOpened.slice(0, 4).map(label).join(', ') +
          (usage.neverOpened.length > 4 ? ` +${usage.neverOpened.length - 4}` : ''),
        true,
      ]);
    }
  }

  return (
    <aside
      style={{
        /* Beside the workspace on a desktop, underneath it on a phone,
           where 316px next to a 212px sidebar is neither. */
        width: phone ? 'auto' : 316,
        flexShrink: 0,
        background: C.panel, borderRadius: radius.lg,
        padding: '16px 16px 20px',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.09em',
          color: C.faint, fontWeight: 600,
        }}
      >
        Only you see this
      </div>

      {usageLines.length > 0 && (
        <Card title="Are they using it?">
          {usageLines.map(([k, v, warn]) => (
            <div
              key={k}
              style={{
                display: 'flex', justifyContent: 'space-between', gap: 12,
                fontSize: 13.5, padding: '3px 0', alignItems: 'baseline',
              }}
            >
              <span style={{ color: C.faint, flexShrink: 0 }}>{k}</span>
              <span style={{ color: warn ? C.amber : C.text, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </Card>
      )}

      {notes.length > 0 && (
        <Card title={firstName ? `Worth a word with ${firstName}` : 'Worth a word'}>
          {notes.map((n) => (
            <p
              key={n}
              style={{ fontSize: 13.5, color: C.text, margin: '0 0 8px', lineHeight: 1.45 }}
            >
              {n}
            </p>
          ))}
        </Card>
      )}

      {setup && (
        <Card title="Their setup">
          {/*
            Zero is a different sentence, not a number with a noun after it.

            "0 modules live" reads as an empty workspace, and Blank Co is not
            one: fourteen parts of it are visible to whoever signs in. What is
            zero is the number the STUDIO has switched on, because nobody has
            made a decision yet and everything is following the plan. Saying
            that is one word longer and does not mislead.
          */}
          <div style={{ fontSize: 13.5, color: C.dim }}>
            {setup.kind} &middot;{' '}
            {setup.live === 0
              ? 'nothing switched on yet'
              : `${setup.live} module${setup.live === 1 ? '' : 's'} live`}
          </div>
          {setup.nextToSell && (
            <div style={{ fontSize: 13.5, color: C.text, marginTop: 4 }}>
              Next to sell: {setup.nextToSell}
            </div>
          )}
          {/*
            Not a link, because /access is not reachable from here.

            Client modules is a studio screen, and the route guard refuses it
            in a workspace whose kind is not 'agency' — correctly, since a
            contractor has no business handing out seats. So a plain href from
            inside a client's workspace lands on "This part is switched off".

            It leaves View mode, goes back to the studio, and then opens the
            screen. Three steps, one press, which is what the words promise.
          */}
          <button
            onClick={async () => {
              setViewAs(null);
              const studio = orgs.find((o) => o.kind === 'agency');
              if (studio && studio.id !== org.id) await switchOrg(studio.id);
              router.push('/access');
            }}
            style={{
              display: 'inline-block', marginTop: 8, padding: 0,
              background: 'transparent', border: 'none', fontFamily: 'inherit',
              fontSize: 13.5, color: C.text, textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Open client modules
          </button>
        </Card>
      )}

      {/*
        Nothing to say is a real answer.

        A brand-new workspace has no activity, no overdue anything and no
        hours, and three empty headings would read as something failing to
        load. This says which it is, once, and only after the reads are back.
      */}
      {ready && usageLines.length === 0 && notes.length === 0 && (
        <div style={{ fontSize: 13, color: C.faint, lineHeight: 1.5 }}>
          Nothing to report yet. {live.size === 0 ? 'No modules are switched on.' : 'No activity, and nothing overdue.'}
        </div>
      )}
    </aside>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        border: `1px solid ${C.border}`, borderRadius: radius.lg,
        padding: '13px 14px 14px', background: C.panel,
      }}
    >
      <h2 style={{ fontSize: 14.5, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{title}</h2>
      {children}
    </section>
  );
}
