import type { Player, PlayerGameLine, TeamGameLine } from "@basketball-sim/shared";
import { transferFieldGoalAttempt } from "./fieldGoalTransfer.js";

export const CLUTCH_MARGIN_MAX = 5;

const CLUTCH_STAR_COUNT = 2;
const CLUTCH_MINUTES_PER_STAR = 1.5;
const MIN_ROTATION_MINUTES = 4;

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

function rankStars(a: ActivePlayer, b: ActivePlayer): number {
  return (
    b.player.ratings.overall - a.player.ratings.overall ||
    b.player.ratings.offense - a.player.ratings.offense ||
    b.player.ratings.playmaking - a.player.ratings.playmaking ||
    a.player.rotationOrder - b.player.rotationOrder
  );
}

function rankDonors(a: ActivePlayer, b: ActivePlayer): number {
  return (
    b.player.rotationOrder - a.player.rotationOrder ||
    a.line.minutes - b.line.minutes ||
    a.player.ratings.overall - b.player.ratings.overall
  );
}

function transferMinutes(star: PlayerGameLine, donors: ActivePlayer[]): void {
  let remaining = CLUTCH_MINUTES_PER_STAR;

  for (const donor of donors) {
    const available = Math.max(0, donor.line.minutes - MIN_ROTATION_MINUTES);
    const shifted = round1(Math.min(remaining, available));
    if (shifted <= 0) continue;

    donor.line.minutes = round1(donor.line.minutes - shifted);
    star.minutes = round1(star.minutes + shifted);
    remaining = round1(remaining - shifted);
    if (remaining <= 0) return;
  }
}

function transferUsage(star: PlayerGameLine, donors: ActivePlayer[]): void {
  for (const donor of donors) {
    if (donor.line.fga > 0 && transferFieldGoalAttempt(donor.line, star)) return;
  }
}

/** NBA clutch time is the final two minutes with a margin of five points or fewer. */
export function isClutchGame(home: TeamGameLine, away: TeamGameLine): boolean {
  return Math.abs(home.pts - away.pts) <= CLUTCH_MARGIN_MAX;
}

/**
 * Approximate a closing lineup in the aggregate box score by moving late-game
 * minutes and shot attempts from the end of the rotation to two top creators.
 */
export function applyClutchTime(line: TeamGameLine, roster: Player[]): TeamGameLine {
  const players = line.players.map((player) => ({ ...player }));
  const adjustedLine = { ...line, players };
  const active = activePlayers(adjustedLine, roster);
  const stars = [...active].sort(rankStars).slice(0, CLUTCH_STAR_COUNT);
  const starIds = new Set(stars.map(({ player }) => player.id));
  const donors = active.filter(({ player }) => !starIds.has(player.id)).sort(rankDonors);

  for (const { line: star } of stars) {
    transferMinutes(star, donors);
    transferUsage(star, donors);
  }

  return {
    ...adjustedLine,
    players: players.sort((a, b) => b.minutes - a.minutes),
  };
}
