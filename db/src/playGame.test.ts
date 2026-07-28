import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIN_AVAILABLE_PLAYERS } from "@basketball-sim/sim";
import { prisma } from "./prisma.js";
import { simulateScheduledGame } from "./playGame.js";

describe("short-handed scheduled game preflight", () => {
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

  it("fails before persist when a team has fewer than five healthy players", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const seasonYear = 2097;
    const owner = await prisma.user.create({
      data: {
        email: `short-roster-${suffix}@example.com`,
        displayName: "Short Roster Owner",
        passwordHash: "unused",
      },
    });
    ownerIds.push(owner.id);

    const league = await prisma.league.create({
      data: {
        name: "Short Roster League",
        seasonYear,
        ownerUserId: owner.id,
        day: 1,
      },
    });
    const [homeTeam, awayTeam] = await Promise.all([
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
    ]);

    const homePlayers = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        createRosterPlayer(homeTeam.id, `Harbor ${index + 1}`, index),
      ),
    );
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        createRosterPlayer(awayTeam.id, `Metro ${index + 1}`, index),
      ),
    );

    // Leave only four healthy home players — below the sim floor.
    const injuredHomeIds = homePlayers.slice(4).map((player) => player.id);
    await prisma.player.updateMany({
      where: { id: { in: injuredHomeIds } },
      data: { injuredDays: 3 },
    });

    const scheduled = await prisma.scheduledGame.create({
      data: {
        leagueId: league.id,
        seasonYear,
        day: 1,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        status: "scheduled",
      },
    });

    await expect(simulateScheduledGame(scheduled.id)).rejects.toThrow(
      `Cannot simulate scheduled game: home team Harbor Hawks has 4 healthy players (need at least ${MIN_AVAILABLE_PLAYERS}).`,
    );

    const after = await prisma.scheduledGame.findUniqueOrThrow({
      where: { id: scheduled.id },
    });
    expect(after.status).toBe("scheduled");
    expect(after.gameResultId).toBeNull();
    expect(after.homeScore).toBeNull();
    expect(after.awayScore).toBeNull();

    expect(
      await prisma.game.count({
        where: { leagueId: league.id, scheduledGameId: scheduled.id },
      }),
    ).toBe(0);
    expect(
      await prisma.newsItem.count({
        where: { leagueId: league.id, kind: "game" },
      }),
    ).toBe(0);
  });

  it("fails before persist when a side has zero healthy players and does not substitute injured", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const seasonYear = 2096;
    const owner = await prisma.user.create({
      data: {
        email: `all-injured-${suffix}@example.com`,
        displayName: "All Injured Owner",
        passwordHash: "unused",
      },
    });
    ownerIds.push(owner.id);

    const league = await prisma.league.create({
      data: {
        name: "All Injured League",
        seasonYear,
        ownerUserId: owner.id,
        day: 2,
      },
    });
    const [homeTeam, awayTeam] = await Promise.all([
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Cinder Squad",
          abbreviation: "CIN",
          conference: "East",
          division: "Test",
        },
      }),
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Healthy Visitors",
          abbreviation: "HLT",
          conference: "West",
          division: "Test",
        },
      }),
    ]);

    const homePlayers = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        createRosterPlayer(homeTeam.id, `Cinder ${index + 1}`, index),
      ),
    );
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        createRosterPlayer(awayTeam.id, `Visitor ${index + 1}`, index),
      ),
    );
    await prisma.player.updateMany({
      where: { id: { in: homePlayers.map((player) => player.id) } },
      data: { injuredDays: 5 },
    });

    const scheduled = await prisma.scheduledGame.create({
      data: {
        leagueId: league.id,
        seasonYear,
        day: 2,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        status: "scheduled",
      },
    });

    await expect(simulateScheduledGame(scheduled.id)).rejects.toThrow(
      `Cannot simulate scheduled game: home team Cinder Squad has 0 healthy players (need at least ${MIN_AVAILABLE_PLAYERS}).`,
    );

    const after = await prisma.scheduledGame.findUniqueOrThrow({
      where: { id: scheduled.id },
    });
    expect(after.status).toBe("scheduled");
    expect(after.gameResultId).toBeNull();
    expect(
      await prisma.game.count({
        where: { leagueId: league.id },
      }),
    ).toBe(0);
    expect(
      await prisma.newsItem.count({
        where: { leagueId: league.id, kind: "game" },
      }),
    ).toBe(0);
  });
});
