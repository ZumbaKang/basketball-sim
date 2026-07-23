import { describe, expect, it } from "vitest";
import { evaluateTrade } from "./logic.js";
import type { EvaluablePlayer } from "./logic.js";

function p(partial: Partial<EvaluablePlayer> & { id: string; name: string }): EvaluablePlayer {
  return {
    teamId: "t",
    position: "SF",
    age: 26,
    potential: 80,
    ratings: {
      overall: 80,
      offense: 80,
      defense: 78,
      shooting: 80,
      rebounding: 75,
      playmaking: 76,
      stamina: 80,
    },
    rotationOrder: 1,
    targetMinutes: 30,
    injuredDays: 0,
    isFreeAgent: false,
    salary: 10_000_000,
    yearsRemaining: 2,
    ...partial,
  };
}

describe("evaluateTrade", () => {
  it("accepts upgrades for contenders", () => {
    const decision = evaluateTrade({
      direction: "contend",
      proposal: {
        leagueId: "l",
        fromTeamId: "a",
        toTeamId: "b",
        fromAssets: [{ playerId: "star" }],
        toAssets: [{ playerId: "role" }],
      },
      ourPlayers: [p({ id: "role", name: "Role", ratings: { overall: 72, offense: 72, defense: 70, shooting: 72, rebounding: 70, playmaking: 70, stamina: 72 } })],
      theirPlayers: [p({ id: "star", name: "Star", ratings: { overall: 88, offense: 88, defense: 85, shooting: 88, rebounding: 80, playmaking: 84, stamina: 86 } })],
    });
    expect(decision.accepted).toBe(true);
    expect(decision.reason.toLowerCase()).toContain("accepted");
  });

  it("values expiring money over equivalent long-term bad salary", () => {
    const decision = evaluateTrade({
      direction: "cheap",
      proposal: {
        leagueId: "l",
        fromTeamId: "a",
        toTeamId: "b",
        fromAssets: [{ playerId: "expiring" }],
        toAssets: [{ playerId: "long-term" }],
      },
      ourPlayers: [
        p({
          id: "long-term",
          name: "Long Term",
          salary: 30_000_000,
          yearsRemaining: 4,
          potential: 72,
          ratings: { overall: 72, offense: 72, defense: 72, shooting: 72, rebounding: 72, playmaking: 72, stamina: 72 },
        }),
      ],
      theirPlayers: [
        p({
          id: "expiring",
          name: "Expiring",
          salary: 30_000_000,
          yearsRemaining: 1,
          potential: 72,
          ratings: { overall: 72, offense: 72, defense: 72, shooting: 72, rebounding: 72, playmaking: 72, stamina: 72 },
        }),
      ],
    });

    expect(decision.accepted).toBe(true);
    expect(decision.reason).toContain("expiring money");
  });

  it("rejects taking on long-term bad salary for equivalent expiring money", () => {
    const decision = evaluateTrade({
      direction: "rebuild",
      proposal: {
        leagueId: "l",
        fromTeamId: "a",
        toTeamId: "b",
        fromAssets: [{ playerId: "long-term" }],
        toAssets: [{ playerId: "expiring" }],
      },
      ourPlayers: [
        p({
          id: "expiring",
          name: "Expiring",
          salary: 30_000_000,
          yearsRemaining: 1,
          potential: 72,
          ratings: { overall: 72, offense: 72, defense: 72, shooting: 72, rebounding: 72, playmaking: 72, stamina: 72 },
        }),
      ],
      theirPlayers: [
        p({
          id: "long-term",
          name: "Long Term",
          salary: 30_000_000,
          yearsRemaining: 4,
          potential: 72,
          ratings: { overall: 72, offense: 72, defense: 72, shooting: 72, rebounding: 72, playmaking: 72, stamina: 72 },
        }),
      ],
    });

    expect(decision.accepted).toBe(false);
    expect(decision.reason).toContain("long-term bad salary");
  });
});
