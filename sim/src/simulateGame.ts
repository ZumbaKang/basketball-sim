import type { GameResult, Player, PlayerGameLine, Team, TeamGameLine } from "@basketball-sim/shared";
import { applyClutchTime, isClutchGame } from "./clutch.js";
import {
  maxCredibleFreeThrowAttempts,
  maxCredibleFta,
} from "./freeThrows.js";
import { applyGarbageTime, isGarbageTimeGame } from "./garbageTime.js";
import { assertRealisticGameResult } from "./realism.js";

export type SimulateGameInput = {
  leagueId: string;
  homeTeam: Team;
  awayTeam: Team;
  homePlayers: Player[];
  awayPlayers: Player[];
  /** Players who appeared the previous day and are on a back-to-back. */
  homeSecondNightPlayerIds?: readonly string[];
  /** Players who appeared the previous day and are on a back-to-back. */
  awaySecondNightPlayerIds?: readonly string[];
  seed?: number;
};

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function fatigueMinuteMultiplier(player: Player, secondNightPlayerIds: ReadonlySet<string>): number {
  if (!secondNightPlayerIds.has(player.id)) return 1;
  const stamina = clamp(player.ratings.stamina, 0, 100);
  const penalty = 0.03 + ((100 - stamina) / 100) * 0.03;
  return 1 - penalty;
}

function fatigueEfficiencyPenalty(player: Player, secondNightPlayerIds: ReadonlySet<string>): number {
  if (!secondNightPlayerIds.has(player.id)) return 0;
  const stamina = clamp(player.ratings.stamina, 0, 100);
  return 0.01 + ((100 - stamina) / 100) * 0.01;
}

function availablePlayers(players: Player[]): Player[] {
  return players.filter((player) => player.injuredDays <= 0);
}

const REGULATION_TEAM_MINUTES = 240;
const MAX_PLAYER_MINUTES = 48;
const MINUTE_PRECISION = 10;
/** Soft ceiling for scoring-nudge FGA on any one rotation player. */
const MAX_SCORING_NUDGE_PLAYER_FGA = 40;
/** NBA games require five players on the floor; short of that we refuse to sim. */
export const MIN_AVAILABLE_PLAYERS = 5;

function describeAvailablePlayerShortage(
  side: "home" | "away",
  team: Team,
  inputPlayers: readonly Player[],
  available: readonly Player[],
): string | null {
  if (available.length >= MIN_AVAILABLE_PLAYERS) return null;

  const sideLabel = `${side} team ${team.name}`;
  const need = `need at least ${MIN_AVAILABLE_PLAYERS}`;

  if (inputPlayers.length === 0) {
    return `${sideLabel} has an empty roster (${need} available players)`;
  }

  if (available.length === 0) {
    return `${sideLabel} has 0 available players because all ${inputPlayers.length} are injured (${need})`;
  }

  return `${sideLabel} has ${available.length} available player${
    available.length === 1 ? "" : "s"
  } (${need})`;
}

function assertMinimumAvailablePlayers(
  homeTeam: Team,
  homeInput: readonly Player[],
  homeAvailable: readonly Player[],
  awayTeam: Team,
  awayInput: readonly Player[],
  awayAvailable: readonly Player[],
): void {
  const shortages = [
    describeAvailablePlayerShortage("home", homeTeam, homeInput, homeAvailable),
    describeAvailablePlayerShortage("away", awayTeam, awayInput, awayAvailable),
  ].filter((message): message is string => message !== null);

  if (shortages.length > 0) {
    throw new Error(`Cannot simulate game: ${shortages.join("; ")}.`);
  }
}

