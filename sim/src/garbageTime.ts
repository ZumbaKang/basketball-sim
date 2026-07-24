import type { Player, PlayerGameLine, TeamGameLine } from "@basketball-sim/shared";
import { transferFieldGoalAttempt } from "./fieldGoalTransfer.js";

export const GARBAGE_TIME_MARGIN_MIN = 15;

const MIN_GARBAGE_TIME_SHIFT = 2;
const MAX_GARBAGE_TIME_SHIFT = 4;
const MIN_GARBAGE_TIME_FGA_SHIFT = 1;
const MAX_GARBAGE_TIME_FGA_SHIFT = 2;
const STARTER_COUNT = 5;
const MAX_SHIFTED_STARTERS = 2;
const MAX_BENCH_RECIPIENTS = 2;
const MIN_STARTER_MINUTES = 20;

type ActivePlayer = {
  player: Player;
  line: PlayerGameLine;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function activePlayers(line: TeamGameLine, roster: Player[]): ActivePlayer[] {
  const playersById = new Map(roster.map((player) => [player.id, player]));
  return line.players.flatMap((playerLine) => {
    const player = playersById.get(playerLine.playerId);
    return player ? [{ player, line: playerLine }] : [];
  });
}

function rankRotation(a: ActivePlayer, b: ActivePlayer): number {
  return (
    (a.player.rotationOrder ?? Number.MAX_SAFE_INTEGER) -
      (b.player.rotationOrder ?? Number.MAX_SAFE_INTEGER) ||
    b.player.ratings.overall - a.player.ratings.overall
  );
}

function garbageTimeMinutes(margin: number): number {
  const extraForMargin = Math.max(0, margin - GARBAGE_TIME_MARGIN_MIN) * 0.1;
  return round1(
    Math.min(
      MAX_GARBAGE_TIME_SHIFT,
      MIN_GARBAGE_TIME_SHIFT + extraForMargin,
    ),
  );
}

function garbageTimeFieldGoalAttempts(margin: number): number {
  const extraForMargin = Math.floor(
    Math.max(0, margin - GARBAGE_TIME_MARGIN_MIN) / 10,
  );
  return Math.min(
    MAX_GARBAGE_TIME_FGA_SHIFT,
    MIN_GARBAGE_TIME_FGA_SHIFT + extraForMargin,
  );
}

function removeStarterMinutes(starters: ActivePlayer[], target: number): number {
  let remaining = target;

  starters.forEach(({ line }, index) => {
    const donorsLeft = starters.length - index;
    const desired =
      donorsLeft === 1 ? remaining : round1(remaining / donorsLeft);
    const available = Math.max(0, line.minutes - MIN_STARTER_MINUTES);
    const shifted = round1(Math.min(desired, available));
    if (shifted <= 0) return;

    line.minutes = round1(line.minutes - shifted);
    remaining = round1(remaining - shifted);
  });

  return round1(target - remaining);
}

function addBenchMinutes(bench: ActivePlayer[], minutes: number): void {
  let remaining = minutes;

  bench.forEach(({ line }, index) => {
    const recipientsLeft = bench.length - index;
    const shifted =
      recipientsLeft === 1
        ? remaining
        : round1(remaining / recipientsLeft);
    line.minutes = round1(line.minutes + shifted);
    remaining = round1(remaining - shifted);
  });
}

function transferUsageToBench(
  starters: ActivePlayer[],
  bench: ActivePlayer[],
  target: number,
): void {
  for (let attempt = 0; attempt < target; attempt += 1) {
    const recipient = bench[attempt % bench.length]!;

    for (let offset = 0; offset < starters.length; offset += 1) {
      const donor = starters[(attempt + offset) % starters.length]!;
      if (
        donor.line.fga > 0 &&
        transferFieldGoalAttempt(donor.line, recipient.line)
      ) {
        break;
      }
    }
  }
}

export function isGarbageTimeGame(
  home: TeamGameLine,
  away: TeamGameLine,
): boolean {
  return Math.abs(home.pts - away.pts) >= GARBAGE_TIME_MARGIN_MIN;
}

/**
 * Approximate garbage time in an aggregate box score by moving two to four
 * minutes and one to two field-goal attempts from lower-priority starters to
 * the first reserves off the bench.
 */
export function applyGarbageTime(
  line: TeamGameLine,
  roster: Player[],
  margin: number,
): TeamGameLine {
  if (margin < GARBAGE_TIME_MARGIN_MIN) return line;

  const players = line.players.map((player) => ({ ...player }));
  const adjustedLine = { ...line, players };
  const rotation = activePlayers(adjustedLine, roster).sort(rankRotation);
  const starters = rotation
    .slice(0, STARTER_COUNT)
    .reverse()
    .slice(0, MAX_SHIFTED_STARTERS);
  const bench = rotation
    .slice(STARTER_COUNT)
    .slice(0, MAX_BENCH_RECIPIENTS);

  if (starters.length === 0 || bench.length === 0) return adjustedLine;

  const shifted = removeStarterMinutes(
    starters,
    garbageTimeMinutes(margin),
  );
  addBenchMinutes(bench, shifted);
  transferUsageToBench(
    starters,
    bench,
    garbageTimeFieldGoalAttempts(margin),
  );

  return {
    ...adjustedLine,
    players: players.sort((a, b) => b.minutes - a.minutes),
  };
}
