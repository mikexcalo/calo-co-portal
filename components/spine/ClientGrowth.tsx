'use client';

/**
 * Getting a client found, as a checklist against that client.
 *
 * The same work Digital does for CALO&CO, pointed at somebody else: get their
 * site into Search Console, submit the sitemap, claim the map listing, turn
 * the review link on. It existed only as a 13px text link called "Search
 * setup" sitting in a row of links, beside one called "Their site" that opened
 * their homepage — so it read as a reference, not as work with a next step.
 *
 * Progress is stored in seo_tasks against (org_id, customer_id, key). That
 * column has been on the table since it was built and nothing had ever
 * written to it, because every screen that used seo_tasks passed
 * customer_id: null.
 *
 * This is also the answer to "what am I paying for". Every ticked line is
 * something done for them that they can be shown.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { save as saveOrFail } from '@/lib/spine/save';
import { orgNow } from '@/lib/spine/db';
import { Button, C, Card, SectionLabel, inputStyle, radius } from './ui';

interface Step {
  key: string;
  do: string;
  /**
   * Whose job it is.
   *
   * Most of this is work you do for them. Two bits are not: Google posts the
   * verification card to their address, and the review link comes out of a
   * profile only they are signed into. Marking them means the handover can
   * say "here is what we did, here are the two things we need from you"
   * rather than one undifferentiated list.
   */
  theirs?: true;
  /** What they lose by not doing it. Always visible. */
  why: string;
  /** The actual clicks, if it needs them. */
  how?: string;
  link?: { label: string; href: string };
}

/**
 * The steps, in the order they pay off.
 *
 * Search Console first because it keeps no history from before you verify —
 * every day it is off is a day of data nobody can get back.
 */
