'use client';

/**
 * The four things somebody standing outside a building needs.
 *
 * Where is it, who is it for, what state is it in, and what happens next.
 * That is the whole of it, and on a phone it is also the whole of the screen
 * above the fold - so it is written once and used by both job screens rather
 * than being laid out twice and drifting.
 *
 * TWO OF THEM ARE ACTIONS, NOT TEXT
 *
 * An address on a job screen is not a fact to read, it is somewhere you are
 * driving. A customer's number is not a fact either, it is the call you make
 * when the gate is locked. Both were plain grey text, which meant copying an
 * address out by hand into another app while sitting in a truck.
 *
 * Only where the data exists. A job with no address shows no address row -
 * not a greyed-out one, and not the word "None", which is a fact nobody
 * needed and a tap target that does nothing.
 */

import { directionsHref, callHref } from '@/lib/spine/today';
import { tidyAddress } from '@/lib/spine/tidy';
import { JOB_STATUS_LABEL, type JobWithCustomer } from '@/lib/spine/types';
import { C, Pill, radius } from './ui';

const icon = (d: React.ReactNode) => (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden
       style={{ flexShrink: 0 }}>
    {d}
  </svg>
);

const PIN = icon(<><path d="M8 14.5s5-4.4 5-8a5 5 0 0 0-10 0c0 3.6 5 8 5 8z" /><circle cx="8" cy="6.4" r="1.8" /></>);
const PHONE = icon(<path d="M3 2.8h2.4l1.2 3-1.5 1.1a8.2 8.2 0 0 0 3.9 3.9l1.1-1.5 3 1.2v2.4a1 1 0 0 1-1.1 1A11.4 11.4 0 0 1 2 3.9a1 1 0 0 1 1-1.1z" />);

/** One tappable line: an icon, the thing, and a word for what tapping does. */
function TapRow({
  href, glyph, label, action,
}: { href: string; glyph: React.ReactNode; label: string; action: string }) {
  return (
    <a
      href={href}
      /* Maps opens elsewhere; the dialer does not, and a tel: link in a new
         tab leaves an empty one behind on desktop. */
      {...(href.startsWith('tel:') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        /* 48px, because this gets tapped with a glove on, standing up. */
        minHeight: 48, padding: '6px 10px', margin: '0 -10px',
        borderRadius: radius.md, color: C.text, textDecoration: 'none',
        fontSize: 14.5, lineHeight: 1.4,
      }}
    >
      <span style={{ color: C.faint, display: 'flex' }}>{glyph}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: C.accent, fontWeight: 600, flexShrink: 0 }}>
        {action}
      </span>
    </a>
  );
}

export function JobFacts({ job, next }: { job: JobWithCustomer; next?: string | null }) {
  const address = tidyAddress(job.address);
  const phone = job.customer?.phone?.trim();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <Pill tone="neutral">{JOB_STATUS_LABEL[job.status]}</Pill>
        {job.customer?.name && (
          <span style={{ fontSize: 14.5, color: C.dim }}>{job.customer.name}</span>
        )}
      </div>

      {address && (
        <TapRow href={directionsHref(address)} glyph={PIN} label={address} action="Directions" />
      )}
      {phone && (
        <TapRow href={callHref(phone)} glyph={PHONE} label={phone} action="Call" />
      )}

      {/*
        What happens next, and nothing where there is no answer.

        "No next step" is a sentence that takes up a line to say nothing. A
        job with nothing outstanding is quiet, which is itself the report.
      */}
      {next && (
        <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.5, paddingTop: 6 }}>
          {next}
        </div>
      )}
    </div>
  );
}
