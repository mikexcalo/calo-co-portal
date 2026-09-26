'use client';

/**
 * Logging hours with one hand, standing up.
 *
 * The desktop version asks for a duration as text - "1h30", "45m", ".25" -
 * and that is the right control at a keyboard. On a phone it summons a
 * keypad over half the screen to enter a number that is almost always a whole
 * or half hour, and a wet thumb in a truck cab is not going to type ".5".
 *
 * So: steppers. Two taps to the right answer, no keyboard, and every target
 * is 56px so it works through a glove.
 *
 * NOT A SECOND WAY TO LOG TIME. The job list, the rate and the write are
 * `listBillableJobs` and `createTimeEntry`, the same two functions the top-bar
 * version calls. What is different here is the control, not the record: an
 * hour logged from a phone lands on the same draft invoice as one logged from
 * a desk, because it is the same row written by the same code.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createTimeEntry, listBillableJobs, orgNow } from '@/lib/spine/db';
import { human } from '@/lib/spine/errors';
import type { BillableJob } from '@/lib/spine/types';
import { localDay } from '@/lib/spine/today';
import { Button, C, money, radius, Select, Sheet } from './ui';

const HOUR_STEP = 0.5;
const MAX_HOURS = 16;
const MAX_CREW = 12;

/** "4" and "4.5", never "4.0". */
const hrs = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function LogHours({
  jobId,
  jobReason,
  onClose,
}: {
  /** Pre-picked: the job on today's schedule, or the job page you came from. */
  jobId?: string | null;
  /** Why this one, in the client's words. Null when nothing picked it. */
  jobReason?: string | null;
  onClose: () => void;
}) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<BillableJob[]>([]);
  const [picked, setPicked] = useState<string>('');
  const [changing, setChanging] = useState(false);
  const [hours, setHours] = useState(4);
  const [crew, setCrew] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [id, list] = await Promise.all([orgNow(), listBillableJobs(await orgNow() ?? '')]);
    setOrgId(id);
    setJobs(list);
    /* The pre-picked job only counts if it is still one you can log against.
       A completed job passed in from a URL would otherwise silently log
       nowhere. */
    setPicked((p) => p || (jobId && list.some((j) => j.id === jobId) ? jobId : list[0]?.id ?? ''));
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const job = useMemo(() => jobs.find((j) => j.id === picked) ?? null, [jobs, picked]);

  /* Crew hours, because that is what gets billed and what the client reads.
     Four hours with three people on site is twelve hours of work, and an
     invoice saying four is the commonest way a day's labour goes missing. */
  const crewHours = hours * crew;
  const total = job ? crewHours * job.rate : 0;

  const save = async () => {
    if (!orgId || !job || crewHours <= 0) return;
    setBusy(true);
    setErr('');
    try {
      await createTimeEntry(orgId, job.id, {
        worked_on: localDay(),
        hours: crewHours,
        rate: job.rate,
        /* The crew is in the description because there is nowhere else for it
           to go: time_entries has hours and a rate and no headcount. Naming
           it here means the invoice line says where twelve hours came from,
           rather than leaving somebody to wonder on the 30th. */
        description:
          crew > 1 ? `${hrs(hours)} hrs, ${crew} on site` : `${hrs(hours)} hrs on site`,
      });
      setDone(`${hrs(crewHours)} hrs on ${job.name}.`);
      setTimeout(onClose, 1600);
    } catch (e) {
      setErr(human(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    /* The spine's overlay, not a hand-rolled one. On a phone Sheet already
       comes up from the bottom, closes on escape and on the backdrop, and
       manages focus - three things a second implementation gets wrong. */
    <Sheet title="Log hours" onClose={onClose}>
      {done ? (
        <div style={{ fontSize: 17, color: C.text, lineHeight: 1.6 }}>Logged {done}</div>
      ) : (
        <>
          <Label>Job</Label>
          {changing || !job ? (
            <Select
              value={picked}
              onChange={(v) => { setPicked(v); setChanging(false); }}
              options={jobs.map((j) => ({
                value: j.id,
                label: j.customer_name ? `${j.name} · ${j.customer_name}` : j.name,
              }))}
            />
          ) : (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                border: `1px solid ${C.border}`, borderRadius: radius.lg,
                background: C.panelAlt, padding: '14px 16px',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.text }}>{job.name}</div>
                {/* Only when something actually picked it. "Picked for you"
                    with no reason behind it is a claim, not a help. */}
                {jobReason && (
                  <div style={{ fontSize: 13.5, color: C.faint, marginTop: 2 }}>{jobReason}</div>
                )}
              </div>
              <button
                onClick={() => setChanging(true)}
                style={{
                  minHeight: 48, padding: '0 6px', background: 'transparent', border: 'none',
                  color: C.text, fontSize: 15, textDecoration: 'underline', cursor: 'pointer',
                  fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                Change
              </button>
            </div>
          )}

          <Label>Hours</Label>
          <Stepper
            value={hrs(hours)}
            unit="hrs"
            onDown={() => setHours((h) => Math.max(HOUR_STEP, +(h - HOUR_STEP).toFixed(1)))}
            onUp={() => setHours((h) => Math.min(MAX_HOURS, +(h + HOUR_STEP).toFixed(1)))}
            downLabel="Half an hour less"
            upLabel="Half an hour more"
            atMin={hours <= HOUR_STEP}
            atMax={hours >= MAX_HOURS}
          />

          <Label>Crew on site</Label>
          <Stepper
            value={String(crew)}
            unit={crew === 1 ? 'person' : 'people'}
            onDown={() => setCrew((c) => Math.max(1, c - 1))}
            onUp={() => setCrew((c) => Math.min(MAX_CREW, c + 1))}
            downLabel="One fewer"
            upLabel="One more"
            atMin={crew <= 1}
            atMax={crew >= MAX_CREW}
          />

          {/*
            The running total, in both of the units it matters in.

            The money half only appears where a rate is actually agreed. A
            rate of zero is not a price, and "$0" under somebody's morning
            reads as the work being worth nothing rather than as a setting
            nobody has filled in.
          */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, marginTop: 20, border: `1px solid ${C.border}`,
              borderRadius: radius.lg, background: C.panelAlt, padding: '16px 18px',
            }}
          >
            <span style={{ fontSize: 15, color: C.faint }}>Adds up to</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.text, textAlign: 'right' }}>
              {hrs(crewHours)} crew hours
              {job && job.rate > 0 ? ` · ${money(total)}` : ''}
            </span>
          </div>

          {job?.draft_number && (
            <div style={{ fontSize: 13.5, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
              Lands on draft {job.draft_number}.
            </div>
          )}

          {err && (
            <div style={{ fontSize: 14, color: C.red, marginTop: 14, lineHeight: 1.55 }}>{err}</div>
          )}

          {/* Stuck to the bottom of the sheet as it scrolls, so Save is under
              the thumb whatever the job name did to the height above it. The
              negative offsets cancel Sheet's own padding. */}
          <div
            style={{
              position: 'sticky', bottom: -22, marginTop: 22,
              padding: '14px 22px calc(8px + env(safe-area-inset-bottom, 0px))',
              marginLeft: -22, marginRight: -22, marginBottom: -22,
              background: C.panel, borderTop: `1px solid ${C.border}`,
            }}
          >
            <Button onClick={save} disabled={busy || !job} size="thumb">
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}

const DISPLAY = {
  fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
  fontWeight: 700,
  letterSpacing: '-0.4px',
  color: C.text,
} as const;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
        color: C.faint, margin: '22px 0 8px',
      }}
    >
      {children}
    </div>
  );
}

