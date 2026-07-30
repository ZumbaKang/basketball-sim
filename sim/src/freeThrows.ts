/**
 * Credible free-throw volume relative to field-goal attempts.
 *
 * NBA foul-drawing outliers can approach ~1 FTA per FGA in a single game;
 * lines like 30 FTA on 3–5 FGA are not credible.
 */
export const MAX_FTA_PER_FGA = 1.0;
/** Extra attempts allowed for and-ones / loose-ball fouls beyond the FGA ratio. */
export const FTA_BUFFER = 2;

/** Hard ceiling on FTA from FGA alone (used by realism asserts). */
export function maxCredibleFta(fga: number): number {
  return Math.ceil(Math.max(0, fga) * MAX_FTA_PER_FGA) + FTA_BUFFER;
}

/**
 * Approximate FTA available from fouls drawn given minutes and offense.
 * High-usage scorers draw more; low-minute reserves stay bounded.
 */
export function maxFtaFromFoulsDrawn(minutes: number, offenseRating: number): number {
  const offense = Math.max(0, Math.min(100, offenseRating));
  const foulTripRate = 0.1 + offense / 400; // ~0.10–0.35 trips per minute
  return Math.max(0, Math.ceil(Math.max(0, minutes) * foulTripRate * 2));
}

/** Combined shot-attempt and fouls-drawn ceiling for a player line. */
export function maxCredibleFreeThrowAttempts(
  fga: number,
  minutes: number,
  offenseRating: number,
): number {
  return Math.min(maxCredibleFta(fga), maxFtaFromFoulsDrawn(minutes, offenseRating));
}
