import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma.js";
import { proposeTrade, tradeFinder } from "./transactions.js";

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

  it("persists protected terms while the original team retains the pick", async () => {
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

    expect(decision.accepted).toBe(true);
    await expect(
      prisma.draftPick.findUniqueOrThrow({ where: { id: protectedPick.id } }),
    ).resolves.toMatchObject({
      ownerTeamId: userTeamId,
      originalTeamId: userTeamId,
      protectedThrough: 5,
      conveyanceTeamId: targetTeamId,
    });

    const secondDecision = await proposeTrade(userId, {
      leagueId,
      fromTeamId: userTeamId,
      toTeamId: thirdTeamId,
      fromAssets: [{ draftPickId: protectedPick.id }],
      toAssets: [],
    });
    expect(secondDecision).toMatchObject({
      accepted: false,
      reason: "Draft pick details or protection terms are invalid.",
    });
    await expect(
      prisma.draftPick.findUniqueOrThrow({ where: { id: protectedPick.id } }),
    ).resolves.toMatchObject({
      ownerTeamId: userTeamId,
      protectedThrough: 5,
      conveyanceTeamId: targetTeamId,
    });
  });

  it("rejects a missing player before any pick transfer can land", async () => {
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

    const decision = await proposeTrade(userId, {
      leagueId,
      fromTeamId: userTeamId,
      toTeamId: targetTeamId,
      fromAssets: [
        { draftPickId: atomicPick.id },
        { playerId: "missing-player" },
      ],
      toAssets: [],
    });

    expect(decision).toMatchObject({
      accepted: false,
      reason: "Player asset does not belong to the declaring team.",
    });
    await expect(
      prisma.draftPick.findUniqueOrThrow({ where: { id: atomicPick.id } }),
    ).resolves.toMatchObject({ ownerTeamId: userTeamId });
  });
});

