import { describe, expect, it } from "vitest";
import type { Player, Team } from "@basketball-sim/shared";
import {
  assertRealisticGameResult,
  maxCredibleFta,
  MIN_AVAILABLE_PLAYERS,
  simulateGame,
} from "../src/index.js";

function ratings(overall: number) {
  return {
    overall,
    offense: overall,
    defense: overall - 2,
    shooting: overall - 1,
    rebounding: overall - 5,
    playmaking: overall - 3,
    stamina: overall,
  };
}

function roster(teamId: string, prefix: string): Player[] {
  const positions = ["PG", "SG", "SF", "PF", "C", "PG", "SG", "SF", "PF", "C"] as const;
  return positions.map((position, i) => ({
    id: `${teamId}_p${i}`,
    teamId,
    name: `${prefix} Player ${i + 1}`,
    position,
    age: 24 + (i % 6),
    potential: 80,
    ratings: ratings(70 + (i % 5) * 3),
    rotationOrder: i,
    targetMinutes: i < 5 ? 32 - i : 14,
    injuredDays: 0,
    isFreeAgent: false,
  }));
}

const homeTeam: Team = {
  id: "t_home",
  leagueId: "lg1",
  name: "Harbor Hawks",
  abbreviation: "HHK",
  conference: "East",
  division: "Atlantic",
  wins: 0,
  losses: 0,
  gmDirection: "window",
};

const awayTeam: Team = {
  id: "t_away",
  leagueId: "lg1",
  name: "Metro Foxes",
  abbreviation: "MFX",
  conference: "East",
  division: "Atlantic",
  wins: 0,
  losses: 0,
  gmDirection: "rebuild",
};

