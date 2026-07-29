import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIN_AVAILABLE_PLAYERS } from "@basketball-sim/sim";
import { advanceLeague } from "./advance.js";
import { prisma } from "./prisma.js";

describe("day advance short-handed slate", () => {
  const ownerIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ownerIds } } });
    await prisma.$disconnect();
  });

  async function createRosterPlayer(teamId: string, name: string, rotationOrder: number) {
    return prisma.player.create({
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
        rotationOrder,
        targetMinutes: rotationOrder < 5 ? 30 : 12,
      },
    });
  }

  async function createHealthyRoster(teamId: string, prefix: string, count = 8) {
    return Promise.all(
      Array.from({ length: count }, (_, index) =>
        createRosterPlayer(teamId, `${prefix} ${index + 1}`, index),
      ),
    );
  }

  it("leaves a short-handed game scheduled, posts injury news, and finishes sibling games", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const seasonYear = 2098;
    const owner = await prisma.user.create({
      data: {
        email: `advance-short-${suffix}@example.com`,
        displayName: "Advance Short Owner",
        passwordHash: "unused",
      },
    });
    ownerIds.push(owner.id);

    const league = await prisma.league.create({
      data: {
        name: "Advance Short League",
        seasonYear,
        ownerUserId: owner.id,
        phase: "regular",
        day: 4,
      },
    });

    const [userTeam, shortTeam, healthyAway, siblingHome, siblingAway] = await Promise.all([
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "User Franchise",
          abbreviation: "USR",
          conference: "East",
          division: "Test",
        },
      }),
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Harbor Hawks",
          abbreviation: "HAR",
          conference: "East",
          division: "Test",
        },
      }),
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Metro Foxes",
          abbreviation: "MET",
          conference: "West",
          division: "Test",
        },
      }),
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "River Kings",
          abbreviation: "RIV",
          conference: "East",
          division: "Test",
        },
      }),
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Canyon Cats",
          abbreviation: "CAN",
          conference: "West",
          division: "Test",
        },
      }),
    ]);

    await prisma.league.update({
      where: { id: league.id },
      data: { userTeamId: userTeam.id },
    });

    const shortPlayers = await createHealthyRoster(shortTeam.id, "Harbor");
    await createHealthyRoster(healthyAway.id, "Metro");
    await createHealthyRoster(siblingHome.id, "River");
    await createHealthyRoster(siblingAway.id, "Canyon");
    await createHealthyRoster(userTeam.id, "User");

    // First slate game is short-handed (4 healthy); sibling should still finish.
    await prisma.player.updateMany({
      where: { id: { in: shortPlayers.slice(4).map((player) => player.id) } },
      data: { injuredDays: 3 },
    });

    const shortHandedGame = await prisma.scheduledGame.create({
      data: {
        leagueId: league.id,
        seasonYear,
        day: 4,
        homeTeamId: shortTeam.id,
        awayTeamId: healthyAway.id,
        status: "scheduled",
      },
    });
    const siblingGame = await prisma.scheduledGame.create({
      data: {
        leagueId: league.id,
        seasonYear,
        day: 4,
        homeTeamId: siblingHome.id,
        awayTeamId: siblingAway.id,
        status: "scheduled",
      },
    });
    // Future day keeps the season from ending after this advance.
    await prisma.scheduledGame.create({
      data: {
        leagueId: league.id,
        seasonYear,
        day: 5,
        homeTeamId: userTeam.id,
        awayTeamId: healthyAway.id,
        status: "scheduled",
      },
    });

    const result = await advanceLeague(owner.id, {
      leagueId: league.id,
      mode: "next",
      autoSimUserGames: true,
    });

    expect(result.gamesPlayed).toHaveLength(1);
    expect(result.gamesPlayed[0]!.scheduledGameId).toBe(siblingGame.id);
    expect(result.league.day).toBe(5);

    const shortAfter = await prisma.scheduledGame.findUniqueOrThrow({
      where: { id: shortHandedGame.id },
    });
    expect(shortAfter.status).toBe("scheduled");
    expect(shortAfter.gameResultId).toBeNull();
    expect(shortAfter.homeScore).toBeNull();
    expect(shortAfter.awayScore).toBeNull();

    const siblingAfter = await prisma.scheduledGame.findUniqueOrThrow({
      where: { id: siblingGame.id },
    });
    expect(siblingAfter.status).toBe("final");
    expect(siblingAfter.gameResultId).not.toBeNull();

    expect(
      await prisma.game.count({
        where: { leagueId: league.id, scheduledGameId: shortHandedGame.id },
      }),
    ).toBe(0);
    expect(
      await prisma.newsItem.count({
        where: { leagueId: league.id, kind: "game" },
      }),
    ).toBe(1);

    const postponeNews = await prisma.newsItem.findMany({
      where: { leagueId: league.id, kind: "injury", day: 4 },
    });
    expect(postponeNews).toHaveLength(1);
    expect(postponeNews[0]!.headline).toContain("Harbor Hawks");
    expect(postponeNews[0]!.headline).toMatch(/short-handed/i);
    expect(postponeNews[0]!.body).toContain(
      `home team Harbor Hawks has 4 healthy players (need at least ${MIN_AVAILABLE_PLAYERS})`,
    );
  });
});
