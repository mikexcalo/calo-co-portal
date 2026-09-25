/**
 * What colour is this workspace.
 *
 * One answer, used by the strip at the top of the app and by the name plate
 * in the sidebar, so the two can never disagree about which business you are
 * standing in — which is the whole point of having them.
 *
 * Order, and why:
 *
 *   1. settings.workspace_color, if the studio owner has set one. Explicit
 *      beats derived. Without this the control would do nothing at all for
 *      the workspaces that happen to have a brand kit, which is most of the
 *      ones anybody would want to correct.
 *   2. The first colour in the workspace's own brand kit. Free and usually
 *      right: if somebody has built a brand in here, that is their colour.
 *   3. Grey. Not a guess dressed up as a decision.
 *
 * The studio itself is deliberately not coloured from its brand kit. It is
 * near-black, always, so "am I in my own workspace or somebody's" is answered
 * by the one colour that cannot be mistaken for a client's.
 */

export const STUDIO_COLOR = '#111111';
export const NO_COLOR_SET = '#64748B';

interface Colourish {
  kind?: string | null;
  settings?: Record<string, unknown> | null;
}

/** A hex colour, or null if it is not one. Guards against a half-typed value. */
function hex(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^#[0-9a-f]{6}$/i.test(s) ? s : null;
}

export function workspaceColor(org: Colourish | null | undefined): string {
  if (!org) return NO_COLOR_SET;
  if (org.kind === 'agency') return STUDIO_COLOR;

  const settings = (org.settings ?? {}) as {
    workspace_color?: unknown;
    brand?: { colors?: Array<{ hex?: unknown }> };
  };

  const chosen = hex(settings.workspace_color);
  if (chosen) return chosen;

  const fromKit = hex(settings.brand?.colors?.[0]?.hex);
  if (fromKit) return fromKit;

  return NO_COLOR_SET;
}

/**
 * The line under the workspace name.
 *
 * Says what the business is, not what the database calls it. "Contractor" is
 * a column value; "Service business" is a description somebody would accept
 * about themselves.
 */
export function workspaceKindLabel(kind: string | null | undefined): string {
  if (kind === 'agency') return 'Your studio';
  if (kind === 'contractor') return 'Service business';
  if (kind === 'rep') return 'Sales rep';
  return 'Custom';
}

/**
 * Initials for a workspace with no logo. Two letters at most: three is a
 * monogram and starts competing with the name beside it.
 */
export function workspaceInitials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Black or white text on that colour, by luminance.
 *
 * The plate carries initials on the workspace colour, and a client's colour
 * can be anything — Ember & Ash is a mid red, Tideline a near-black. One
 * fixed text colour is unreadable on one of them.
 */
export function readableOn(background: string): string {
  const h = background.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  if (Number.isNaN(n)) return '#FFFFFF';
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? '#111111' : '#FFFFFF';
}

/**
 * The workspace's own mark, if it has uploaded one.
 *
 * Same source the switcher already reads: the light logo from the brand kit,
 * falling back to the first logo of any kind. Null when there is none, and
 * the plate draws initials instead.
 */
export function workspaceLogo(org: Colourish | null | undefined): string | null {
  const b = ((org?.settings ?? {}) as Record<string, unknown>).brand as
    | { logoLight?: string; logos?: string[] }
    | undefined;
  return (b?.logoLight || b?.logos?.[0] || '').trim() || null;
}