describe("simulateGame", () => {
  it("keeps free-throw volume credible relative to field-goal attempts", () => {
    const outliers: Array<{
      seed: number;
      playerName: string;
      fga: number;
      fta: number;
    }> = [];

    for (let seed = 0; seed < 200; seed++) {
      const result = simulateGame({
        leagueId: "lg1",
        homeTeam,
        awayTeam,
        homePlayers: roster("t_home", "Harbor"),
        awayPlayers: roster("t_away", "Metro"),
        seed,
      });

      for (const side of [result.home, result.away]) {
        for (const line of side.players) {
          const maxFta = maxCredibleFta(line.fga);
          if (line.fta > maxFta) {
            outliers.push({
              seed,
              playerName: line.playerName,
              fga: line.fga,
              fta: line.fta,
            });
          }
          expect(line.fta).toBeLessThanOrEqual(maxFta);
        }
      }
      expect(() => assertRealisticGameResult(result)).not.toThrow();
    }

    expect(outliers).toEqual([]);
  });

  it("does not recreate the 30-FTA-on-few-FGA scoring-nudge line", () => {
    // Seed 74 previously produced 56 FTA on 6 FGA via FT-only nudging.
    const result = simulateGame({
      leagueId: "lg1",
      homeTeam,
      awayTeam,
      homePlayers: roster("t_home", "Harbor"),
      awayPlayers: roster("t_away", "Metro"),
      seed: 74,
    });

    for (const side of [result.home, result.away]) {
      for (const line of side.players) {
        expect(line.fta).toBeLessThanOrEqual(maxCredibleFta(line.fga));
        expect(line.fta).toBeLessThan(20);
      }
      expect(side.pts).toBeGreaterThanOrEqual(95);
      expect(side.pts).toBeLessThanOrEqual(126);
    }
    expect(() => assertRealisticGameResult(result)).not.toThrow();
  });

  it("produces a realistic reconciled box score", () => {
    const result = simulateGame({
      leagueId: "lg1",
      homeTeam,
      awayTeam,
      homePlayers: roster("t_home", "Harbor"),
      awayPlayers: roster("t_away", "Metro"),
      seed: 42,
    });

    expect(result.leagueId).toBe("lg1");
    expect(result.home.pts).toBeGreaterThan(80);
    expect(result.away.pts).toBeGreaterThan(80);
    expect(() => assertRealisticGameResult(result)).not.toThrow();
  });

  it("is deterministic for a fixed seed", () => {
    const input = {
      leagueId: "lg1",
      homeTeam,
      awayTeam,
      homePlayers: roster("t_home", "Harbor"),
      awayPlayers: roster("t_away", "Metro"),
      seed: 99,
    };
    const a = simulateGame(input);
    const b = simulateGame(input);
    expect(a.home.pts).toBe(b.home.pts);
    expect(a.away.pts).toBe(b.away.pts);
    expect(a.home.players.map((p) => p.pts)).toEqual(b.home.players.map((p) => p.pts));
  });

  it("keeps seeded clutch games realistic after closing-lineup shifts", () => {
    const result = simulateGame({
      leagueId: "lg1",
      homeTeam,
      awayTeam,
      homePlayers: roster("t_home", "Harbor"),
      awayPlayers: roster("t_away", "Metro"),
      seed: 4,
    });

    expect(Math.abs(result.home.pts - result.away.pts)).toBeLessThanOrEqual(5);
    expect(() => assertRealisticGameResult(result)).not.toThrow();
  });

  it.each([
    { seed: 6, margin: 15 },
    { seed: 73, margin: 25 },
  ])(
    "keeps a seeded $margin-point blowout realistic after garbage-time shifts",
    ({ seed, margin }) => {
      const input = {
        leagueId: "lg1",
        homeTeam,
        awayTeam,
        homePlayers: roster("t_home", "Harbor"),
        awayPlayers: roster("t_away", "Metro"),
        seed,
      };
      const result = simulateGame(input);
      const comparison = simulateGame(input);

      expect(Math.abs(result.home.pts - result.away.pts)).toBe(margin);
      expect(comparison.home.players.map(({ minutes }) => minutes)).toEqual(
        result.home.players.map(({ minutes }) => minutes),
      );
      expect(comparison.away.players.map(({ minutes }) => minutes)).toEqual(
        result.away.players.map(({ minutes }) => minutes),
      );
      expect(comparison.home.players.map(({ fga }) => fga)).toEqual(
        result.home.players.map(({ fga }) => fga),
      );
      expect(comparison.away.players.map(({ fga }) => fga)).toEqual(
        result.away.players.map(({ fga }) => fga),
      );
      expect(() => assertRealisticGameResult(result)).not.toThrow();
    },
  );

  it("applies a small minutes and efficiency penalty on a back-to-back", () => {
    const homePlayers = roster("t_home", "Harbor");
    const awayPlayers = roster("t_away", "Metro");
    const secondNightPlayerIds = homePlayers.slice(0, 5).map((player) => player.id);
    const input = {
      leagueId: "lg1",
      homeTeam,
      awayTeam,
      homePlayers,
      awayPlayers,
      seed: 31415,
    };

    const rested = simulateGame(input);
    const fatigued = simulateGame({
      ...input,
      homeSecondNightPlayerIds: secondNightPlayerIds,
    });
    const restedSecondNightMinutes = rested.home.players
      .filter((player) => secondNightPlayerIds.includes(player.playerId))
      .reduce((total, player) => total + player.minutes, 0);
    const fatiguedSecondNightMinutes = fatigued.home.players
      .filter((player) => secondNightPlayerIds.includes(player.playerId))
      .reduce((total, player) => total + player.minutes, 0);
    const restedFieldGoalPercentage = rested.home.fgm / rested.home.fga;
    const fatiguedFieldGoalPercentage = fatigued.home.fgm / fatigued.home.fga;

    expect(fatiguedSecondNightMinutes).toBeLessThan(restedSecondNightMinutes);
    expect(restedSecondNightMinutes - fatiguedSecondNightMinutes).toBeLessThan(8);
    expect(fatiguedFieldGoalPercentage).toBeLessThan(restedFieldGoalPercentage);
    expect(() => assertRealisticGameResult(fatigued)).not.toThrow();
  });

  it.each([
    { side: "home" as const, seed: 6 },
    { side: "away" as const, seed: 73 },
  ])(
    "keeps fatigued $side starters above 20 minutes during seeded garbage time",
    ({ side, seed }) => {
      const homePlayers = roster("t_home", "Harbor");
      const awayPlayers = roster("t_away", "Metro");
      const fatiguedRoster = side === "home" ? homePlayers : awayPlayers;
      const secondNightPlayerIds = fatiguedRoster
        .slice(0, 5)
        .map((player) => player.id);
      const result = simulateGame({
        leagueId: "lg1",
        homeTeam,
        awayTeam,
        homePlayers,
        awayPlayers,
        homeSecondNightPlayerIds:
          side === "home" ? secondNightPlayerIds : undefined,
        awaySecondNightPlayerIds:
          side === "away" ? secondNightPlayerIds : undefined,
        seed,
      });
      const fatiguedLine = result[side];
      const starterLines = secondNightPlayerIds.map((playerId) =>
        fatiguedLine.players.find((line) => line.playerId === playerId),
      );
      const teamMinutes = (team: typeof result.home) =>
        team.players.reduce((total, player) => total + player.minutes, 0);

      expect(Math.abs(result.home.pts - result.away.pts)).toBeGreaterThanOrEqual(
        15,
      );
      expect(starterLines).not.toContain(undefined);
      for (const line of starterLines) {
        expect(line!.minutes).toBeGreaterThan(20);
      }
      expect(teamMinutes(result.home)).toBeCloseTo(240, 5);
      expect(teamMinutes(result.away)).toBeCloseTo(240, 5);
      expect(() => assertRealisticGameResult(result)).not.toThrow();
    },
  );

  it.each([0, 1, 2, 3, 4])(
    "rejects a home roster with only %i available players before box-score generation",
    (availableCount) => {
      const shortenRoster = (players: Player[], count: number) =>
        players.map((player, index) => ({
          ...player,
          injuredDays: index < count ? 0 : 2,
        }));

      expect(() =>
        simulateGame({
          leagueId: "lg1",
          homeTeam,
          awayTeam,
          homePlayers: shortenRoster(roster("t_home", "Harbor"), availableCount),
          awayPlayers: roster("t_away", "Metro"),
          seed: 4100 + availableCount,
        }),
      ).toThrow(
        `Cannot simulate game: home team Harbor Hawks has ${availableCount} available player${
          availableCount === 1 ? "" : "s"
        } (need at least ${MIN_AVAILABLE_PLAYERS}).`,
      );
    },
  );

  it.each([0, 1, 2, 3, 4])(
    "rejects an away roster with only %i available players before box-score generation",
    (availableCount) => {
      const shortenRoster = (players: Player[], count: number) =>
        players.map((player, index) => ({
          ...player,
          injuredDays: index < count ? 0 : 2,
        }));

      expect(() =>
        simulateGame({
          leagueId: "lg1",
          homeTeam,
          awayTeam,
          homePlayers: roster("t_home", "Harbor"),
          awayPlayers: shortenRoster(roster("t_away", "Metro"), availableCount),
          seed: 4200 + availableCount,
        }),
      ).toThrow(
        `Cannot simulate game: away team Metro Foxes has ${availableCount} available player${
          availableCount === 1 ? "" : "s"
        } (need at least ${MIN_AVAILABLE_PLAYERS}).`,
      );
    },
  );

  it("rejects both sides when each has fewer than five available players", () => {
    const shortenRoster = (players: Player[], count: number) =>
      players.map((player, index) => ({
        ...player,
        injuredDays: index < count ? 0 : 2,
      }));

    expect(() =>
      simulateGame({
        leagueId: "lg1",
        homeTeam,
        awayTeam,
        homePlayers: shortenRoster(roster("t_home", "Harbor"), 2),
        awayPlayers: shortenRoster(roster("t_away", "Metro"), 0),
        seed: 4300,
      }),
    ).toThrow(
      `Cannot simulate game: home team Harbor Hawks has 2 available players (need at least ${MIN_AVAILABLE_PLAYERS}); away team Metro Foxes has 0 available players (need at least ${MIN_AVAILABLE_PLAYERS}).`,
    );
  });

  it.each([
    { availableCount: 5, seed: 4 },
    { availableCount: 6, seed: 5606 },
    { availableCount: 7, seed: 5707 },
  ])(
    "keeps $availableCount-player injury rotations at 240 minutes without exceeding regulation",
    ({ availableCount, seed }) => {
      const shortenRoster = (players: Player[]) =>
        players.map((player, index) => ({
          ...player,
          injuredDays: index < availableCount ? 0 : 2,
        }));
      const result = simulateGame({
        leagueId: "lg1",
        homeTeam,
        awayTeam,
        homePlayers: shortenRoster(roster("t_home", "Harbor")),
        awayPlayers: shortenRoster(roster("t_away", "Metro")),
        seed,
      });

      for (const team of [result.home, result.away]) {
        const teamMinutes = team.players.reduce(
          (total, player) => total + player.minutes,
          0,
        );

        expect(team.players).toHaveLength(availableCount);
        expect(teamMinutes).toBe(240);
        expect(
          Math.max(...team.players.map((player) => player.minutes)),
        ).toBeLessThanOrEqual(48);
      }
      if (availableCount === 5) {
        expect(Math.abs(result.home.pts - result.away.pts)).toBeLessThanOrEqual(5);
      }
      expect(() => assertRealisticGameResult(result)).not.toThrow();
    },
  );

  it("keeps an injured player out of multiple games and restores their rotation on return", () => {
    const healthyHomePlayers = roster("t_home", "Harbor");
    const awayPlayers = roster("t_away", "Metro");
    const returningPlayer = healthyHomePlayers[0]!;
    const scheduledInjuryDays = [2, 1, 0];

    const games = scheduledInjuryDays.map((injuredDays, index) =>
      simulateGame({
        leagueId: "lg1",
        homeTeam,
        awayTeam,
        homePlayers: healthyHomePlayers.map((player) =>
          player.id === returningPlayer.id ? { ...player, injuredDays } : player,
        ),
        awayPlayers,
        seed: 8800 + index,
      }),
    );

    expect(games[0]!.home.players.some((line) => line.playerId === returningPlayer.id)).toBe(false);
    expect(games[1]!.home.players.some((line) => line.playerId === returningPlayer.id)).toBe(false);

    const returnLine = games[2]!.home.players.find((line) => line.playerId === returningPlayer.id);
    const healthyBaseline = simulateGame({
      leagueId: "lg1",
      homeTeam,
      awayTeam,
      homePlayers: healthyHomePlayers,
      awayPlayers,
      seed: 8802,
    });
    const baselineLine = healthyBaseline.home.players.find(
      (line) => line.playerId === returningPlayer.id,
    );

    expect(returnLine?.minutes).toBe(baselineLine?.minutes);
    expect(returnLine?.minutes).toBeGreaterThan(24);
    for (const game of games) {
      expect(() => assertRealisticGameResult(game)).not.toThrow();
    }
  });
});
