import type { GameResult, Player, PlayerGameLine, Team, TeamGameLine } from "@basketball-sim/shared";
import { applyClutchTime, isClutchGame } from "./clutch.js";
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
    // Redistribute leftover to starters
    const extra = remaining / starters.length;
    for (const p of starters) {
      minutes.set(p.id, round1((minutes.get(p.id) ?? 0) + extra));
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

    const fta = Math.max(0, Math.round(fga * (0.18 + player.ratings.offense / 600) + rng()));
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

  const homeDef =
    input.homePlayers.reduce((a, p) => a + p.ratings.defense, 0) / Math.max(1, input.homePlayers.length);
  const awayDef =
    input.awayPlayers.reduce((a, p) => a + p.ratings.defense, 0) / Math.max(1, input.awayPlayers.length);

  let home = simulateTeamLine(
    input.homeTeam,
    input.homePlayers,
    awayDef,
    rng,
    new Set(input.homeSecondNightPlayerIds ?? []),
  );
  let away = simulateTeamLine(
    input.awayTeam,
    input.awayPlayers,
    homeDef,
    rng,
    new Set(input.awaySecondNightPlayerIds ?? []),
  );

  // Nudge totals into a plausible NBA scoring band if needed
  const nudge = (line: TeamGameLine, targetMin: number, targetMax: number): TeamGameLine => {
    if (line.players.length === 0) return line;
    if (line.pts >= targetMin && line.pts <= targetMax) return line;
    const target = Math.round(targetMin + rng() * (targetMax - targetMin));
    const diff = target - line.pts;
    const star = line.players[0]!;
    const addFtm = Math.max(0, diff);
    star.ftm += addFtm;
    star.fta = Math.max(star.fta, star.ftm);
    star.pts += addFtm;

    const sum = (key: keyof PlayerGameLine) =>
      line.players.reduce((acc, p) => acc + (typeof p[key] === "number" ? (p[key] as number) : 0), 0);

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
  };

  home = nudge(home, 95, 125);
  away = nudge(away, 95, 125);

  if (isGarbageTimeGame(home, away)) {
    const margin = Math.abs(home.pts - away.pts);
    home = applyGarbageTime(home, input.homePlayers, margin);
    away = applyGarbageTime(away, input.awayPlayers, margin);
  } else if (isClutchGame(home, away)) {
    home = applyClutchTime(home, input.homePlayers);
    away = applyClutchTime(away, input.awayPlayers);
  }

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

export { assertRealisticGameResult } from "./realism.js";
