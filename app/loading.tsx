import { RowsLoading, Skeleton } from '@/components/spine/ui';

/**
 * The route-level wait, between one screen and the next.
 *
 * Next renders this while a route's code and data are on the way, so it is
 * the first thing shown on every navigation that is not instant. It was the
 * word "Loading…" centred in a 60vh box, which is both the least informative
 * thing it could say and the wrong shape: the screen that replaces it starts
 * with a title at the top left, not a sentence in the middle.
 *
 * It cannot know which screen is coming, so it holds the one shape they all
 * share - a title, a subtitle, and a list.
 */
export default function Loading() {
  return (
    <div style={{ padding: '4px 0' }} role="status" aria-label="Loading">
      <Skeleton w={240} h={27} style={{ marginBottom: 10, maxWidth: '100%' }} />
      <Skeleton w={170} h={12} style={{ marginBottom: 24, maxWidth: '100%' }} />
      <RowsLoading rows={4} />
    </div>
  );
}
