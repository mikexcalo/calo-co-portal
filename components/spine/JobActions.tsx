'use client';

/**
 * The four things you do to a job while standing on it.
 *
 * Log time, note, photo, status. On a phone they were spread down a long
 * scroll - status near the top, time and photos in panels further down, notes
 * further again - so doing the ordinary end-of-visit sequence meant three
 * round trips through the page with a thumb.
 *
 * Here they sit above the tab bar, where the thumb already is, and stay there
 * while the page scrolls.
 *
 * REUSED, NOT REBUILT
 *
 * Every one of these already exists behind the + capture sheet, so this bar
 * opens the same components rather than growing a second implementation of
 * logging an hour. If LogHours learns something, it learns it here too. The
 * only thing written fresh is the status sheet, because the + sheet has no
 * reason to carry one.
 */

import { useRef, useState } from 'react';
import { uploadPhotos } from '@/lib/spine/photos';
import { JOB_PIPELINE, JOB_STATUS_LABEL, type JobStatus, type JobWithCustomer } from '@/lib/spine/types';
import { LogHours } from './LogHours';
import { DropIt } from './DropIt';
import { C, Sheet, radius } from './ui';

/** How tall the bar is, so the page can leave room under itself for it. */
export const JOB_BAR = 57;

/** How tall the tab bar underneath is. Matches BottomBar's own cell. */
const TAB_BAR = 56;

/* Every status the desktop dropdown offers, in the same order. The pipeline
   constant stops at `complete`, and a bar that cannot mark a job lost is a
   bar somebody has to leave to finish the thought. */
const STATUSES: JobStatus[] = [...JOB_PIPELINE, 'closed', 'lost'];

const glyph = (d: React.ReactNode) => (
  <svg width="19" height="19" viewBox="0 0 16 16" fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

const ICON = {
  time: glyph(<><circle cx="8" cy="8" r="6.2" /><path d="M8 4.6V8l2.4 1.4" /></>),
  note: glyph(<><path d="M3.2 2.6h9.6v10.8H3.2z" /><path d="M5.6 6h4.8M5.6 9h3.2" /></>),
  photo: glyph(<><rect x="2" y="4.2" width="12" height="9" rx="1.4" /><circle cx="8" cy="8.7" r="2.3" /><path d="M6 4.2l.9-1.6h2.2l.9 1.6" /></>),
  status: glyph(<><path d="M3 8h10" /><path d="M9.2 4.2 13 8l-3.8 3.8" /></>),
};

export function JobActions({
  job,
  orgId,
  onStatus,
  onChanged,
}: {
  job: JobWithCustomer;
  orgId: string | null;
  onStatus: (s: JobStatus) => void;
  onChanged: () => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<'time' | 'note' | 'status' | null>(null);
  const [saving, setSaving] = useState(0);

  const shoot = async (files: FileList | null) => {
    if (!files?.length || !orgId) return;
    setSaving(files.length);
    await uploadPhotos(
      { orgId, jobId: job.id, customerId: job.customer_id ?? null },
      files,
      (left) => setSaving(left)
    );
    setSaving(0);
    onChanged();
  };

  const cell: React.CSSProperties = {
    flex: 1,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 3,
    /* Clears 48px with room, because this is the bar somebody uses with wet
       hands on a roof. */
    minHeight: 56,
    background: 'transparent', border: 'none',
    color: C.text, fontSize: 11.5, fontWeight: 500,
    fontFamily: 'inherit', cursor: 'pointer', padding: '6px 2px',
  };

  return (
    <>
      <div
        style={{
          /*
            Fixed, and lifted clear of the tab bar rather than sharing a
            bottom edge with it.

            Sticky at `bottom: 0` put both bars in the same place in the same
            scroll container, and the tabs win on z-index - so the four
            actions rendered underneath them and could not be seen at all.
            The tabs are how somebody leaves this screen; covering them would
            trap them here, so this sits on top of the tabs' own height.
          */
          position: 'fixed',
          left: 0, right: 0,
          bottom: `calc(${TAB_BAR}px + env(safe-area-inset-bottom, 0px))`,
          zIndex: 28,
          display: 'flex',
          alignItems: 'stretch',
          background: C.panel,
          borderTop: `1px solid ${C.border}`,
          boxShadow: '0 -6px 18px rgba(0,0,0,.06)',
        }}
      >
        <button style={cell} onClick={() => setOpen('time')}>
          {ICON.time}Log time
        </button>
        <button style={cell} onClick={() => setOpen('note')}>
          {ICON.note}Note
        </button>
        <button style={cell} onClick={() => camera.current?.click()}>
          {ICON.photo}{saving > 0 ? `${saving} left` : 'Photo'}
        </button>
        <button style={cell} onClick={() => setOpen('status')}>
          {ICON.status}Status
        </button>
      </div>

      {/*
        `capture="environment"` asks for the back camera directly rather than
        the photo library, which is the difference between two taps and five
        when the thing you want a picture of is in front of you.
      */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => { void shoot(e.target.files); e.target.value = ''; }}
        style={{ display: 'none' }}
      />

      {open === 'time' && (
        <LogHours jobId={job.id} jobReason={job.name} onClose={() => { setOpen(null); onChanged(); }} />
      )}

      {open === 'note' && (
        <Sheet title="Add a note" width={680} onClose={() => setOpen(null)}>
          <DropIt customerId={job.customer_id} jobId={job.id} onClose={() => { setOpen(null); onChanged(); }} />
        </Sheet>
      )}

      {open === 'status' && (
        <Sheet title="Move this to" onClose={() => setOpen(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STATUSES.map((s) => {
              const on = s === job.status;
              return (
                <button
                  key={s}
                  onClick={() => { setOpen(null); if (!on) onStatus(s); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    minHeight: 52, padding: '0 14px',
                    borderRadius: radius.md, textAlign: 'left',
                    background: on ? C.panelAlt : 'transparent',
                    border: `1px solid ${on ? C.borderStrong : C.border}`,
                    color: C.text, fontSize: 15, fontWeight: on ? 600 : 400,
                    fontFamily: 'inherit', cursor: on ? 'default' : 'pointer',
                  }}
                >
                  <span style={{ flex: 1 }}>{JOB_STATUS_LABEL[s]}</span>
                  {on && <span style={{ fontSize: 12.5, color: C.faint }}>Now</span>}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
    </>
  );
}
