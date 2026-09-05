/**
 * One icon set, drawn once.
 *
 * Every tab strip in here was words only, and by the time a module had four of
 * them the screen was a paragraph you had to read to navigate. An icon is
 * recognized rather than read, which is the whole difference: you find the tab
 * you were already looking for instead of parsing four labels to rule three
 * out.
 *
 * They live in one file because the alternative is what already happened once
 * with tab labels, where the same idea got drawn slightly differently on three
 * screens and the strips stopped feeling like the same control.
 *
 * Drawn on a 16 unit grid, stroked and never filled, so weight comes from the
 * stroke and every glyph sits at the same visual density beside 13.5px text.
 */

import type { ReactNode } from 'react';

export type IconName =
  | 'brief'
  | 'work'
  | 'documents'
  | 'activity'
  | 'business'
  | 'pricing'
  | 'records'
  | 'search'
  | 'star'
  | 'chart'
  | 'card'
  | 'receipt'
  | 'layers'
  | 'book'
  | 'swatches'
  | 'globe'
  | 'target'
  | 'send'
  | 'people'
  | 'mail';

const PATHS: Record<IconName, ReactNode> = {
  // A page with writing on it. The standing answer to where we are.
  brief: (
    <>
      <path d="M4 2.2h5l3 3v8.6H4z" />
      <path d="M9 2.4v3h3" />
      <path d="M6 8.6h4M6 11h3" />
    </>
  ),
  // A case. What is actually being done for them.
  work: (
    <>
      <path d="M2.4 5.6h11.2v7.6H2.4z" />
      <path d="M6 5.4V3.8h4v1.6" />
      <path d="M2.4 9h11.2" />
    </>
  ),
  documents: <path d="M2.2 4h4.2l1.3 1.6h6.1v7.6H2.2z" />,
  activity: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M8 4.6V8.2l2.6 1.5" />
    </>
  ),
  business: (
    <>
      <path d="M2.8 13.8V2.9h7v10.9" />
      <path d="M9.8 6.8h3.4v7" />
      <path d="M5 5.4h2.4M5 7.8h2.4M5 10.2h2.4" />
    </>
  ),
  pricing: (
    <>
      <path d="M8.4 2.3h5.3v5.3l-6 6-5.3-5.3z" />
      <circle cx="11" cy="5" r="0.9" />
    </>
  ),
  records: (
    <>
      <path d="M2.2 3.2h11.6v2.8H2.2z" />
      <path d="M3.3 6v7.6h9.4V6" />
      <path d="M6.5 8.9h3" />
    </>
  ),
  search: (
    <>
      <circle cx="7.2" cy="7.2" r="4.4" />
      <path d="M10.5 10.5l3 3" />
    </>
  ),
  star: <path d="M8 2.2l1.85 3.74 4.13.6-2.99 2.91.71 4.11L8 11.62l-3.7 1.94.71-4.11L2.02 6.54l4.13-.6z" />,
  chart: (
    <>
      <path d="M2.4 13.6h11.2" />
      <path d="M3.2 11.2l3.2-3.4 2.6 2.2 4.2-4.8" />
    </>
  ),
  card: (
    <>
      <path d="M2.4 4.6h11.2v8.2H2.4z" />
      <path d="M2.4 7.4h11.2" />
      <path d="M10.4 10.4h1.8" />
    </>
  ),
  receipt: (
    <>
      <path d="M3.6 2.3h8.8v11.9l-1.76-1.2-1.76 1.2-1.76-1.2-1.76 1.2-1.76-1.2z" />
      <path d="M6 5.7h4M6 8.3h4" />
    </>
  ),
  layers: (
    <>
      <path d="M8 2.2l5.6 2.9L8 8 2.4 5.1z" />
      <path d="M2.4 8L8 10.9 13.6 8" />
      <path d="M2.4 10.9L8 13.8l5.6-2.9" />
    </>
  ),
  book: (
    <>
      <path d="M2.4 3.2h4.2c.9 0 1.4.5 1.4 1.3v8.3c0-.7-.5-1.2-1.4-1.2H2.4z" />
      <path d="M13.6 3.2H9.4c-.9 0-1.4.5-1.4 1.3v8.3c0-.7.5-1.2 1.4-1.2h4.2z" />
    </>
  ),
  swatches: (
    <>
      <path d="M2.6 2.8h4.6v4.6H2.6z" />
      <circle cx="11.2" cy="5.1" r="2.4" />
      <path d="M2.6 9.2h4.6v4.6H2.6z" />
      <circle cx="11.2" cy="11.5" r="2.4" />
    </>
  ),
  globe: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M2.4 8h11.2" />
      <path d="M8 2.2c1.5 1.7 2.3 3.7 2.3 5.8S9.5 12.1 8 13.8C6.5 12.1 5.7 10.1 5.7 8S6.5 3.9 8 2.2z" />
    </>
  ),
  target: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <circle cx="8" cy="8" r="2.3" />
    </>
  ),
  send: (
    <>
      <path d="M13.9 2.5L7.3 9.1" />
      <path d="M13.9 2.5l-4.3 11.3-2.3-4.7-4.7-2.3z" />
    </>
  ),
  // Two of them, one behind. Somebody else getting a login.
  people: (
    <>
      <circle cx="6.2" cy="5.6" r="2.5" />
      <path d="M1.9 13.4c0-2.4 1.9-4 4.3-4s4.3 1.6 4.3 4" />
      <path d="M10.8 3.5a2.5 2.5 0 010 4.2" />
      <path d="M12.1 9.9c1.3.5 2 1.8 2 3.5" />
    </>
  ),
  // An envelope. Mail leaving the building, as opposed to send, which is a
  // pitch going out.
  mail: (
    <>
      <path d="M2.2 3.9h11.6v8.2H2.2z" />
      <path d="M2.2 4.4L8 8.9l5.8-4.5" />
    </>
  ),
};

export function Glyph({
  name,
  size = 15,
  color,
}: {
  name: IconName;
  size?: number;
  color: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {PATHS[name]}
    </svg>
  );
}