function balanceShortRotationMinutes(
  minutes: Map<string, number>,
  players: Player[],
): Map<string, number> {
  const minuteUnits = new Map(
    players.map((player) => [
      player.id,
      Math.round(
        clamp(minutes.get(player.id) ?? 0, 0, MAX_PLAYER_MINUTES) *
          MINUTE_PRECISION,
      ),
    ]),
  );
  const targetUnits = REGULATION_TEAM_MINUTES * MINUTE_PRECISION;
  const maximumUnits = MAX_PLAYER_MINUTES * MINUTE_PRECISION;
  let assignedUnits = [...minuteUnits.values()].reduce((sum, value) => sum + value, 0);

  while (assignedUnits < targetUnits) {
    const eligible = players.filter(
      (player) => (minuteUnits.get(player.id) ?? 0) < maximumUnits,
    );
    if (eligible.length === 0) break;

    const share = Math.max(
      1,
      Math.floor((targetUnits - assignedUnits) / eligible.length),
    );
    for (const player of eligible) {
      const current = minuteUnits.get(player.id) ?? 0;
      const added = Math.min(
        share,
        maximumUnits - current,
        targetUnits - assignedUnits,
      );
      minuteUnits.set(player.id, current + added);
      assignedUnits += added;
      if (assignedUnits === targetUnits) break;
    }
  }

  while (assignedUnits > targetUnits) {
    const eligible = [...players]
      .reverse()
      .filter((player) => (minuteUnits.get(player.id) ?? 0) > 0);
    if (eligible.length === 0) break;

    const share = Math.max(
      1,
      Math.floor((assignedUnits - targetUnits) / eligible.length),
    );
    for (const player of eligible) {
      const current = minuteUnits.get(player.id) ?? 0;
      const removed = Math.min(
        share,
        current,
        assignedUnits - targetUnits,
      );
      minuteUnits.set(player.id, current - removed);
      assignedUnits -= removed;
      if (assignedUnits === targetUnits) break;
    }
  }

  return new Map(
    players.map((player) => [
      player.id,
      (minuteUnits.get(player.id) ?? 0) / MINUTE_PRECISION,
    ]),
  );
}

function allocateMinutes(
  players: Player[],
  rng: () => number,
  secondNightPlayerIds: ReadonlySet<string>,
): Map<string, number> {
  const sorted = [...players].sort(
    (a, b) =>
      (a.rotationOrder ?? 99) - (b.rotationOrder ?? 99) ||
      b.ratings.overall - a.ratings.overall,
  );
  const minutes = new Map<string, number>();
  if (sorted.length === 0) return minutes;

  // Honor targetMinutes when present and roughly sum to team minutes
  const withTargets = sorted.filter((p) => (p.targetMinutes ?? 0) > 0);
  if (withTargets.length >= 5) {
    const raw = new Map(
      withTargets.map((p) => [
        p.id,
        (p.targetMinutes ?? 0) * fatigueMinuteMultiplier(p, secondNightPlayerIds),
      ]),
    );
    const total = [...raw.values()].reduce((a, b) => a + b, 0) || 1;
    const scale = 240 / total;
    for (const [id, m] of raw) {
      minutes.set(id, round1(clamp(m * scale + (rng() - 0.5) * 2, 4, 40)));
    }
    if (sorted.length >= 5 && sorted.length <= 7) {
      return balanceShortRotationMinutes(minutes, sorted);
    }
    const assigned = [...minutes.values()].reduce((a, b) => a + b, 0);
    const top = withTargets[0]!;
    minutes.set(top.id, round1((minutes.get(top.id) ?? 0) + (240 - assigned)));
    return minutes;
  }

  const starters = sorted.slice(0, Math.min(5, sorted.length));
  const bench = sorted.slice(5);

  let remaining = 240;
  for (let i = 0; i < starters.length; i++) {
    const p = starters[i]!;
    const base = 28 + (starters.length - i) * 1.5 + rng() * 4;
    const m = clamp(base * fatigueMinuteMultiplier(p, secondNightPlayerIds), 24, 38);
    minutes.set(p.id, m);
    remaining -= m;
  }

  if (bench.length === 0) {
    if (sorted.length >= 5) {
      return balanceShortRotationMinutes(minutes, sorted);
    }
    return minutes;
  }

  const benchWeights = bench.map(
    (p) =>
      (0.4 + p.ratings.overall / 100 + p.ratings.stamina / 200) *
      fatigueMinuteMultiplier(p, secondNightPlayerIds),
  );
  const weightSum = benchWeights.reduce((a, b) => a + b, 0);
  let assigned = 0;
  bench.forEach((p, i) => {
    const share = (benchWeights[i]! / weightSum) * remaining;
    const m = clamp(share + (rng() - 0.5) * 2, 4, 28);
    minutes.set(p.id, round1(m));
    assigned += m;
  });

  const drift = remaining - assigned;
  const topBench = bench[0]!;
  minutes.set(topBench.id, round1((minutes.get(topBench.id) ?? 0) + drift));

  if (sorted.length >= 5 && sorted.length <= 7) {
    return balanceShortRotationMinutes(minutes, sorted);
  }

  // Normalize to ~240 team minutes
  const total = [...minutes.values()].reduce((a, b) => a + b, 0);
  const scale = 240 / total;
  for (const [id, m] of minutes) {
    minutes.set(id, round1(m * scale));
  }

  return minutes;
}