/**
 * Minus, the number, plus.
 *
 * The number is not an input. Making it one puts a keyboard over the screen
 * the moment a thumb brushes it, which is the thing this control exists to
 * avoid, and there is no value anybody needs that two taps cannot reach.
 */
function Stepper({
  value, unit, onDown, onUp, downLabel, upLabel, atMin, atMax,
}: {
  value: string;
  unit: string;
  onDown: () => void;
  onUp: () => void;
  downLabel: string;
  upLabel: string;
  atMin: boolean;
  atMax: boolean;
}) {
  const round: React.CSSProperties = {
    width: 56, height: 56, borderRadius: 28, flexShrink: 0,
    border: `1px solid ${C.border}`, background: C.panel, color: C.text,
    fontSize: 26, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        border: `1px solid ${C.border}`, borderRadius: radius.lg, background: C.panel,
        padding: '10px 12px',
      }}
    >
      <button
        onClick={onDown}
        disabled={atMin}
        aria-label={downLabel}
        style={{ ...round, opacity: atMin ? 0.35 : 1, cursor: atMin ? 'default' : 'pointer' }}
      >
        −
      </button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ ...DISPLAY, fontSize: 36 }}>{value}</span>
        <span style={{ fontSize: 16, color: C.faint }}>{unit}</span>
      </div>
      <button
        onClick={onUp}
        disabled={atMax}
        aria-label={upLabel}
        style={{ ...round, opacity: atMax ? 0.35 : 1, cursor: atMax ? 'default' : 'pointer' }}
      >
        +
      </button>
    </div>
  );
}
