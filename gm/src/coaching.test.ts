import type { Coach, PlayerRatings } from "@basketball-sim/shared";
import { describe, expect, it } from "vitest";
import { evaluateCoachStaffing } from "./coaching.js";

function ratings(overall: number): PlayerRatings {
  return {
    overall,
    offense: overall,
    defense: overall,
    shooting: overall,
    rebounding: overall,
    playmaking: overall,
    stamina: overall,
  };
}

function roster(overall: number) {
  return Array.from({ length: 8 }, () => ({ ratings: ratings(overall) }));
}

function coach(partial: Partial<Coach> & { id: string; name: string }): Coach {
  return {
    teamId: null,
    style: "balanced",
    rating: 68,
    development: 65,
    seasonsWithTeam: 3,
    ...partial,
  };
}

const currentCoach = coach({
  id: "current",
  name: "Pat Current",
  teamId: "team",
});
const candidates = [
  coach({
    id: "veteran",
    name: "Alex Veteran",
    style: "offense",
    rating: 78,
    development: 65,
  }),
  coach({
    id: "developer",
    name: "Dev Prospect",
    style: "development",
    rating: 74,
    development: 90,
  }),
];

describe("evaluateCoachStaffing", () => {
  it("retains a coach before there is a meaningful record sample", () => {
    const decision = evaluateCoachStaffing({
      teamId: "team",
      wins: 2,
      losses: 8,
      direction: "contend",
      roster: roster(84),
      currentCoach,
      candidates,
    });

    expect(decision.action).toBe("retain");
    expect(decision.reason).toContain("too early");
  });

  it("fires an underperforming contender coach and hires the best win-now fit", () => {
    const decision = evaluateCoachStaffing({
      teamId: "team",
      wins: 12,
      losses: 28,
      direction: "contend",
      roster: roster(84),
      currentCoach,
      candidates,
    });

    expect(decision.action).toBe("fire-and-hire");
    if (decision.action === "fire-and-hire") {
      expect(decision.firedCoachId).toBe("current");
      expect(decision.hiredCoachId).toBe("veteran");
      expect(decision.expectedWinPct).toBeGreaterThan(
        decision.actualWinPct,
      );
    }
    expect(decision.reason).toContain("84.0-rated roster");
    expect(decision.reason).toContain("offense approach");
  });

  it("prefers a development coach for an underperforming rebuild", () => {
    const decision = evaluateCoachStaffing({
      teamId: "team",
      wins: 10,
      losses: 30,
      direction: "rebuild",
      roster: roster(84),
      currentCoach,
      candidates,
      owner: { aggression: 1, loyalty: 0 },
    });

    expect(decision.action).toBe("fire-and-hire");
    if (decision.action === "fire-and-hire") {
      expect(decision.hiredCoachId).toBe("developer");
    }
  });

  it("keeps a rebuilding coach when a weak roster meets expectations", () => {
    const decision = evaluateCoachStaffing({
      teamId: "team",
      wins: 9,
      losses: 31,
      direction: "rebuild",
      roster: roster(68),
      currentCoach,
      candidates,
    });

    expect(decision.action).toBe("retain");
    expect(decision.reason).toContain("within");
  });

  it("uses owner patience when a record is moderately below expectations", () => {
    const base = {
      teamId: "team",
      wins: 22,
      losses: 18,
      direction: "contend" as const,
      roster: roster(80),
      currentCoach,
      candidates,
    };

    const patientDecision = evaluateCoachStaffing({
      ...base,
      owner: { aggression: 0, loyalty: 1 },
    });
    const impatientDecision = evaluateCoachStaffing({
      ...base,
      owner: { aggression: 1, loyalty: 0 },
    });

    expect(patientDecision.action).toBe("retain");
    expect(impatientDecision.action).toBe("fire-and-hire");
  });

  it("does not fire a coach without a qualified available replacement", () => {
    const decision = evaluateCoachStaffing({
      teamId: "team",
      wins: 12,
      losses: 28,
      direction: "contend",
      roster: roster(84),
      currentCoach,
      candidates: [
        coach({
          id: "employed",
          name: "Employed Coach",
          teamId: "other-team",
          rating: 95,
        }),
        coach({
          id: "unqualified",
          name: "Unqualified Coach",
          rating: 50,
          development: 50,
        }),
      ],
    });

    expect(decision.action).toBe("retain");
    expect(decision.reason).toContain("no qualified replacement");
  });
});