function simulateTeamLine(
  team: Team,
  players: Player[],
  opponentDefense: number,
  rng: () => number,
  secondNightPlayerIds: ReadonlySet<string>,
): TeamGameLine {
  const minuteMap = allocateMinutes(players, rng, secondNightPlayerIds);
  const lines: PlayerGameLine[] = [];

  for (const player of players) {
    const minutes = minuteMap.get(player.id) ?? 0;
    if (minutes <= 0) continue;

    const usage = (0.12 + player.ratings.offense / 500 + player.ratings.playmaking / 800) * (minutes / 36);
    const paceFactor = 1 + (rng() - 0.5) * 0.08;
    const fga = Math.max(0, Math.round(usage * 18 * paceFactor + rng() * 2));
    const fatiguePenalty = fatigueEfficiencyPenalty(player, secondNightPlayerIds);
    const fgPct = clamp(
      0.38 +
        player.ratings.shooting / 400 -
        opponentDefense / 900 +
        (rng() - 0.5) * 0.06 -
        fatiguePenalty,
      0.28,
      0.62,
    );
    const fgm = Math.min(fga, Math.round(fga * fgPct));

    const threeRate = clamp(0.25 + (player.position === "PG" || player.position === "SG" || player.position === "SF" ? 0.15 : 0), 0.05, 0.55);
    const tpa = Math.min(fga, Math.round(fga * threeRate));
    const tpPct = clamp(
      0.28 + player.ratings.shooting / 450 + (rng() - 0.5) * 0.08 - fatiguePenalty,
      0.2,
      0.48,
    );
    const tpm = Math.min(tpa, Math.round(tpa * tpPct));

    // Ensure 2PT makes are consistent: fgm >= tpm
    const adjustedFgm = Math.max(fgm, tpm);

    const rawFta = Math.max(
      0,
      Math.round(fga * (0.18 + player.ratings.offense / 600) + rng()),
    );
    const fta = Math.min(
      rawFta,
      maxCredibleFreeThrowAttempts(fga, minutes, player.ratings.offense),
    );
    const ftPct = clamp(
      0.65 + player.ratings.shooting / 350 + (rng() - 0.5) * 0.05 - fatiguePenalty,
      0.55,
      0.95,
    );
    const ftm = Math.min(fta, Math.round(fta * ftPct));

    const twoPm = adjustedFgm - tpm;
    const pts = twoPm * 2 + tpm * 3 + ftm;

    const reb = Math.max(
      0,
      Math.round((minutes / 48) * (4 + player.ratings.rebounding / 12) + (rng() - 0.5) * 3),
    );
    const ast = Math.max(
      0,
      Math.round((minutes / 48) * (2 + player.ratings.playmaking / 14) + (rng() - 0.5) * 2),
    );
    const stl = Math.max(0, Math.round((minutes / 48) * (0.5 + player.ratings.defense / 80) * rng() * 2));
    const blk = Math.max(
      0,
      Math.round(
        (minutes / 48) *
          (0.3 + player.ratings.defense / 90) *
          (player.position === "C" || player.position === "PF" ? 1.4 : 0.7) *
          rng() *
          2,
      ),
    );
    const tov = Math.max(0, Math.round((minutes / 48) * (1.2 + (100 - player.ratings.playmaking) / 50) * rng() * 1.5));

    lines.push({
      playerId: player.id,
      playerName: player.name,
      teamId: team.id,
      minutes: round1(minutes),
      pts,
      reb,
      ast,
      stl,
      blk,
      tov,
      fgm: adjustedFgm,
      fga: Math.max(adjustedFgm, fga),
      tpm,
      tpa: Math.max(tpm, tpa),
      ftm,
      fta: Math.max(ftm, fta),
      plusMinus: Math.round((rng() - 0.5) * 24),
    });
  }

  // Ensure at least some scoring if empty roster edge case
  if (lines.length === 0) {
    return {
      teamId: team.id,
      teamName: team.name,
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      fgm: 0,
      fga: 0,
      tpm: 0,
      tpa: 0,
      ftm: 0,
      fta: 0,
      players: [],
    };
  }

  const sum = (key: keyof PlayerGameLine) =>
    lines.reduce((acc, line) => acc + (typeof line[key] === "number" ? (line[key] as number) : 0), 0);

  return {
    teamId: team.id,
    teamName: team.name,
    pts: sum("pts"),
    reb: sum("reb"),
    ast: sum("ast"),
    stl: sum("stl"),
    blk: sum("blk"),
    tov: sum("tov"),
    fgm: sum("fgm"),
    fga: sum("fga"),
    tpm: sum("tpm"),
    tpa: sum("tpa"),
    ftm: sum("ftm"),
    fta: sum("fta"),
    players: lines.sort((a, b) => b.minutes - a.minutes),
  };
}

