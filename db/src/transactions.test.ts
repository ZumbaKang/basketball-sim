import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma.js";
import { proposeTrade } from "./transactions.js";

describe("draft picks in persisted trades", () => {
  let userId: string;
  let leagueId: string;
  let userTeamId: string;
  let targetTeamId: string;
  let thirdTeamId: string;
  let userPickId: string;
  let targetPickId: string;
  let foreignPickId: string;
  let usedPickId: string;

  beforeAll(async () => {
    await prisma.$connect();

    const suffix = `${Date.now()}-${Math.random()}`;
    const owner = await prisma.user.create({
      data: {
        email: `draft-pick-trade-${suffix}@example.com`,
        displayName: "Draft Pick Owner",
        passwordHash: "unused",
      },
    });
    userId = owner.id;

    const league = await prisma.league.create({
      data: {
        name: "Draft Pick Trade League",
        seasonYear: 2099,
        ownerUserId: owner.id,
      },
    });
    leagueId = league.id;

    const [userTeam, targetTeam, thirdTeam] = await Promise.all([
      prisma.team.create({
        data: {
          leagueId,
          name: "User Team",
          abbreviation: "USR",
          conference: "East",
          division: "Test",
        },
      }),
      prisma.team.create({
        data: {
          leagueId,
          name: "Target Team",
          abbreviation: "TGT",
          conference: "West",
          division: "Test",
          gmDirection: "window",
        },
      }),
      prisma.team.create({
        data: {
          leagueId,
          name: "Third Team",
          abbreviation: "THD",
          conference: "West",
          division: "Test",
        },
      }),
    ]);
    userTeamId = userTeam.id;
    targetTeamId = targetTeam.id;
    thirdTeamId = thirdTeam.id;

    await prisma.league.update({
      where: { id: leagueId },
      data: { userTeamId },
    });

    const [userPick, targetPick, foreignPick, usedPick] = await Promise.all([
      prisma.draftPick.create({
        data: {
          leagueId,
          seasonYear: 2100,
          round: 1,
          pick: 1,
          originalTeamId: userTeamId,
          ownerTeamId: userTeamId,
        },
      }),
      prisma.draftPick.create({
        data: {
          leagueId,
          seasonYear: 2100,
          round: 2,
          pick: 30,
          originalTeamId: targetTeamId,
          ownerTeamId: targetTeamId,
        },
      }),
      prisma.draftPick.create({
        data: {
          leagueId,
          seasonYear: 2100,
          round: 1,
          pick: 10,
          originalTeamId: thirdTeamId,
          ownerTeamId: thirdTeamId,
        },
      }),
      prisma.draftPick.create({
        data: {
          leagueId,
          seasonYear: 2099,
          round: 1,
          pick: 20,
          originalTeamId: userTeamId,
          ownerTeamId: userTeamId,
          playerId: "already-selected-player",
        },
      }),
    ]);
    userPickId = userPick.id;
    targetPickId = targetPick.id;
    foreignPickId = foreignPick.id;
    usedPickId = usedPick.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it("atomically transfers owned, unselected picks in both directions", async () => {
    const decision = await proposeTrade(userId, {
      leagueId,
      fromTeamId: userTeamId,
      toTeamId: targetTeamId,
      fromAssets: [
        {
          draftPickId: userPickId,
          draftPickProtection: { kind: "unprotected" },
        },
      ],
      toAssets: [
        {
          draftPickId: targetPickId,
          draftPickProtection: { kind: "unprotected" },
        },
      ],
    });

    expect(decision.accepted).toBe(true);
    const [userPick, targetPick] = await Promise.all([
      prisma.draftPick.findUniqueOrThrow({ where: { id: userPickId } }),
      prisma.draftPick.findUniqueOrThrow({ where: { id: targetPickId } }),
    ]);
    expect(userPick.ownerTeamId).toBe(targetTeamId);
    expect(targetPick.ownerTeamId).toBe(userTeamId);
    expect(userPick.originalTeamId).toBe(userTeamId);
    expect(targetPick.originalTeamId).toBe(targetTeamId);
  });

  it("rejects a pick owned by a team outside the proposed side", async () => {
    const decision = await proposeTrade(userId, {
      leagueId,
      fromTeamId: userTeamId,
      toTeamId: targetTeamId,
      fromAssets: [{ draftPickId: foreignPickId }],
      toAssets: [],
    });

    expect(decision).toMatchObject({
      accepted: false,
      reason: "Draft pick details or protection terms are invalid.",
    });
    await expect(
      prisma.draftPick.findUniqueOrThrow({ where: { id: foreignPickId } }),
    ).resolves.toMatchObject({ ownerTeamId: thirdTeamId, playerId: null });
  });

  it("rejects a pick that has already been selected", async () => {
    const decision = await proposeTrade(userId, {
      leagueId,
      fromTeamId: userTeamId,
      toTeamId: targetTeamId,
      fromAssets: [{ draftPickId: usedPickId }],
      toAssets: [],
    });

    expect(decision).toMatchObject({
      accepted: false,
      reason: "Draft pick details or protection terms are invalid.",
    });
    await expect(
      prisma.draftPick.findUniqueOrThrow({ where: { id: usedPickId } }),
    ).resolves.toMatchObject({
      ownerTeamId: userTeamId,
      playerId: "already-selected-player",
    });
  });

  it("rejects protected terms until conveyance is persisted", async () => {
    const protectedPick = await prisma.draftPick.create({
      data: {
        leagueId,
        seasonYear: 2101,
        round: 1,
        pick: 5,
        originalTeamId: userTeamId,
        ownerTeamId: userTeamId,
      },
    });

    const decision = await proposeTrade(userId, {
      leagueId,
      fromTeamId: userTeamId,
      toTeamId: targetTeamId,
      fromAssets: [
        {
          draftPickId: protectedPick.id,
          draftPickProtection: { kind: "top", protectedThrough: 5 },
        },
      ],
      toAssets: [],
    });

    expect(decision).toMatchObject({
      accepted: false,
      reason: "Draft pick details or protection terms are invalid.",
    });
    await expect(
      prisma.draftPick.findUniqueOrThrow({ where: { id: protectedPick.id } }),
    ).resolves.toMatchObject({ ownerTeamId: userTeamId });
  });

  it("rolls back a pick transfer when another accepted asset cannot move", async () => {
    const atomicPick = await prisma.draftPick.create({
      data: {
        leagueId,
        seasonYear: 2101,
        round: 1,
        pick: 2,
        originalTeamId: userTeamId,
        ownerTeamId: userTeamId,
      },
    });

    await expect(
      proposeTrade(userId, {
        leagueId,
        fromTeamId: userTeamId,
        toTeamId: targetTeamId,
        fromAssets: [
          { draftPickId: atomicPick.id },
          { playerId: "missing-player" },
        ],
        toAssets: [],
      }),
    ).rejects.toThrow();

    await expect(
      prisma.draftPick.findUniqueOrThrow({ where: { id: atomicPick.id } }),
    ).resolves.toMatchObject({ ownerTeamId: userTeamId });
  });
});
