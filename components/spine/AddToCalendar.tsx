'use client';

/**
 * Add to calendar.
 *
 * No calendar is built here and none should be. This drops one event into the
 * calendar someone already uses — Google, Outlook, or anything that opens an
 * .ics, which is everything else including Apple Calendar.
 *
 * It is genuinely trivial: Google and Outlook both accept a pre-filled compose
 * URL, and .ics is a text file. No API, no OAuth, no tokens, nothing to keep
 * in sync. That is the whole appeal — it does 90% of what a calendar
 * integration is for at about 1% of the cost and none of the maintenance.
 *
 * The tradeoff, stated plainly: it is a copy, not a link. Change the date in
 * Nautilus afterwards and the calendar entry does not move. For anything that
 * needs to stay in step, the subscribe feed on the Business page is the right
 * tool — this is for "put it in my calendar now".
 */

import { useState } from 'react';
import { Button, C, radius } from './ui';

export interface CalendarEvent {
  title: string;
  /** YYYY-MM-DD. All-day events; a job spans days, not hours. */
  start: string;
  end?: string | null;
  location?: string | null;
  details?: string | null;
  url?: string | null;
}

const compact = (d: string) => d.slice(0, 10).replace(/-/g, '');

/** All-day DTEND is exclusive, so the last day needs +1 to be included. */
function exclusiveEnd(d: string): string {
  const dt = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return compact(dt.toISOString());
}

function googleUrl(e: CalendarEvent): string {
  const end = e.end || e.start;
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${compact(e.start)}/${exclusiveEnd(end)}`,
  });
  if (e.location) p.set('location', e.location);
  const details = [e.details, e.url].filter(Boolean).join('\n\n');
  if (details) p.set('details', details);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function outlookUrl(e: CalendarEvent): string {
  const end = e.end || e.start;
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    allday: 'true',
    subject: e.title,
    startdt: e.start.slice(0, 10),
    // Outlook's end is inclusive, unlike iCalendar's.
    enddt: end.slice(0, 10),
  });
  if (e.location) p.set('location', e.location);
  if (e.details) p.set('body', e.details);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}

function icsBlob(e: CalendarEvent): Blob {
  const end = e.end || e.start;
  const esc = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nautilus//Job//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@nautilus`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(e.start)}`,
    `DTEND;VALUE=DATE:${exclusiveEnd(end)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.details || e.url ? [`DESCRIPTION:${esc([e.details, e.url].filter(Boolean).join('\n\n'))}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
}

export function AddToCalendar({ event, disabled }: { event: CalendarEvent | null; disabled?: boolean }) {
  const [open, setOpen] = useState(false);

  const go = (href: string) => {
    window.open(href, '_blank', 'noopener');
    setOpen(false);
  };

  const downloadIcs = () => {
    if (!event) return;
    const url = URL.createObjectURL(icsBlob(event));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setOpen(false);
  };

  const item: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '9px 12px',
    background: 'transparent',
    border: 'none',
    fontSize: 13,
    color: C.text,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || !event}
      >
        Add to calendar
      </Button>

      {open && event && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 5px)',
              right: 0,
              minWidth: 190,
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: radius.md,
              zIndex: 41,
              padding: 4,
              boxShadow: '0 10px 26px rgba(0,0,0,.12)',
            }}
          >
            <button style={item} onClick={() => go(googleUrl(event))}>Google Calendar</button>
            <button style={item} onClick={() => go(outlookUrl(event))}>Outlook</button>
            <button style={item} onClick={downloadIcs}>Apple / download .ics</button>
            <div
              style={{
                fontSize: 10.5,
                color: C.faint,
                padding: '7px 12px 5px',
                borderTop: `1px solid ${C.border}`,
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              A copy, not a link — changing the date here won&apos;t move it there.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