function idFromSeed(seed: number): string {
  return `game_${seed.toString(16)}_${Date.now().toString(36)}`;
}

/**
 * Simulate a single game and return a contract-compliant GameResult.
 * Box score lines are reconciled (team totals = player sums; makes ≤ attempts).
 */
export function simulateGame(input: SimulateGameInput): GameResult {
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000_000);
  const rng = createRng(seed);
  const homePlayers = availablePlayers(input.homePlayers);
  const awayPlayers = availablePlayers(input.awayPlayers);
  assertMinimumAvailablePlayers(
    input.homeTeam,
    input.homePlayers,
    homePlayers,
    input.awayTeam,
    input.awayPlayers,
    awayPlayers,
  );

  const homeDef =
    homePlayers.reduce((a, p) => a + p.ratings.defense, 0) / Math.max(1, homePlayers.length);
  const awayDef =
    awayPlayers.reduce((a, p) => a + p.ratings.defense, 0) / Math.max(1, awayPlayers.length);

  let home = simulateTeamLine(
    input.homeTeam,
    homePlayers,
    awayDef,
    rng,
    new Set(input.homeSecondNightPlayerIds ?? []),
  );
  let away = simulateTeamLine(
    input.awayTeam,
    awayPlayers,
    homeDef,
    rng,
    new Set(input.awaySecondNightPlayerIds ?? []),
  );

  // Nudge totals into a plausible NBA scoring band if needed
  const nudge = (line: TeamGameLine, targetMin: number, targetMax: number): TeamGameLine => {
    if (line.players.length === 0) return line;
    if (line.pts >= targetMin && line.pts <= targetMax) return line;
    const target = Math.round(targetMin + rng() * (targetMax - targetMin));
    let remaining = target - line.pts;
    // Split makes across the top two minute leaders so one player does not
    // absorb an entire under-scored team's deficit (and blow past 40 FGA).
    const scorers = line.players.slice(0, Math.min(2, line.players.length));
    let turn = 0;

    // Prefer made twos for bulk scoring; free throws only within the FGA cap.
    while (remaining > 0) {
      let picked: PlayerGameLine | null = null;
      for (let offset = 0; offset < scorers.length; offset++) {
        const candidate = scorers[(turn + offset) % scorers.length]!;
        const ftaRoom = maxCredibleFta(candidate.fga) - candidate.fta;
        const needsSinglePoint = remaining === 1 && ftaRoom > 0;
        const canTakeTwo = candidate.fga < MAX_SCORING_NUDGE_PLAYER_FGA;
        if (needsSinglePoint || canTakeTwo) {
          picked = candidate;
          turn = (turn + offset + 1) % scorers.length;
          break;
        }
      }
      if (!picked) {
        // Both scorers are at the FGA ceiling with no FT room — stop rather
        // than push one past 40 attempts.
        break;
      }

      const ftaRoom = maxCredibleFta(picked.fga) - picked.fta;
      if (remaining === 1 && ftaRoom > 0) {
        picked.ftm += 1;
        picked.fta += 1;
        picked.pts += 1;
        remaining -= 1;
        continue;
      }
      if (picked.fga >= MAX_SCORING_NUDGE_PLAYER_FGA) {
        // Eligible only via FT above; no room left for a made two.
        break;
      }
      // Made two (also used when remaining is 1 with no FT room — may overshoot by 1).
      picked.fgm += 1;
      picked.fga += 1;
      picked.pts += 2;
      remaining -= 2;
    }

    return rescoreTeamLine(line);
  };

  home = nudge(home, 95, 125);
  away = nudge(away, 95, 125);

  if (isGarbageTimeGame(home, away)) {
    const margin = Math.abs(home.pts - away.pts);
    home = applyGarbageTime(home, homePlayers, margin);
    away = applyGarbageTime(away, awayPlayers, margin);
  } else if (isClutchGame(home, away)) {
    home = applyClutchTime(home, homePlayers);
    away = applyClutchTime(away, awayPlayers);
  }

  home = enforceCredibleFreeThrows(home);
  away = enforceCredibleFreeThrows(away);

  const result: GameResult = {
    id: idFromSeed(seed),
    leagueId: input.leagueId,
    home,
    away,
    playedAt: new Date().toISOString(),
  };

  assertRealisticGameResult(result);
  return result;
}