function stepsFor(name: string, site: string | null): Step[] {
  const host = (site ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const domain = host || 'their domain';
  return [
    {
      key: 'gsc_verify',
      do: `Add ${domain} to Search Console`,
      why: 'It keeps no history from before the day you verify, so every day it is off is data nobody can get back.',
      how:
        '1. Open Search Console and press "Add property", top left.\n' +
        '2. Pick the LEFT box, "Domain". Not "URL prefix".\n' +
        `3. Type: ${domain} — no https://, no www.\n` +
        '4. Google gives you one long line starting google-site-verification=. Copy it.\n' +
        '5. Paste it here in chat and I will put it into DNS for you.\n' +
        '6. Come back to Google and press Verify.',
      link: { label: 'Search Console', href: 'https://search.google.com/search-console' },
    },
    {
      key: 'gsc_sitemap',
      do: 'Submit the sitemap',
      why: 'Without it Google finds pages by following links, and misses anything not linked from the homepage.',
      how:
        '1. In Search Console, left menu, Sitemaps.\n' +
        '2. Type: sitemap.xml\n' +
        '3. Press Submit. "Success" can take a day.',
    },
    {
      key: 'tag_on',
      do: 'Turn on visitor tracking',
      why: 'Numbers start the day you press it, not the day you look, so this is worth doing before anybody asks.',
      how: 'The tag is already on any site built here. Press Start collecting above.',
    },
    {
      key: 'gbp_claim',
      theirs: true,
      do: `Claim the Google Business Profile for ${name}`,
      why: 'Until somebody claims it, they do not appear in map results and anybody can edit the hours.',
      how:
        'Search the business name at business.google.com. If it is listed, press it and choose Claim this business; if not, Add your business. Verification is a postcard, about a week, so start it and do the rest while it is in the mail.',
      link: { label: 'business.google.com', href: 'https://business.google.com' },
    },
    {
      key: 'gbp_noaddress',
      do: 'Decide whether their address is published',
      why: 'Get it wrong and a home address is on the internet permanently.',
      how:
        'If customers do not come to them, answer No to "can customers visit?". Google still takes an address to verify and simply does not publish it. Saying no does not hide them from search.',
    },
    {
      key: 'nap',
      do: 'Put the same name, address and phone everywhere',
      why: 'Three slightly different spellings read to Google as three businesses that each know a third as much.',
      how: 'Search holds the block to copy, and the directories worth the time.',
      link: { label: 'Open their search setup', href: '/seo' },
    },
    {
      key: 'review_link',
      theirs: true,
      do: 'Set their review link',
      why: 'The only thing here that keeps working by itself after setup.',
      how:
        'From their profile: Read reviews, then Get more reviews, which gives a short g.page link. Once it is in, every finished, paid job asks for a review automatically.',
    },
  ];
}

export function ClientGrowth({
  customerId,
  clientName,
  website,
}: {
  customerId: string;
  clientName: string;
  website: string | null;
}) {
  const router = useRouter();
  const [ticks, setTicks] = useState<Record<string, 'done' | 'skipped' | false>>({});
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  /*
    A checklist you cannot bill and cannot hand over is a private to-do list.

    The work happens here — Search Console, the sitemap, the map listing — and
    then two things have to happen or none of it counts: the hours have to
    reach an invoice, and the client has to be told what was done and what is
    still theirs. Both used to be somewhere else entirely, so both got
    forgotten.
  */
  const [jobId, setJobId] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [telling, setTelling] = useState(false);
  const [note, setNote] = useState('');

  const steps = stepsFor(clientName, website);

  const load = useCallback(async () => {
    const org = await orgNow();
    if (!org) { setLoaded(true); return; }
    const res = await supabase
      .from('seo_tasks')
      .select('key, status')
      .eq('org_id', org)
      .eq('customer_id', customerId);
    const out: Record<string, 'done' | 'skipped' | false> = {};
    for (const r of (res.data ?? []) as Array<{ key: string; status: string }>) {
      if (r.status === 'done' || r.status === 'skipped') out[r.key] = r.status;
    }
    setTicks(out);
    setLoaded(true);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  /* Time has to land on a job, and a client usually has exactly one live. */
  useEffect(() => {
    (async () => {
      const res = await supabase
        .from('jobs')
        .select('id')
        .eq('customer_id', customerId)
        .in('status', ['won', 'active', 'estimating'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setJobId((res.data as { id?: string } | null)?.id ?? null);
    })();
  }, [customerId]);

  /* Reverts if the write fails. A checkbox that lies about saving is worse
     than one that refuses — learned the hard way on the Digital plan. */
  const tick = async (key: string, next: 'done' | 'skipped' | false) => {
    const before = ticks[key] ?? false;
    setTicks((t) => ({ ...t, [key]: next }));
    const org = await orgNow();
    if (!org) return;
    const res = await saveOrFail(
      supabase.from('seo_tasks').upsert(
        { org_id: org, customer_id: customerId, key, status: next || 'todo' },
        { onConflict: 'org_id,customer_id,key' }
      )
    );
    if (res.error) setTicks((t) => ({ ...t, [key]: before }));
  };

  /* What was done, in their words rather than ours, for both the time entry
     description and the update they read. */
  const didList = () => steps.filter((s) => ticks[s.key] === 'done' && !s.theirs).map((s) => s.do);
  const theirList = () => steps.filter((s) => s.theirs && ticks[s.key] !== 'done').map((s) => s.do);

  const logTime = async () => {
    const h = parseFloat(hours);
    if (!h || !jobId) return;
    setBusy(true);
    const did = didList();
    const res = await saveOrFail(
      supabase.from('time_entries').insert({
        org_id: await orgNow(),
        job_id: jobId,
        hours: h,
        worked_on: new Date().toISOString().slice(0, 10),
        billable: true,
        description: did.length
          ? `Search setup for ${clientName}: ${did.join('; ')}`
          : `Search setup for ${clientName}`,
      })
    );
    setBusy(false);
    if (!res.error) {
      setHours('');
      setLogging(false);
      setSaid(`${h}h on the next invoice.`);
      setTimeout(() => setSaid(''), 3500);
    }
  };

  /* Drafted from what is ticked, then editable — nobody sends a robot's
     summary of their own work, and the draft exists so the blank page does
     not stop it being sent at all. */
  const draftUpdate = () => {
    const did = didList();
    const theirs = theirList();
    const parts: string[] = [];
    parts.push(`Hi, a quick update on getting ${clientName} found on Google.`);
    if (did.length) {
      parts.push('\nDone:\n' + did.map((d) => `\u2022 ${d}`).join('\n'));
    }
    if (theirs.length) {
      parts.push(
        '\nTwo things only you can do, because Google posts the code to you ' +
        'and the review link lives inside your own profile:\n' +
        theirs.map((d) => `\u2022 ${d}`).join('\n')
      );
    }
    parts.push('\nResults take a few weeks to show. Nothing else is needed from you meanwhile.');
    setNote(parts.join('\n'));
    setTelling(true);
  };

  const tell = async () => {
    setBusy(true);
    const res = await fetch('/api/updates/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        send: true,
        subject: `Search setup for ${clientName}`,
        text: note,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setTelling(false);
      setSaid('Sent, and filed on their record.');
      setTimeout(() => setSaid(''), 3500);
    }
  };

  const done = steps.filter((s) => ticks[s.key] === 'done').length;
  const put = steps.filter((s) => ticks[s.key] === 'skipped').length;

  if (!loaded) return null;

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <SectionLabel>Getting them found</SectionLabel>
        <span style={{ fontSize: 12.5, color: done === steps.length ? C.green : C.faint, fontVariantNumeric: 'tabular-nums' }}>
          {done} of {steps.length}{put ? ` · ${put} skipped` : ''}
        </span>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {steps.map((st, i) => {
          const ticked = ticks[st.key] === 'done';
          const skipped = ticks[st.key] === 'skipped';
          const showing = open === st.key;
          return (
            <div key={st.key} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
              <div
                className="taskRow"
                style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '12px 16px', opacity: skipped ? 0.45 : 1 }}
              >
                <button
                  onClick={() => tick(st.key, ticked ? false : 'done')}
                  aria-label={ticked ? 'Done' : `Mark "${st.do}" done`}
                  style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1.5px solid ${ticked ? C.green : C.borderStrong}`,
                    background: ticked ? C.green : 'transparent',
                    color: '#fff', fontSize: 11, lineHeight: 1, cursor: 'pointer', padding: 0,
                  }}
                >
                  {ticked ? '✓' : ''}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14, color: ticked ? C.faint : C.text,
                      textDecoration: ticked ? 'line-through' : 'none',
                      textDecorationColor: C.border,
                    }}
                  >
                    {st.do}
                    {/* Google posts the code to them and the review link is
                        inside their own profile. Saying so on the row stops
                        two steps sitting unticked looking like your fault. */}
                    {st.theirs && (
                      <span
                        style={{
                          marginLeft: 8, fontSize: 10.5, color: C.amber,
                          border: `1px solid ${C.amber}55`, borderRadius: 4,
                          padding: '1px 5px', textDecoration: 'none',
                          display: 'inline-block', verticalAlign: 'middle',
                        }}
                      >
                        needs them
                      </span>
                    )}
                  </div>
                  {!ticked && !skipped && (
                    <div style={{ fontSize: 12.5, color: C.faint, marginTop: 3, lineHeight: 1.5 }}>
                      {st.why}
                    </div>
                  )}
                  {showing && st.how && (
                    <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.7, marginTop: 7, maxWidth: '58ch', whiteSpace: 'pre-line' }}>
                      {st.how}
                    </div>
                  )}
                  {showing && st.link && (
                    <div style={{ marginTop: 9 }}>
                      {st.link.href.startsWith('http') ? (
                        <a href={st.link.href} target="_blank" rel="noreferrer noopener" style={{ fontSize: 13, color: C.blue, textDecoration: 'none' }}>
                          {st.link.label} ↗
                        </a>
                      ) : (
                        <button
                          onClick={() => router.push(`${st.link!.href}?client=${customerId}`)}
                          style={{ background: 'transparent', border: 'none', padding: 0, fontSize: 13, color: C.blue, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          {st.link.label} →
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <span className="rowActions" style={{ flexShrink: 0 }}>
                  {st.how && (
                    <button onClick={() => setOpen(showing ? null : st.key)} className="rowBtn rowBtnWide">
                      {showing ? 'Less' : 'How'}
                    </button>
                  )}
                  <button
                    onClick={() => tick(st.key, ticks[st.key] ? false : 'skipped')}
                    className="rowBtn rowBtnWide"
                    title={skipped ? 'Put it back on the list' : 'Not for this client'}
                  >
                    {skipped ? 'Undo' : 'Skip'}
                  </button>
                </span>
              </div>
            </div>
          );
        })}
      </Card>

      {/*
        The two things that turn a checklist into a piece of work you did.

        Bill it, and tell them. Both used to live on other screens, which is
        why setup got done and then neither happened.
      */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {jobId && !logging && (
          <Button variant="ghost" onClick={() => setLogging(true)}>Bill this work</Button>
        )}
        {done > 0 && !telling && (
          <Button variant="ghost" onClick={draftUpdate}>Tell them what&apos;s done</Button>
        )}
        <Button variant="ghost" onClick={() => router.push(`/seo?client=${customerId}`)}>
          Address block and directories
        </Button>
        {said && <span style={{ fontSize: 12.5, color: C.green }}>{said}</span>}
      </div>

      {logging && (
        <Card style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 9, lineHeight: 1.55, maxWidth: '54ch' }}>
            Goes on their next invoice at their rate, described by what is ticked above,
            so the line says what they are paying for.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') logTime(); }}
              placeholder="Hours, e.g. 1.5"
              inputMode="decimal"
              autoFocus
              style={{ ...inputStyle, maxWidth: 150 }}
            />
            <Button onClick={logTime} disabled={busy || !parseFloat(hours)}>
              {busy ? 'Saving…' : 'Add to their invoice'}
            </Button>
            <Button variant="ghost" onClick={() => setLogging(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {telling && (
        <Card style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 9, lineHeight: 1.55, maxWidth: '54ch' }}>
            Drafted from what is ticked. Edit it — nobody should send a summary of their
            own work that they did not write.
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={11}
            style={{ ...inputStyle, minHeight: 210, lineHeight: 1.65, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <Button onClick={tell} disabled={busy || !note.trim()}>
              {busy ? 'Sending…' : 'Send it'}
            </Button>
            <Button variant="ghost" onClick={() => setTelling(false)}>Cancel</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
