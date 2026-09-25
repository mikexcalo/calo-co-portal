'use client';

/**
 * LOG AN HOUR FROM ANYWHERE.
 *
 * Billing a client for time meant opening that client, opening the job inside
 * it, finding the hours panel and typing a rate you had to remember. Four
 * screens deep for the single thing an agency does more often than anything
 * else, which means it does not get done at the time and gets reconstructed
 * from memory on the 30th. Reconstructed hours are always fewer than real
 * ones.
 *
 * So it lives in the top bar, on every screen, on a key. Who, how long, what
 * you did. The rate is already agreed so it is not asked for, the draft it
 * lands on is named before you press anything, and what comes back is the new
 * total rather than "Saved".
 *
 * The description is deliberately the same field as the invoice line. "Site
 * from 1.0 to 2.0 using John's edits" is what he did, what the client reads,
 * and what he will want to see in twelve months when somebody asks what the
 * money went on. Three uses, one sentence, typed once.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button, C, money, inputStyle, Select, Sheet } from '@/components/spine/ui';
import { createTimeEntry, listBillableJobs, orgNow } from '@/lib/spine/db';
import { human } from '@/lib/spine/errors';
import type { BillableJob } from '@/lib/spine/types';

/**
 * How long, said the way people say it.
 *
 * "30m", "1.5", "1h30", "1:30", "45min" and ".25" all mean something obvious
 * and all used to mean nothing, because the field wanted a decimal number of
 * hours. Somebody who works in minutes should not have to divide by sixty to
 * report a phone call.
 *
 * A bare number is hours when it is small enough to be hours and minutes when
 * it is not: 2 is two hours, 90 is an hour and a half. Nobody logs ninety
 * hours in one go, and if they ever do they can type 90h.
 */
export function parseDuration(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;

  const clock = t.match(/^(\d+):([0-5]\d)$/);
  if (clock) return Number(clock[1]) + Number(clock[2]) / 60;

  const both = t.match(/^(\d+)h(\d+)m?$/);
  if (both) return Number(both[1]) + Number(both[2]) / 60;

  /* \d*\.?\d+ rather than \d+(\.\d+)?, so ".25" is a quarter of something
     instead of nothing. People type the leading zero about half the time. */
  const mins = t.match(/^(\d*\.?\d+)(?:m|min|mins|minutes)$/);
  if (mins) return Number(mins[1]) / 60;

  const hrs = t.match(/^(\d*\.?\d+)(?:h|hr|hrs|hours)$/);
  if (hrs) return Number(hrs[1]);

  const bare = t.match(/^(\d*\.?\d+)$/);
  if (bare) {
    const n = Number(bare[1]);
    return n > 16 ? n / 60 : n;
  }
  return null;
}

const QUICK = ['15m', '30m', '45m', '1h', '2h'];

