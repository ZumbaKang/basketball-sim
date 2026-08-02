import { describe, expect, it } from "vitest";
import {
  appendTradeDecisionContexts,
  draftPickValue,
  evaluateTrade,
  grudgeCautionContext,
  grudgeThresholdPenalty,
  lopsidedLossCount,
  LOPSIDED_TRADE_MARGIN,
} from "./logic.js";
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

describe("grudgeThresholdPenalty", () => {
  it("ignores empty or mild prior margins", () => {
    expect(grudgeThresholdPenalty(undefined)).toBe(0);
    expect(grudgeThresholdPenalty([])).toBe(0);
    expect(grudgeThresholdPenalty([{ ourMargin: -4 }])).toBe(0);
    expect(
      grudgeThresholdPenalty([{ ourMargin: LOPSIDED_TRADE_MARGIN + 0.1 }]),
    ).toBe(0);
  });

  it("compounds lopsided losses and caps at 8", () => {
    expect(grudgeThresholdPenalty([{ ourMargin: -8 }])).toBeCloseTo(2.8);
    expect(grudgeThresholdPenalty([{ ourMargin: -10 }])).toBeCloseTo(3.5);
    expect(
      grudgeThresholdPenalty([{ ourMargin: -10 }, { ourMargin: -10 }]),
    ).toBeCloseTo(7);
    expect(
      grudgeThresholdPenalty([{ ourMargin: -2 }, { ourMargin: -20 }]),
    ).toBeCloseTo(7);
    expect(
      grudgeThresholdPenalty([
        { ourMargin: -10 },
        { ourMargin: -10 },
        { ourMargin: -10 },
      ]),
    ).toBe(8);
    expect(grudgeThresholdPenalty([{ ourMargin: -40 }])).toBe(8);
  });
});

describe("grudgeCautionContext", () => {
  it("stays empty without a lopsided loss", () => {
    expect(grudgeCautionContext(undefined)).toBe("");
    expect(grudgeCautionContext([])).toBe("");
    expect(grudgeCautionContext([{ ourMargin: -3 }])).toBe("");
  });

  it("uses singular wording for one loss and counts two or more", () => {
    expect(lopsidedLossCount([{ ourMargin: -20 }])).toBe(1);
    expect(grudgeCautionContext([{ ourMargin: -20 }])).toBe(
      " Still cautious after a prior lopsided trade with this partner.",
    );
    expect(
      lopsidedLossCount([{ ourMargin: -10 }, { ourMargin: -10 }]),
    ).toBe(2);
    expect(
      grudgeCautionContext([{ ourMargin: -10 }, { ourMargin: -10 }]),
    ).toBe(
      " Still cautious after 2 prior lopsided trades with this partner.",
    );
    expect(
      grudgeCautionContext([
        { ourMargin: -10 },
        { ourMargin: -10 },
        { ourMargin: -12 },
      ]),
    ).toContain("after 3 prior lopsided trades");
  });
});

