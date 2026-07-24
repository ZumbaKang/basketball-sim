import { describe, expect, it } from "vitest";
import { draftPickValue, evaluateTrade } from "./logic.js";
import type { EvaluableDraftPick, EvaluablePlayer } from "./logic.js";

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

function pick(
  partial: Partial<EvaluableDraftPick> & { id: string },
): EvaluableDraftPick {
  return {
    seasonYear: 2026,
    round: 1,
    pick: 10,
    ...partial,
  };
}

describe("draftPickValue", () => {
  it("values an unprotected pick above the same top-10 protected pick", () => {
    const first = pick({ id: "first" });

    const unprotected = draftPickValue(
      first,
      { kind: "unprotected" },
      "rebuild",
      2025,
    );
    const protectedValue = draftPickValue(
      first,
      { kind: "top", protectedThrough: 10 },
      "rebuild",
      2025,
    );

    expect(unprotected).toBeGreaterThan(protectedValue);
  });

  it("discounts a distant future pick against the same nearer pick", () => {
    const nearer = pick({ id: "near", seasonYear: 2026 });
    const distant = pick({ id: "far", seasonYear: 2028 });

    expect(
      draftPickValue(
        nearer,
        { kind: "unprotected" },
        "rebuild",
        2025,
      ),
    ).toBeGreaterThan(
      draftPickValue(
        distant,
        { kind: "unprotected" },
        "rebuild",
        2025,
      ),
    );
  });
});

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

  it("accepts a present-talent downgrade when a rebuild gets an unprotected first", () => {
    const decision = evaluateTrade({
      direction: "rebuild",
      currentSeasonYear: 2025,
      proposal: {
        leagueId: "l",
        fromTeamId: "a",
        toTeamId: "b",
        fromAssets: [
          { playerId: "role" },
          {
            draftPickId: "first",
            draftPickProtection: { kind: "unprotected" },
          },
        ],
        toAssets: [{ playerId: "star" }],
      },
      ourPlayers: [
        p({
          id: "star",
          name: "Star",
          potential: 88,
          ratings: {
            overall: 88,
            offense: 88,
            defense: 85,
            shooting: 88,
            rebounding: 80,
            playmaking: 84,
            stamina: 86,
          },
        }),
      ],
      theirPlayers: [
        p({
          id: "role",
          name: "Role",
          potential: 72,
          ratings: {
            overall: 72,
            offense: 72,
            defense: 70,
            shooting: 72,
            rebounding: 70,
            playmaking: 70,
            stamina: 72,
          },
        }),
      ],
      theirDraftPicks: [pick({ id: "first", pick: 6 })],
    });

    expect(decision.accepted).toBe(true);
    expect(decision.reason).toContain("unprotected first-round pick");
  });

  it("rejects a star return built around a distant second for a contender", () => {
    const decision = evaluateTrade({
      direction: "contend",
      currentSeasonYear: 2025,
      proposal: {
        leagueId: "l",
        fromTeamId: "a",
        toTeamId: "b",
        fromAssets: [
          { playerId: "role" },
          {
            draftPickId: "second",
            draftPickProtection: { kind: "unprotected" },
          },
        ],
        toAssets: [{ playerId: "star" }],
      },
      ourPlayers: [
        p({
          id: "star",
          name: "Star",
          potential: 88,
          ratings: {
            overall: 88,
            offense: 88,
            defense: 85,
            shooting: 88,
            rebounding: 80,
            playmaking: 84,
            stamina: 86,
          },
        }),
      ],
      theirPlayers: [
        p({
          id: "role",
          name: "Role",
          potential: 74,
          ratings: {
            overall: 74,
            offense: 74,
            defense: 72,
            shooting: 74,
            rebounding: 72,
            playmaking: 72,
            stamina: 74,
          },
        }),
      ],
      theirDraftPicks: [
        pick({ id: "second", seasonYear: 2028, round: 2, pick: 35 }),
      ],
    });

    expect(decision.accepted).toBe(false);
    expect(decision.reason).toContain("second-round pick");
  });

  it("evaluates pick-only offers", () => {
    const decision = evaluateTrade({
      direction: "tank",
      currentSeasonYear: 2025,
      proposal: {
        leagueId: "l",
        fromTeamId: "a",
        toTeamId: "b",
        fromAssets: [{ draftPickId: "first" }],
        toAssets: [{ draftPickId: "second" }],
      },
      ourPlayers: [],
      theirPlayers: [],
      ourDraftPicks: [
        pick({ id: "second", seasonYear: 2027, round: 2, pick: 35 }),
      ],
      theirDraftPicks: [pick({ id: "first", pick: 15 })],
    });

    expect(decision.accepted).toBe(true);
  });
});
