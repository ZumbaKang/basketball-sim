import type {
  Coach,
  CoachStaffingIntent,
  GmDirection,
  GmProfile,
  Player,
} from "@basketball-sim/shared";

export type CoachEvaluationInput = {
  teamId: string;
  direction: GmDirection;
  roster: Array<Pick<Player, "ratings">>;
  currentCoach: Coach;
  candidates: Coach[];
  owner?: Pick<GmProfile, "aggression" | "loyalty">;
};

const MIN_EVALUATION_GAMES = 20;
const ROTATION_WEIGHTS = [1.6, 1.4, 1.25, 1.1, 1, 0.9, 0.8, 0.7];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundedRate(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export function rosterTalentRating(
  roster: Array<Pick<Player, "ratings">>,
): number | null {
  const rotation = roster
    .map((player) => player.ratings.overall)
    .filter(Number.isFinite)
    .sort((a, b) => b - a)
    .slice(0, ROTATION_WEIGHTS.length);

  if (!rotation.length) return null;

  const weightedTotal = rotation.reduce(
    (total, rating, index) =>
      total + rating * (ROTATION_WEIGHTS[index] ?? 1),
    0,
  );
  const totalWeight = rotation.reduce(
    (total, _rating, index) =>
      total + (ROTATION_WEIGHTS[index] ?? 1),
    0,
  );
  return weightedTotal / totalWeight;
}

export function expectedWinPct(
  talentRating: number,
  direction: GmDirection,
): number {
  const directionAdjustment: Record<GmDirection, number> = {
    contend: 0.04,
    window: 0.02,
    rebuild: -0.04,
    tank: -0.08,
    cheap: -0.01,
  };

  return clamp(
    0.5 + (talentRating - 75) * 0.035 + directionAdjustment[direction],
    0.2,
    0.8,
  );
}

function candidateScore(coach: Coach, direction: GmDirection): number {
  const developmentTeam = direction === "rebuild" || direction === "tank";
  const baseScore = developmentTeam
    ? coach.rating * 0.45 + coach.development * 0.55
    : coach.rating * 0.8 + coach.development * 0.2;
  const styleBonus = developmentTeam
    ? coach.style === "development"
      ? 8
      : 0
    : coach.style === "offense" || coach.style === "defense"
      ? 3
      : coach.style === "balanced"
        ? 2
        : 0;

  return baseScore + styleBonus;
}

function chooseReplacement(
  currentCoach: Coach,
  candidates: Coach[],
  direction: GmDirection,
): Coach | null {
  const currentScore = candidateScore(currentCoach, direction);
  const minimumScore = Math.max(60, currentScore - 2);
  const eligible = candidates
    .filter(
      (candidate) =>
        candidate.id !== currentCoach.id &&
        candidate.teamId === null &&
        Number.isFinite(candidate.rating) &&
        Number.isFinite(candidate.development),
    )
    .map((candidate) => ({
      candidate,
      score: candidateScore(candidate, direction),
    }))
    .filter(({ score }) => score >= minimumScore)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.candidate.name.localeCompare(b.candidate.name) ||
        a.candidate.id.localeCompare(b.candidate.id),
    );

  return eligible[0]?.candidate ?? null;
}

function firingTolerance(input: CoachEvaluationInput): number {
  const aggression = clamp(input.owner?.aggression ?? 0.5, 0, 1);
  const loyalty = clamp(input.owner?.loyalty ?? 0.5, 0, 1);
  const directionAdjustment: Record<GmDirection, number> = {
    contend: -1,
    window: -0.5,
    rebuild: 2,
    tank: 3,
    cheap: 0.5,
  };
  const newCoachRunway = input.currentCoach.seasonsWithTeam <= 1 ? 1.5 : 0;

  return (
    6 +
    loyalty * 3 -
    aggression * 2 +
    directionAdjustment[input.direction] +
    newCoachRunway
  );
}

function retain(
  input: CoachEvaluationInput,
  actualWinPct: number,
  expectedPct: number,
  reason: string,
): CoachStaffingIntent {
  return {
    action: "retain",
    teamId: input.teamId,
    coachId: input.currentCoach.id,
    actualWinPct: roundedRate(actualWinPct),
    expectedWinPct: roundedRate(expectedPct),
    reason,
  };
}

export function evaluateCoachStaffing(
  input: CoachEvaluationInput,
): CoachStaffingIntent {
  const coachWins = Math.max(0, Math.floor(input.currentCoach.seasonWins));
  const coachLosses = Math.max(
    0,
    Math.floor(input.currentCoach.seasonLosses),
  );
  const gamesPlayed = Math.max(
    0,
    coachWins + coachLosses,
  );
  const actualWinPct =
    gamesPlayed > 0 ? clamp(coachWins / gamesPlayed, 0, 1) : 0;
  const talentRating = rosterTalentRating(input.roster);

  if (talentRating === null) {
    return retain(
      input,
      actualWinPct,
      0.5,
      "Retained: roster talent data is unavailable, so expectations cannot be evaluated.",
    );
  }

  const expectedPct = expectedWinPct(talentRating, input.direction);
  const expectedWins = expectedPct * gamesPlayed;

  if (gamesPlayed < MIN_EVALUATION_GAMES) {
    return retain(
      input,
      actualWinPct,
      expectedPct,
      `Retained: ${gamesPlayed} games is too early to judge performance against a ${expectedWins.toFixed(1)}-win expectation.`,
    );
  }

  const winShortfall = expectedWins - coachWins;
  const pctShortfall = expectedPct - actualWinPct;
  const tolerance = firingTolerance(input);

  if (winShortfall < tolerance || pctShortfall < 0.1) {
    return retain(
      input,
      actualWinPct,
      expectedPct,
      `Retained: the coach's ${coachWins}-${coachLosses} record is within ${tolerance.toFixed(1)} wins of the expectation for a ${talentRating.toFixed(1)}-rated roster.`,
    );
  }

  const replacement = chooseReplacement(
    input.currentCoach,
    input.candidates,
    input.direction,
  );
  if (!replacement) {
    return retain(
      input,
      actualWinPct,
      expectedPct,
      `Retained for now: the coach's ${coachWins}-${coachLosses} record trails the ${expectedWins.toFixed(1)}-win expectation, but no qualified replacement is available.`,
    );
  }

  return {
    action: "fire-and-hire",
    teamId: input.teamId,
    firedCoachId: input.currentCoach.id,
    hiredCoachId: replacement.id,
    actualWinPct: roundedRate(actualWinPct),
    expectedWinPct: roundedRate(expectedPct),
    reason: `Changed coaches: a ${talentRating.toFixed(1)}-rated roster was expected to win ${expectedWins.toFixed(1)} of ${gamesPlayed} games, but the coach went ${coachWins}-${coachLosses}; ${replacement.name}'s ${replacement.style} approach is the best available fit for a ${input.direction} team.`,
  };
}
