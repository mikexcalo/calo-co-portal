/**
 * The type scale.
 *
 * Taken from how Carta sets a dense financial UI: everything sits about one
 * step larger than the portal was running, and body copy is nearly black
 * rather than gray. The two changes work together. Small gray text is the
 * default look of an admin panel nobody chose to use, and it is the single
 * thing that made this feel like a tool rather than a product.
 *
 * WHAT WAS NOT COPIED
 *
 * Their display serif. That is a brand decision rather than a UI one, and
 * picking a headline face for CALO&CO before the name is settled would mean
 * choosing it twice.
 *
 * And their density in the sidebar, which was tried and reverted. Carta's nav
 * is roomy because it holds five items; this one holds fourteen. Scale is not
 * transferable on its own, only the reasoning behind it is.
 *
 * WHY A FILE RATHER THAN A NOTE
 *
 * Six hundred sizes are set inline across the app, which is fine on its own,
 * but it means the scale only exists as a habit. Written down, the next screen
 * starts from the same numbers instead of from whatever the last one used.
 */

export const type = {
  /** Legal lines, table micro-labels. The smallest text that should ever ship. */
  micro: 11,
  /** Uppercase section labels, metadata under a name, timestamps. */
  label: 12,
  /** Secondary copy: helper text under a field, an empty state. */
  small: 13,
  /** The default. Table rows, list items, most of what is on screen. */
  body: 14,
  /** Something asking to be read first: a card's headline, a chosen value. */
  lead: 15,
  /** Section headings inside a page. */
  heading: 17,
  /** Page titles. */
  title: 21,
} as const;

/**
 * Line height belongs to the size, not to the component.
 *
 * Prose at 1.65 and interface labels at 1.3 is the difference between a
 * paragraph you read and a row you scan. Setting both to a single number,
 * which is what happens when it is decided per component, gets one of them
 * wrong every time.
 */
export const leading = {
  tight: 1.25,
  ui: 1.45,
  prose: 1.65,
} as const;

/**
 * Inter needs a touch of negative tracking above about 15px and none below it.
 * Applied to headings only, for that reason.
 */
export const tracking = {
  heading: '-0.015em',
  title: '-0.02em',
  caps: '0.09em',
} as const;