function rescoreTeamLine(line: TeamGameLine): TeamGameLine {
  const sum = (key: keyof PlayerGameLine) =>
    line.players.reduce(
      (acc, p) => acc + (typeof p[key] === "number" ? (p[key] as number) : 0),
      0,
    );

  return {
    ...line,
    pts: sum("pts"),
    reb: sum("reb"),
    ast: sum("ast"),
    stl: sum("stl"),
    blk: sum("blk"),
    tov: sum("tov"),
    fgm: sum("fgm"),
    fga: sum("fga"),
    tpm: sum("tpm"),
    tpa: sum("tpa"),
    ftm: sum("ftm"),
    fta: sum("fta"),
    players: line.players,
  };
}

/**
 * After minute/usage shifts, re-clamp FTA to the FGA ratio and convert any
 * trimmed free-throw points into made twos so team totals still reconcile.
 */
function enforceCredibleFreeThrows(line: TeamGameLine): TeamGameLine {
  for (const player of line.players) {
    const maxFta = maxCredibleFta(player.fga);
    if (player.fta <= maxFta) {
      player.fta = Math.max(player.fta, player.ftm);
      continue;
    }

    const newFtm = Math.min(player.ftm, maxFta);
    let replace = player.ftm - newFtm;
    player.ftm = newFtm;
    player.fta = maxFta;
    player.pts -= replace;

    while (replace >= 2) {
      player.fgm += 1;
      player.fga += 1;
      player.pts += 2;
      replace -= 2;
    }
    if (replace === 1) {
      if (player.fta < maxCredibleFta(player.fga)) {
        player.ftm += 1;
        player.fta += 1;
        player.pts += 1;
      } else {
        player.fgm += 1;
        player.fga += 1;
        player.pts += 2;
      }
    }
  }

  return rescoreTeamLine(line);
}

export { assertRealisticGameResult } from "./realism.js";