describe("evaluateTrade grudges", () => {
  const nearEvenProposal = {
    leagueId: "l",
    fromTeamId: "partner",
    toTeamId: "us",
    fromAssets: [{ playerId: "slight-upgrade" }],
    toAssets: [{ playerId: "baseline" }],
  };

  const nearEvenRosters = {
    ourPlayers: [
      p({
        id: "baseline",
        name: "Baseline",
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
      }),
    ],
    theirPlayers: [
      p({
        id: "slight-upgrade",
        name: "Slight Upgrade",
        potential: 81,
        ratings: {
          overall: 81,
          offense: 81,
          defense: 79,
          shooting: 81,
          rebounding: 76,
          playmaking: 77,
          stamina: 81,
        },
      }),
    ],
  };

  it("accepts a near-even contend deal with no prior history", () => {
    const decision = evaluateTrade({
      direction: "contend",
      proposal: nearEvenProposal,
      ...nearEvenRosters,
    });
    expect(decision.accepted).toBe(true);
    expect(decision.reason).not.toContain("lopsided");
  });

  it("rejects the same near-even deal after a prior lopsided loss to that partner", () => {
    const decision = evaluateTrade({
      direction: "contend",
      proposal: nearEvenProposal,
      ...nearEvenRosters,
      priorOutcomesWithPartner: [{ ourMargin: -20 }],
    });
    expect(decision.accepted).toBe(false);
    expect(decision.reason).toContain("lopsided trade with this partner");
  });

  it("demands more caution after two -10 losses than after one -10", () => {
    const singleLoss = evaluateTrade({
      direction: "contend",
      proposal: nearEvenProposal,
      ...nearEvenRosters,
      priorOutcomesWithPartner: [{ ourMargin: -10 }],
    });
    const twoLosses = evaluateTrade({
      direction: "contend",
      proposal: nearEvenProposal,
      ...nearEvenRosters,
      priorOutcomesWithPartner: [{ ourMargin: -10 }, { ourMargin: -10 }],
    });
    expect(grudgeThresholdPenalty([{ ourMargin: -10 }])).toBeLessThan(
      grudgeThresholdPenalty([{ ourMargin: -10 }, { ourMargin: -10 }]),
    );
    // One -10 (penalty 3.5) still clears the near-even contend threshold;
    // two compounded -10s (penalty 7) reject the same package.
    expect(singleLoss.accepted).toBe(true);
    expect(singleLoss.reason).toContain(
      "after a prior lopsided trade with this partner",
    );
    expect(singleLoss.reason).not.toContain("after 2 prior");
    expect(twoLosses.accepted).toBe(false);
    expect(twoLosses.reason).toContain(
      "after 2 prior lopsided trades with this partner",
    );
  });

  it("mentions the loss count in a two-loss rejection reason", () => {
    const decision = evaluateTrade({
      direction: "contend",
      proposal: nearEvenProposal,
      ...nearEvenRosters,
      priorOutcomesWithPartner: [{ ourMargin: -10 }, { ourMargin: -10 }],
    });
    expect(decision.accepted).toBe(false);
    expect(decision.reason).toContain("after 2 prior lopsided trades");
    expect(lopsidedLossCount([{ ourMargin: -10 }, { ourMargin: -10 }])).toBe(
      2,
    );
    expect(
      grudgeCautionContext([{ ourMargin: -10 }, { ourMargin: -10 }]),
    ).toContain("after 2 prior lopsided trades");
  });

  it("does not hold a grudge after fair or winning prior deals", () => {
    const decision = evaluateTrade({
      direction: "contend",
      proposal: nearEvenProposal,
      ...nearEvenRosters,
      priorOutcomesWithPartner: [{ ourMargin: -3 }, { ourMargin: 5 }],
    });
    expect(decision.accepted).toBe(true);
    expect(decision.reason).not.toContain("lopsided");
  });

  const starForRole = {
    proposal: {
      leagueId: "l",
      fromTeamId: "partner",
      toTeamId: "us",
      fromAssets: [{ playerId: "star" }],
      toAssets: [{ playerId: "role" }],
    },
    ourPlayers: [
      p({
        id: "role",
        name: "Role",
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
    theirPlayers: [
      p({
        id: "star",
        name: "Star",
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
  };

  it("still accepts a clear upgrade despite a grudge and notes the caution", () => {
    const decision = evaluateTrade({
      direction: "contend",
      ...starForRole,
      priorOutcomesWithPartner: [{ ourMargin: -16 }],
    });
    expect(decision.accepted).toBe(true);
    expect(decision.reason).toContain("lopsided trade with this partner");
  });

  it("keeps the multi-loss count in the accept reason on a clear star-for-role upgrade", () => {
    const decision = evaluateTrade({
      direction: "contend",
      ...starForRole,
      priorOutcomesWithPartner: [{ ourMargin: -10 }, { ourMargin: -10 }],
    });
    expect(decision.accepted).toBe(true);
    expect(decision.reason).toMatch(/^Accepted:/);
    expect(decision.reason).toContain("after 2 prior lopsided trades");
    expect(decision.reason).toContain("with this partner");
  });

  it("keeps the multi-loss count after a contract-context clause on accepts", () => {
    const decision = evaluateTrade({
      direction: "contend",
      proposal: starForRole.proposal,
      ourPlayers: starForRole.ourPlayers,
      theirPlayers: [
        p({
          id: "star",
          name: "Star",
          // Market for OVR 88 is ~$35M; $45M / 3 years is a long-term overpay.
          salary: 45_000_000,
          yearsRemaining: 3,
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
      priorOutcomesWithPartner: [{ ourMargin: -10 }, { ourMargin: -10 }],
    });
    expect(decision.accepted).toBe(true);
    expect(decision.reason).toMatch(/^Accepted:/);
    expect(decision.reason).toContain("The return adds long-term bad salary.");
    const contractIdx = decision.reason.indexOf(
      "The return adds long-term bad salary.",
    );
    const grudgeIdx = decision.reason.indexOf("after 2 prior lopsided trades");
    expect(grudgeIdx).toBeGreaterThan(contractIdx);
    expect(decision.reason.slice(grudgeIdx)).toContain(
      "after 2 prior lopsided trades with this partner",
    );
    expect(
      appendTradeDecisionContexts(
        "Accepted: base.",
        " The return adds long-term bad salary.",
        " Still cautious after 2 prior lopsided trades with this partner.",
      ),
    ).toBe(
      "Accepted: base. The return adds long-term bad salary. Still cautious after 2 prior lopsided trades with this partner.",
    );
  });

  it("keeps the multi-loss count after a contract-context clause on rejects", () => {
    const decision = evaluateTrade({
      direction: "contend",
      proposal: nearEvenProposal,
      ourPlayers: nearEvenRosters.ourPlayers,
      theirPlayers: [
        p({
          id: "slight-upgrade",
          name: "Slight Upgrade",
          potential: 81,
          // Market for OVR 81 is ~$26M; $35M / 3 years is a long-term overpay.
          salary: 35_000_000,
          yearsRemaining: 3,
          ratings: {
            overall: 81,
            offense: 81,
            defense: 79,
            shooting: 81,
            rebounding: 76,
            playmaking: 77,
            stamina: 81,
          },
        }),
      ],
      priorOutcomesWithPartner: [{ ourMargin: -10 }, { ourMargin: -10 }],
    });
    expect(decision.accepted).toBe(false);
    expect(decision.reason).toMatch(/^Rejected:/);
    expect(decision.reason).toContain("The return adds long-term bad salary.");
    const contractIdx = decision.reason.indexOf(
      "The return adds long-term bad salary.",
    );
    const grudgeIdx = decision.reason.indexOf("after 2 prior lopsided trades");
    expect(grudgeIdx).toBeGreaterThan(contractIdx);
    expect(decision.reason.slice(grudgeIdx)).toContain(
      "after 2 prior lopsided trades with this partner",
    );
    expect(
      appendTradeDecisionContexts(
        "Rejected: base.",
        " The return adds long-term bad salary.",
        " Still cautious after 2 prior lopsided trades with this partner.",
      ),
    ).toBe(
      "Rejected: base. The return adds long-term bad salary. Still cautious after 2 prior lopsided trades with this partner.",
    );
  });
});