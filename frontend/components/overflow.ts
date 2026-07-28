export type ScrollMetrics = {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
};

/** Sub-pixel layout rounding means an "unscrollable" region can still be off by a hair. */
const EPSILON = 2;

export function isOverflowing({ scrollWidth, clientWidth }: ScrollMetrics): boolean {
  return scrollWidth - clientWidth > EPSILON;
}

export function isAtInlineEnd({ scrollLeft, scrollWidth, clientWidth }: ScrollMetrics): boolean {
  return scrollWidth - clientWidth - scrollLeft <= EPSILON;
}

/**
 * Only prompt when there is something offscreen AND the reader hasn't already
 * scrolled to the far edge, so the hint disappears once it has done its job.
 */
export function shouldShowScrollHint(metrics: ScrollMetrics): boolean {
  return isOverflowing(metrics) && !isAtInlineEnd(metrics);
}
