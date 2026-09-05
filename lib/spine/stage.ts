/**
 * One lane, from the first time you notice a company to the last invoice.
 *
 * There were two tables and two vocabularies for the same thing at two moments
 * in its life, and converting from one to the other left every note taken
 * during the chase on a row nobody opens again. A funnel is a position in a
 * relationship, not a different kind of record.
 *
 * Seven stages, and the count matters. Five is the number most pipelines use
 * and it forces reached and talking into one word, which throws away whether
 * anybody has replied. That is the most useful fact a pipeline holds: a list of
 * people who have not answered and a list of live conversations need completely
 * different mornings.
 */

export type Stage =
  | 'noticed'
  | 'reached'
  | 'talking'
  | 'proposed'
  | 'won'
  | 'past'
  | 'cold';

export interface StageSpec {
  id: Stage;
  label: string;
  /** What being here actually means, in the words somebody would say aloud. */
  means: string;
  tone: 'neutral' | 'amber' | 'green' | 'faint';
}

/**
 * In order, and the order is the point: the bar reads left to right and where
 * you are is where the fill stops.
 *
 * Past and cold sit outside the run because neither is further along than won.
 * They are the two ways out, and drawing them as a sixth and seventh step of a
 * progression would say a lost deal is an advanced one.
 */
export const LANE: StageSpec[] = [
  { id: 'noticed',  label: 'Noticed',  means: 'On the list. Nobody has been contacted yet.',        tone: 'faint' },
  { id: 'reached',  label: 'Reached',  means: 'You contacted them and have heard nothing back.',    tone: 'amber' },
  { id: 'talking',  label: 'Talking',  means: 'A real conversation is happening.',                  tone: 'neutral' },
  { id: 'proposed', label: 'Proposed', means: 'A number is in front of them.',                      tone: 'neutral' },
  { id: 'won',      label: 'Won',      means: 'They are a client.',                                 tone: 'green' },
];

export const CLOSED: StageSpec[] = [
  { id: 'past', label: 'Past',  means: 'They were a client and are not now.', tone: 'faint' },
  { id: 'cold', label: 'Cold',  means: 'It closed the other way.',            tone: 'faint' },
];

export const ALL_STAGES: StageSpec[] = [...LANE, ...CLOSED];

export const STAGE: Record<Stage, StageSpec> =
  Object.fromEntries(ALL_STAGES.map((s) => [s.id, s])) as Record<Stage, StageSpec>;

/** Everything before won. What Pipeline shows. */
export const OPEN_STAGES: Stage[] = ['noticed', 'reached', 'talking', 'proposed'];

/** Won and past. What Clients shows. */
export const CLIENT_STAGES: Stage[] = ['won', 'past'];

export const isOpen = (s: string | null | undefined) =>
  OPEN_STAGES.includes((s ?? '') as Stage);

export const isClient = (s: string | null | undefined) =>
  CLIENT_STAGES.includes((s ?? '') as Stage);

/** How far along the lane, 0 to 1, for drawing a bar. Closed reads as done. */
export function progress(s: string | null | undefined): number {
  const i = LANE.findIndex((x) => x.id === s);
  if (i >= 0) return (i + 1) / LANE.length;
  return 1;
}

/**
 * How long is too long to sit here without anything happening.
 *
 * Not a rule anybody is held to, and nothing is moved automatically because of
 * it. It is the difference between a pipeline of a hundred and a list of the
 * four you are actually neglecting, which for one person is the whole value.
 *
 * Noticed has no limit on purpose: a name on a list going untouched for two
 * months is not neglect, it is a list.
 */
export const STALE_AFTER_DAYS: Partial<Record<Stage, number>> = {
  reached: 10,
  talking: 14,
  proposed: 7,
};

export function daysSince(date: string | null | undefined): number | null {
  if (!date) return null;
  const then = new Date(date + 'T00:00:00');
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / 86_400_000);
}

/** Is this one going quiet? Returns the number of days, or null. */
export function stale(stage: string | null | undefined, lastTouch: string | null | undefined): number | null {
  const limit = STALE_AFTER_DAYS[(stage ?? '') as Stage];
  if (!limit) return null;
  const d = daysSince(lastTouch);
  return d !== null && d >= limit ? d : null;
}
