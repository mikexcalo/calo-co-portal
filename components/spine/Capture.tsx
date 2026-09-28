'use client';

/**
 * What the + opens: four ways to put something in.
 *
 * A contractor with a phone in one hand is not navigating. They have just
 * finished four hours, or been handed a receipt, or seen something on a roof
 * worth a photograph, and the window between the thought and the record is
 * about fifteen seconds long. Everything here is inside that window.
 *
 * NOTHING HERE IS NEW.
 *
 *   Log hours      LogHours, on listBillableJobs and createTimeEntry
 *   Snap a receipt the /documents pipeline, with its camera opened for you
 *   Photo to job   uploadPhotos, the same call the job page's panel makes
 *   Quick note     DropIt, the top bar's "Add a note", unchanged
 *
 * That is the point. A phone shortcut that writes its own version of a record
 * is how two halves of a product start disagreeing about what an hour is.
 *
 * WHAT IS DELIBERATELY ABSENT
 *
 * The approved design has a "Hold to talk" panel across the top and a line
 * promising that everything saves on the phone and sends when signal returns.
 * Neither is built, and both are in docs/handoff.md as their own briefs. A
 * button that does nothing teaches people the screen is broken, and a promise
 * about offline saving that is not true is the worst kind: it is believed at
 * exactly the moment it fails.
 */

import { useRef, useState } from 'react';
import { useOrg } from '@/lib/spine/org';
import { useRouter } from 'next/navigation';
import { uploadPhotos } from '@/lib/spine/photos';
import { DropIt } from './DropIt';
import { LogHours } from './LogHours';
import { C, radius, Sheet } from './ui';

const g = (d: React.ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

export interface CaptureJob {
  id: string;
  name: string;
  /** Why this job and not another, said plainly. */
  reason: string;
}

export function Capture({
  orgId,
  job,
  onClose,
}: {
  orgId: string | null;
  /** The job in hand: today's schedule, or the job page you came from. */
  job: CaptureJob | null;
  onClose: () => void;
}) {
  const { vocab } = useOrg();
  const router = useRouter();
  const camera = useRef<HTMLInputElement>(null);
  const [hours, setHours] = useState(false);
  const [note, setNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (hours) {
    return <LogHours jobId={job?.id ?? null} jobReason={job?.reason ?? null} onClose={onClose} />;
  }
  /* The top bar's note box, unchanged, in the spine's own overlay. DropIt
     renders bare content by design - it is the same block on a phone and a
     desk - so the thing that makes it a dialog belongs here. */
  if (note) {
    return (
      <Sheet title="Quick note" onClose={onClose}>
        <DropIt onClose={onClose} />
      </Sheet>
    );
  }

  const photo = async (files: FileList | null) => {
    if (!files?.length || !orgId) return;
    setBusy(true);
    setErr(null);
    const res = await uploadPhotos({ orgId, jobId: job?.id ?? null }, files);
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    onClose();
    /* Straight to where it landed, because a photo you cannot see is a photo
       you are not sure you took. */
    if (job) router.push(`/jobs/${job.id}`);
  };

  return (
    <Sheet onClose={onClose}>
      <div
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 12, marginBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
            fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: C.text,
          }}
        >
          Capture
        </span>
        {/* Only where something really is in hand. "At —" is worse than
            nothing, and on a screen this small it is also a wasted line. */}
        {job && (
          <span style={{ fontSize: 14, color: C.faint, textAlign: 'right', minWidth: 0 }}>
            At {job.name}
          </span>
        )}
      </div>

      {err && (
        <div style={{ fontSize: 13.5, color: C.red, marginBottom: 10, lineHeight: 1.55 }}>{err}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Tile
          icon={g(<><circle cx="8" cy="8" r="6.2" /><path d="M8 4.6V8l2.2 1.3" /></>)}
          label="Log hours"
          detail={job ? `${job.name}, picked for you` : `Pick the ${vocab.job.toLowerCase()}`}
          onClick={() => setHours(true)}
        />
        <Tile
          icon={g(<><path d="M2 5.2h2.6l1-1.6h4.8l1 1.6H14v7.4H2z" /><circle cx="8" cy="8.6" r="2.2" /></>)}
          label="Snap a receipt"
          detail="Photo, we read it"
          onClick={() => { onClose(); router.push('/documents?capture=1'); }}
        />
        <Tile
          icon={g(<><rect x="2" y="3" width="12" height="10" rx="1.4" /><circle cx="5.6" cy="6.4" r="1.1" /><path d="M2.6 11.4 6 8.4l2.4 2 2-1.6 3 2.6" /></>)}
          label={`Photo to the ${vocab.job.toLowerCase()}`}
          detail={busy ? 'Filing…' : job ? 'Before, during, after' : `Pick a ${vocab.job.toLowerCase()} first`}
          onClick={() => camera.current?.click()}
          disabled={busy || !orgId}
        />
        <Tile
          icon={g(<><rect x="3" y="2.2" width="10" height="11.6" rx="1.2" /><path d="M5.6 5.6h4.8M5.6 8h4.8M5.6 10.4h3" /></>)}
          label="Quick note"
          detail="Typed or pasted"
          onClick={() => setNote(true)}
        />
      </div>

      {/*
        capture="environment" is what turns a file picker into the camera on
        a phone. Without it this opens a photo library, which is the wrong
        end of the job: the picture has not been taken yet.
      */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => photo(e.target.files)}
      />
    </Sheet>
  );
}

function Tile({
  icon, label, detail, onClick, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
        // Well past the 48px floor: these are the targets somebody hits
        // without looking, one-handed, in the cold.
        minHeight: 108,
        textAlign: 'left',
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: radius.lg,
        padding: '14px 14px 16px',
        color: C.text,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
      }}
    >
      <span style={{ color: C.text, display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 16.5, fontWeight: 700, lineHeight: 1.25 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.faint, lineHeight: 1.35 }}>{detail}</span>
    </button>
  );
}