export default function LogTime({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const [jobs, setJobs] = useState<BillableJob[]>([]);
  const [jobId, setJobId] = useState('');
  const [dur, setDur] = useState('');
  const [what, setWhat] = useState('');
  const [day, setDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date();
    setDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    (async () => {
      try {
        const org = await orgNow();
        if (!org) return;
        const rows = await listBillableJobs(org);
        setJobs(rows);

        /*
          The job you are looking at, not the one you touched last.

          This picked rows[0] — most recently updated across the whole
          workspace — no matter where it was opened from. Open Log time on
          Costa Residence's page and the hour went to Brandt & Sons, at
          Brandt's rate, because Brandt's job had been edited more recently.
          Two clients wrong in one action: the wrong job and the wrong money.

          Nothing was passed in because the dialog lives in the top bar, so it
          reads the address instead. /jobs/<id> means that job. /customers/<id>
          means that client's most recent job. Anywhere else keeps the old
          behaviour, which is a reasonable guess when there is nothing to go on.
        */
        const onJob = pathname.match(/^\/jobs\/([0-9a-f-]{36})/i)?.[1];
        const onClient = pathname.match(/^\/customers\/([0-9a-f-]{36})/i)?.[1];

        const fromJob = onJob ? rows.find((r) => r.id === onJob) : undefined;
        const fromClient = onClient ? rows.find((r) => r.customer_id === onClient) : undefined;
        const pick = fromJob ?? fromClient ?? rows[0];
        if (pick) setJobId(pick.id);
      } catch (e) {
        setErr(human(e));
      }
    })();
  }, [pathname]);

  const job = useMemo(() => jobs.find((j) => j.id === jobId) ?? null, [jobs, jobId]);
  const hours = parseDuration(dur);
  const value = job && hours ? hours * job.rate : 0;
  const ready = Boolean(job && hours && hours > 0 && what.trim());

  const submit = useCallback(async () => {
    if (!job || !hours) return;
    setBusy(true);
    setErr('');
    try {
      const org = await orgNow();
      if (!org) throw new Error('No workspace is open.');
      await createTimeEntry(org, job.id, {
        worked_on: day,
        hours,
        rate: job.rate,
        description: what.trim(),
      });
      /*
        Say what it did to the money.

        "Saved" tells you the click registered. The reason anybody logs an hour
        is so it gets paid for, so the confirmation is the bill: the draft it
        joined and what that draft now comes to. createTimeEntry syncs the open
        draft, so by the time this runs the number is already true.
      */
      const after = await listBillableJobs(org);
      const now = after.find((j) => j.id === job.id);
      setDone(
        now?.draft_number
          ? `${fmtHours(hours)} on ${job.customer_name ?? job.name}. ${now.draft_number} is now ${money(now.draft_total ?? 0)}.`
          : `${fmtHours(hours)} on ${job.customer_name ?? job.name}, ${money(hours * job.rate)}. It goes on the invoice drafted on the 1st.`
      );
      setDur('');
      setWhat('');
    } catch (e) {
      setErr(human(e));
    } finally {
      setBusy(false);
    }
  }, [job, hours, day, what]);

  /* Was a hand-built overlay with its own backdrop and no escape key. I wrote
     it yesterday and copied the numbers out of another file, which is exactly
     the drift the audit found. */
  return (
    <Sheet title="Log time" onClose={onClose}>
      <>
        {done ? (
          <>
            <div style={{ fontSize: 14.5, color: C.text, lineHeight: 1.6, marginBottom: 16 }}>{done}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Button onClick={() => setDone(null)}>Log another</Button>
              <button onClick={onClose} style={linkBtn}>Done</button>
            </div>
          </>
        ) : (
          <>
            <Field label="Who">
              <Select
                value={jobId}
                onChange={setJobId}
                options={jobs.map((j) => ({
                  value: j.id,
                  label: j.customer_name ? `${j.customer_name} · ${j.name}` : j.name,
                }))}
              />
            </Field>

            <Field label="How long">
              <input
                value={dur}
                onChange={(e) => setDur(e.target.value)}
                placeholder="30m, 1.5, 1h30"
                autoFocus
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => setDur(q)}
                    style={{
                      background: dur === q ? C.accentSoft : 'transparent',
                      border: `1px solid ${C.border}`, borderRadius: 999,
                      padding: '4px 11px', fontSize: 12.5, cursor: 'pointer',
                      color: dur === q ? C.accent : C.dim, fontFamily: 'inherit',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="What you did">
              <input
                value={what}
                onChange={(e) => setWhat(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && ready && !busy) submit(); }}
                placeholder="Site from 1.0 to 2.0 using John's edits"
                style={inputStyle}
              />
              {/* Not a note to self. It is the line on the invoice. */}
              <div style={{ fontSize: 12, color: C.faint, marginTop: 6 }}>
                This is the line they will read on the invoice.
              </div>
            </Field>

            <Field label="When">
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} style={inputStyle} />
            </Field>

            {/*
              What it is worth, before you commit to it.

              A rate somebody has forgotten is a rate they are about to get
              wrong, and a zero rate is worth saying out loud rather than
              discovering on the invoice.
            */}
            {job && (
              <div style={{ fontSize: 12.5, color: job.rate > 0 ? C.faint : C.amber, marginTop: 2, lineHeight: 1.6 }}>
                {job.rate > 0 ? (
                  <>
                    {money(job.rate)} an hour{hours ? <> · <span style={{ color: C.text }}>{money(value)}</span></> : null}
                    {job.draft_number ? ` · joins ${job.draft_number}` : ' · goes on the invoice drafted on the 1st'}
                  </>
                ) : (
                  <>No hourly rate is set for this client, so this would log at $0. Set one on their terms first.</>
                )}
              </div>
            )}

            {err && <div style={{ fontSize: 13, color: C.red, marginTop: 12 }}>{err}</div>}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 18 }}>
              <Button disabled={!ready || busy} onClick={submit}>
                {busy ? 'Logging…' : 'Log it'}
              </Button>
              <button onClick={onClose} style={linkBtn}>Cancel</button>
            </div>
          </>
        )}
      </>
    </Sheet>
  );
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} minutes`;
  if (Number.isInteger(h)) return `${h} hour${h === 1 ? '' : 's'}`;
  return `${h.toFixed(2).replace(/0$/, '')} hours`;
}

const linkBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', padding: 0, color: C.faint,
  fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 12.5, color: C.dim, marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}