describe("player ownership guards in persisted trades", () => {
  let userId: string;
  let leagueId: string;
  let userTeamId: string;
  let targetTeamId: string;
  let thirdTeamId: string;
  let userPlayerId: string;
  let targetPlayerId: string;
  let foreignPlayerId: string;
  let foreignContractId: string;
  let userPickId: string;
  let targetPickId: string;

  async function createRosterPlayer(
    teamId: string,
    name: string,
    salary = 5_000_000,
  ) {
    const player = await prisma.player.create({
      data: {
        teamId,
        name,
        position: "G",
        age: 26,
        potential: 72,
        overall: 78,
        offense: 78,
        defense: 74,
        shooting: 76,
        rebounding: 60,
        playmaking: 70,
        stamina: 80,
      },
    });
    const contract = await prisma.contract.create({
      data: {
        playerId: player.id,
        teamId,
        salary,
        yearsRemaining: 2,
      },
    });
    return { player, contract };
  }

  beforeAll(async () => {
    await prisma.$connect();

    const suffix = `${Date.now()}-${Math.random()}`;
    const owner = await prisma.user.create({
      data: {
        email: `player-ownership-${suffix}@example.com`,
        displayName: "Player Ownership Owner",
        passwordHash: "unused",
      },
    });
    userId = owner.id;

    const league = await prisma.league.create({
      data: {
        name: "Player Ownership League",
        seasonYear: 2098,
        ownerUserId: owner.id,
      },
    });
    leagueId = league.id;

    const [userTeam, targetTeam, thirdTeam] = await Promise.all([
      prisma.team.create({
        data: {
          leagueId,
          name: "User Ownership",
          abbreviation: "UOW",
          conference: "East",
          division: "Test",
        },
      }),
      prisma.team.create({
        data: {
          leagueId,
          name: "Target Ownership",
          abbreviation: "TOW",
          conference: "West",
          division: "Test",
          gmDirection: "window",
        },
      }),
      prisma.team.create({
        data: {
          leagueId,
          name: "Third Ownership",
          abbreviation: "THO",
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

    const [userRoster, targetRoster, foreignRoster] = await Promise.all([
      createRosterPlayer(userTeamId, "User Guard"),
      createRosterPlayer(targetTeamId, "Target Guard"),
      createRosterPlayer(thirdTeamId, "Foreign Star", 12_000_000),
    ]);
    userPlayerId = userRoster.player.id;
    targetPlayerId = targetRoster.player.id;
    foreignPlayerId = foreignRoster.player.id;
    foreignContractId = foreignRoster.contract.id;

    const [userPick, targetPick] = await Promise.all([
      prisma.draftPick.create({
        data: {
          leagueId,
          seasonYear: 2099,
          round: 1,
          pick: 8,
          originalTeamId: userTeamId,
          ownerTeamId: userTeamId,
        },
      }),
      prisma.draftPick.create({
        data: {
          leagueId,
          seasonYear: 2099,
          round: 2,
          pick: 38,
          originalTeamId: targetTeamId,
          ownerTeamId: targetTeamId,
        },
      }),
    ]);
    userPickId = userPick.id;
    targetPickId = targetPick.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it("rejects a foreign-player injection and leaves every mixed-trade asset unchanged", async () => {
    const decision = await proposeTrade(userId, {
      leagueId,
      fromTeamId: userTeamId,
      toTeamId: targetTeamId,
      fromAssets: [
        { playerId: userPlayerId },
        { playerId: foreignPlayerId },
        {
          draftPickId: userPickId,
          draftPickProtection: { kind: "unprotected" },
        },
      ],
      toAssets: [
        { playerId: targetPlayerId },
        {
          draftPickId: targetPickId,
          draftPickProtection: { kind: "unprotected" },
        },
      ],
    });

    expect(decision).toMatchObject({
      accepted: false,
      reason: "Player asset does not belong to the declaring team.",
    });

    const [userPlayer, targetPlayer, foreignPlayer, foreignContract, userPick, targetPick] =
      await Promise.all([
        prisma.player.findUniqueOrThrow({ where: { id: userPlayerId } }),
        prisma.player.findUniqueOrThrow({ where: { id: targetPlayerId } }),
        prisma.player.findUniqueOrThrow({ where: { id: foreignPlayerId } }),
        prisma.contract.findUniqueOrThrow({ where: { id: foreignContractId } }),
        prisma.draftPick.findUniqueOrThrow({ where: { id: userPickId } }),
        prisma.draftPick.findUniqueOrThrow({ where: { id: targetPickId } }),
      ]);

    expect(userPlayer.teamId).toBe(userTeamId);
    expect(targetPlayer.teamId).toBe(targetTeamId);
    expect(foreignPlayer.teamId).toBe(thirdTeamId);
    expect(foreignContract.teamId).toBe(thirdTeamId);
    expect(userPick.ownerTeamId).toBe(userTeamId);
    expect(targetPick.ownerTeamId).toBe(targetTeamId);
  });

  it("rejects a foreign player declared on the counterparty side", async () => {
    const decision = await proposeTrade(userId, {
      leagueId,
      fromTeamId: userTeamId,
      toTeamId: targetTeamId,
      fromAssets: [{ playerId: userPlayerId }],
      toAssets: [{ playerId: foreignPlayerId }],
    });

    expect(decision).toMatchObject({
      accepted: false,
      reason: "Player asset does not belong to the declaring team.",
    });
    await expect(
      prisma.player.findUniqueOrThrow({ where: { id: foreignPlayerId } }),
    ).resolves.toMatchObject({ teamId: thirdTeamId });
    await expect(
      prisma.contract.findUniqueOrThrow({ where: { id: foreignContractId } }),
    ).resolves.toMatchObject({ teamId: thirdTeamId });
  });

  it("atomically moves owned players and contracts when both sides are valid", async () => {
    const decision = await proposeTrade(userId, {
      leagueId,
      fromTeamId: userTeamId,
      toTeamId: targetTeamId,
      fromAssets: [
        { playerId: userPlayerId },
        {
          draftPickId: userPickId,
          draftPickProtection: { kind: "unprotected" },
        },
      ],
      toAssets: [
        { playerId: targetPlayerId },
        {
          draftPickId: targetPickId,
          draftPickProtection: { kind: "unprotected" },
        },
      ],
    });

    expect(decision.accepted).toBe(true);

    const [userPlayer, targetPlayer, userContract, targetContract, userPick, targetPick] =
      await Promise.all([
        prisma.player.findUniqueOrThrow({ where: { id: userPlayerId } }),
        prisma.player.findUniqueOrThrow({ where: { id: targetPlayerId } }),
        prisma.contract.findFirstOrThrow({ where: { playerId: userPlayerId } }),
        prisma.contract.findFirstOrThrow({ where: { playerId: targetPlayerId } }),
        prisma.draftPick.findUniqueOrThrow({ where: { id: userPickId } }),
        prisma.draftPick.findUniqueOrThrow({ where: { id: targetPickId } }),
      ]);

    expect(userPlayer.teamId).toBe(targetTeamId);
    expect(targetPlayer.teamId).toBe(userTeamId);
    expect(userContract.teamId).toBe(targetTeamId);
    expect(targetContract.teamId).toBe(userTeamId);
    expect(userPick.ownerTeamId).toBe(targetTeamId);
    expect(targetPick.ownerTeamId).toBe(userTeamId);
  });
});

describe("prior trade margins for AI counterparties", () => {
  let userId: string;
  let leagueId: string;
  let userTeamId: string;
  let rivalTeamId: string;
  let otherTeamId: string;
  let userBaselineId: string;
  let userUpgradeId: string;
  let rivalBaselineId: string;
  let rivalUpgradeId: string;
  let otherPlayerId: string;

  async function createRatedPlayer(
    teamId: string,
    name: string,
    overall: number,
  ) {
    const player = await prisma.player.create({
      data: {
        teamId,
        name,
        position: "G",
        age: 27,
        potential: overall,
        overall,
        offense: overall,
        defense: overall - 2,
        shooting: overall,
        rebounding: overall - 5,
        playmaking: overall - 4,
        stamina: overall,
      },
    });
    await prisma.contract.create({
      data: {
        playerId: player.id,
        teamId,
        salary: 8_000_000,
        yearsRemaining: 2,
      },
    });
    return player.id;
  }

  beforeAll(async () => {
    await prisma.$connect();

    const suffix = `${Date.now()}-${Math.random()}`;
    const owner = await prisma.user.create({
      data: {
        email: `trade-grudge-${suffix}@example.com`,
        displayName: "Trade Grudge Owner",
        passwordHash: "unused",
      },
    });
    userId = owner.id;

    const league = await prisma.league.create({
      data: {
        name: "Trade Grudge League",
        seasonYear: 2097,
        day: 40,
        ownerUserId: owner.id,
      },
    });
    leagueId = league.id;

    const [userTeam, rivalTeam, otherTeam] = await Promise.all([
      prisma.team.create({
        data: {
          leagueId,
          name: "User Contenders",
          abbreviation: "USR",
          conference: "East",
          division: "Test",
          gmDirection: "contend",
        },
      }),
      prisma.team.create({
        data: {
          leagueId,
          name: "Rival Contenders",
          abbreviation: "RVL",
          conference: "West",
          division: "Test",
          gmDirection: "contend",
        },
      }),
      prisma.team.create({
        data: {
          leagueId,
          name: "Other Contenders",
          abbreviation: "OTH",
          conference: "West",
          division: "Test",
          gmDirection: "contend",
        },
      }),
    ]);
    userTeamId = userTeam.id;
    rivalTeamId = rivalTeam.id;
    otherTeamId = otherTeam.id;

    await prisma.league.update({
      where: { id: leagueId },
      data: { userTeamId },
    });

    [
      userBaselineId,
      userUpgradeId,
      rivalBaselineId,
      rivalUpgradeId,
      otherPlayerId,
    ] = await Promise.all([
      createRatedPlayer(userTeamId, "User Baseline", 80),
      createRatedPlayer(userTeamId, "User Slight Upgrade", 81),
      createRatedPlayer(rivalTeamId, "Rival Baseline", 80),
      createRatedPlayer(rivalTeamId, "Rival Slight Upgrade", 81),
      createRatedPlayer(otherTeamId, "Other Wing", 80),
    ]);

    await prisma.tradeOutcome.create({
      data: {
        leagueId,
        teamId: rivalTeamId,
        partnerTeamId: userTeamId,
        ourMargin: -20,
        seasonYear: league.seasonYear,
        day: 10,
      },
    });
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it("rejects a near-even rematch after a seeded lopsided loss to the user", async () => {
    const withoutGrudge = await proposeTrade(userId, {
      leagueId,
      fromTeamId: userTeamId,
      toTeamId: otherTeamId,
      fromAssets: [{ playerId: userUpgradeId }],
      toAssets: [{ playerId: otherPlayerId }],
    });
    expect(withoutGrudge.accepted).toBe(true);
    expect(withoutGrudge.reason).not.toContain("lopsided");

    // Undo the no-grudge swap so rosters stay usable for the rematch case.
    await prisma.$transaction([
      prisma.player.update({
        where: { id: userUpgradeId },
        data: { teamId: userTeamId },
      }),
      prisma.player.update({
        where: { id: otherPlayerId },
        data: { teamId: otherTeamId },
      }),
      prisma.contract.updateMany({
        where: { playerId: userUpgradeId },
        data: { teamId: userTeamId },
      }),
      prisma.contract.updateMany({
        where: { playerId: otherPlayerId },
        data: { teamId: otherTeamId },
      }),
      prisma.tradeOutcome.deleteMany({
        where: { leagueId, teamId: otherTeamId, partnerTeamId: userTeamId },
      }),
      prisma.newsItem.deleteMany({
        where: { leagueId, kind: "trade", headline: { contains: "Other Contenders" } },
      }),
    ]);

    const rematch = await proposeTrade(userId, {
      leagueId,
      fromTeamId: userTeamId,
      toTeamId: rivalTeamId,
      fromAssets: [{ playerId: userUpgradeId }],
      toAssets: [{ playerId: rivalBaselineId }],
    });

    expect(rematch.accepted).toBe(false);
    expect(rematch.reason).toContain("lopsided trade with this partner");
    await expect(
      prisma.player.findUniqueOrThrow({ where: { id: userUpgradeId } }),
    ).resolves.toMatchObject({ teamId: userTeamId });
    await expect(
      prisma.player.findUniqueOrThrow({ where: { id: rivalBaselineId } }),
    ).resolves.toMatchObject({ teamId: rivalTeamId });
  });

  it("omits grudge-blocked packages from tradeFinder results", async () => {
    const packages = await tradeFinder(userId, leagueId, userBaselineId);
    expect(packages.every((pkg) => pkg.teamId !== rivalTeamId)).toBe(true);
  });

  it("persists the evaluating team's margin when a trade is accepted", async () => {
    const decision = await proposeTrade(userId, {
      leagueId,
      fromTeamId: userTeamId,
      toTeamId: otherTeamId,
      fromAssets: [{ playerId: userBaselineId }],
      toAssets: [{ playerId: otherPlayerId }],
    });

    expect(decision.accepted).toBe(true);
    expect(typeof decision.margin).toBe("number");

    const stored = await prisma.tradeOutcome.findFirst({
      where: {
        leagueId,
        teamId: otherTeamId,
        partnerTeamId: userTeamId,
      },
    });
    expect(stored).toMatchObject({
      ourMargin: decision.margin,
      seasonYear: 2097,
      day: 40,
    });
  });
});
