import { describe, expect, it } from "vitest";
import type { Player, Team } from "@basketball-sim/shared";
import { assertRealisticGameResult, simulateGame } from "../src/index.js";

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
});
