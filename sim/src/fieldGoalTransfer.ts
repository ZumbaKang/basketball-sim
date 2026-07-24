import type { PlayerGameLine } from "@basketball-sim/shared";

/**
 * Move one field-goal attempt between player lines without changing team
 * shooting or point totals.
 */
export function transferFieldGoalAttempt(
  donor: PlayerGameLine,
  recipient: PlayerGameLine,
): boolean {
  const missedThrees = donor.tpa - donor.tpm;
  const missedTwos = donor.fga - donor.fgm - missedThrees;
  const madeTwos = donor.fgm - donor.tpm;

  donor.fga -= 1;
  recipient.fga += 1;

  if (missedThrees > 0) {
    donor.tpa -= 1;
    recipient.tpa += 1;
    return true;
  }

  if (missedTwos > 0) return true;

  if (madeTwos > 0) {
    donor.fgm -= 1;
    donor.pts -= 2;
    recipient.fgm += 1;
    recipient.pts += 2;
    return true;
  }

  if (donor.tpm > 0) {
    donor.fgm -= 1;
    donor.tpm -= 1;
    donor.tpa -= 1;
    donor.pts -= 3;
    recipient.fgm += 1;
    recipient.tpm += 1;
    recipient.tpa += 1;
    recipient.pts += 3;
    return true;
  }

  donor.fga += 1;
  recipient.fga -= 1;
  return false;
}
