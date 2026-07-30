import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameResult, Team } from "@basketball-sim/shared";
import { MIN_AVAILABLE_PLAYERS } from "@basketball-sim/sim";
import { prisma } from "./prisma.js";
import { persistResult, simulateScheduledGame } from "./playGame.js";

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

describe("persistResult transactional rollback", () => {
  const ownerIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ownerIds } } });
    await prisma.$disconnect();
  });

  function emptyTeamLine(team: Team, pts: number): GameResult["home"] {
    return {
      teamId: team.id,
      teamName: team.name,
      pts,
      reb: 40,
      ast: 20,
      stl: 5,
      blk: 4,
      tov: 12,
      fgm: 35,
      fga: 80,
      tpm: 10,
      tpa: 30,
      ftm: 10,
      fta: 12,
      players: [],
    };
  }

  it("rolls back the Game row when a post-Game write fails", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const seasonYear = 2095;
    const owner = await prisma.user.create({
      data: {
        email: `persist-tx-${suffix}@example.com`,
        displayName: "Persist Tx Owner",
        passwordHash: "unused",
      },
    });
    ownerIds.push(owner.id);

    const league = await prisma.league.create({
      data: {
        name: "Persist Tx League",
        seasonYear,
        ownerUserId: owner.id,
        day: 3,
      },
    });
    const [homeTeam, awayTeam] = await Promise.all([
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Atomic Hawks",
          abbreviation: "ATM",
          conference: "East",
          division: "Test",
          wins: 2,
          losses: 1,
        },
      }),
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Rollback Foxes",
          abbreviation: "RBF",
          conference: "West",
          division: "Test",
          wins: 1,
          losses: 2,
        },
      }),
    ]);

    const scheduled = await prisma.scheduledGame.create({
      data: {
        leagueId: league.id,
        seasonYear,
        day: 3,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        status: "scheduled",
      },
    });

    const home: Team = {
      id: homeTeam.id,
      leagueId: league.id,
      name: homeTeam.name,
      abbreviation: homeTeam.abbreviation,
      conference: "East",
      division: "Test",
      wins: homeTeam.wins,
      losses: homeTeam.losses,
      gmDirection: "contend",
    };
    const away: Team = {
      id: awayTeam.id,
      leagueId: league.id,
      name: awayTeam.name,
      abbreviation: awayTeam.abbreviation,
      conference: "West",
      division: "Test",
      wins: awayTeam.wins,
      losses: awayTeam.losses,
      gmDirection: "rebuild",
    };

    const gameId = `game-tx-fail-${suffix}`;
    const result: GameResult = {
      id: gameId,
      leagueId: league.id,
      home: emptyTeamLine(home, 110),
      away: emptyTeamLine(away, 98),
      playedAt: new Date().toISOString(),
      scheduledGameId: scheduled.id,
      isPlayoff: false,
    };

    await expect(
      persistResult(league.id, seasonYear, result, scheduled.id, false, home, away, {
        afterGameCreate: async () => {
          throw new Error("Forced post-Game write failure");
        },
      }),
    ).rejects.toThrow("Forced post-Game write failure");

    expect(
      await prisma.game.count({
        where: { id: gameId },
      }),
    ).toBe(0);
    expect(
      await prisma.game.count({
        where: { leagueId: league.id, scheduledGameId: scheduled.id },
      }),
    ).toBe(0);

    const after = await prisma.scheduledGame.findUniqueOrThrow({
      where: { id: scheduled.id },
    });
    expect(after.status).toBe("scheduled");
    expect(after.gameResultId).toBeNull();
    expect(after.homeScore).toBeNull();
    expect(after.awayScore).toBeNull();

    const [homeAfter, awayAfter] = await Promise.all([
      prisma.team.findUniqueOrThrow({ where: { id: homeTeam.id } }),
      prisma.team.findUniqueOrThrow({ where: { id: awayTeam.id } }),
    ]);
    expect(homeAfter.wins).toBe(2);
    expect(homeAfter.losses).toBe(1);
    expect(awayAfter.wins).toBe(1);
    expect(awayAfter.losses).toBe(2);

    expect(
      await prisma.newsItem.count({
        where: { leagueId: league.id, kind: "game" },
      }),
    ).toBe(0);
    expect(
      await prisma.teamSeasonStat.count({
        where: { teamId: { in: [homeTeam.id, awayTeam.id] }, seasonYear },
      }),
    ).toBe(0);
  });

  it("marks the scheduled game final and writes game news on success", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const seasonYear = 2094;
    const owner = await prisma.user.create({
      data: {
        email: `persist-ok-${suffix}@example.com`,
        displayName: "Persist Ok Owner",
        passwordHash: "unused",
      },
    });
    ownerIds.push(owner.id);

    const league = await prisma.league.create({
      data: {
        name: "Persist Ok League",
        seasonYear,
        ownerUserId: owner.id,
        day: 4,
      },
    });
    const [homeTeam, awayTeam] = await Promise.all([
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Commit Hawks",
          abbreviation: "CMT",
          conference: "East",
          division: "Test",
        },
      }),
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Commit Foxes",
          abbreviation: "CMF",
          conference: "West",
          division: "Test",
        },
      }),
    ]);

    const scheduled = await prisma.scheduledGame.create({
      data: {
        leagueId: league.id,
        seasonYear,
        day: 4,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        status: "scheduled",
      },
    });

    const home: Team = {
      id: homeTeam.id,
      leagueId: league.id,
      name: homeTeam.name,
      abbreviation: homeTeam.abbreviation,
      conference: "East",
      division: "Test",
      wins: 0,
      losses: 0,
      gmDirection: "contend",
    };
    const away: Team = {
      id: awayTeam.id,
      leagueId: league.id,
      name: awayTeam.name,
      abbreviation: awayTeam.abbreviation,
      conference: "West",
      division: "Test",
      wins: 0,
      losses: 0,
      gmDirection: "rebuild",
    };

    const gameId = `game-tx-ok-${suffix}`;
    const result: GameResult = {
      id: gameId,
      leagueId: league.id,
      home: emptyTeamLine(home, 105),
      away: emptyTeamLine(away, 99),
      playedAt: new Date().toISOString(),
      scheduledGameId: scheduled.id,
      isPlayoff: false,
    };

    await persistResult(league.id, seasonYear, result, scheduled.id, false, home, away);

    const after = await prisma.scheduledGame.findUniqueOrThrow({
      where: { id: scheduled.id },
    });
    expect(after.status).toBe("final");
    expect(after.gameResultId).toBe(gameId);
    expect(after.homeScore).toBe(105);
    expect(after.awayScore).toBe(99);

    expect(await prisma.game.count({ where: { id: gameId } })).toBe(1);
    expect(
      await prisma.newsItem.count({
        where: { leagueId: league.id, kind: "game" },
      }),
    ).toBe(1);
  });

  it("rejects a second persistResult when the scheduled row is already final", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const seasonYear = 2093;
    const owner = await prisma.user.create({
      data: {
        email: `persist-dup-${suffix}@example.com`,
        displayName: "Persist Dup Owner",
        passwordHash: "unused",
      },
    });
    ownerIds.push(owner.id);

    const league = await prisma.league.create({
      data: {
        name: "Persist Dup League",
        seasonYear,
        ownerUserId: owner.id,
        day: 5,
      },
    });
    const [homeTeam, awayTeam] = await Promise.all([
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Once Hawks",
          abbreviation: "ONC",
          conference: "East",
          division: "Test",
          wins: 4,
          losses: 2,
        },
      }),
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Once Foxes",
          abbreviation: "ONF",
          conference: "West",
          division: "Test",
          wins: 3,
          losses: 3,
        },
      }),
    ]);

    const scheduled = await prisma.scheduledGame.create({
      data: {
        leagueId: league.id,
        seasonYear,
        day: 5,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        status: "scheduled",
      },
    });

    const home: Team = {
      id: homeTeam.id,
      leagueId: league.id,
      name: homeTeam.name,
      abbreviation: homeTeam.abbreviation,
      conference: "East",
      division: "Test",
      wins: homeTeam.wins,
      losses: homeTeam.losses,
      gmDirection: "contend",
    };
    const away: Team = {
      id: awayTeam.id,
      leagueId: league.id,
      name: awayTeam.name,
      abbreviation: awayTeam.abbreviation,
      conference: "West",
      division: "Test",
      wins: awayTeam.wins,
      losses: awayTeam.losses,
      gmDirection: "rebuild",
    };

    const firstId = `game-dup-first-${suffix}`;
    const firstResult: GameResult = {
      id: firstId,
      leagueId: league.id,
      home: emptyTeamLine(home, 112),
      away: emptyTeamLine(away, 101),
      playedAt: new Date().toISOString(),
      scheduledGameId: scheduled.id,
      isPlayoff: false,
    };

    await persistResult(league.id, seasonYear, firstResult, scheduled.id, false, home, away);

    const [homeAfterFirst, awayAfterFirst] = await Promise.all([
      prisma.team.findUniqueOrThrow({ where: { id: homeTeam.id } }),
      prisma.team.findUniqueOrThrow({ where: { id: awayTeam.id } }),
    ]);
    expect(homeAfterFirst.wins).toBe(5);
    expect(homeAfterFirst.losses).toBe(2);
    expect(awayAfterFirst.wins).toBe(3);
    expect(awayAfterFirst.losses).toBe(4);

    const secondId = `game-dup-second-${suffix}`;
    const secondResult: GameResult = {
      id: secondId,
      leagueId: league.id,
      home: emptyTeamLine(home, 90),
      away: emptyTeamLine(away, 95),
      playedAt: new Date().toISOString(),
      scheduledGameId: scheduled.id,
      isPlayoff: false,
    };

    await expect(
      persistResult(league.id, seasonYear, secondResult, scheduled.id, false, home, away),
    ).rejects.toThrow(
      `Cannot persist result: scheduled game ${scheduled.id} is already final.`,
    );

    expect(await prisma.game.count({ where: { id: firstId } })).toBe(1);
    expect(await prisma.game.count({ where: { id: secondId } })).toBe(0);
    expect(
      await prisma.game.count({
        where: { leagueId: league.id, scheduledGameId: scheduled.id },
      }),
    ).toBe(1);
    expect(
      await prisma.newsItem.count({
        where: { leagueId: league.id, kind: "game" },
      }),
    ).toBe(1);

    const [homeAfterSecond, awayAfterSecond] = await Promise.all([
      prisma.team.findUniqueOrThrow({ where: { id: homeTeam.id } }),
      prisma.team.findUniqueOrThrow({ where: { id: awayTeam.id } }),
    ]);
    expect(homeAfterSecond.wins).toBe(5);
    expect(homeAfterSecond.losses).toBe(2);
    expect(awayAfterSecond.wins).toBe(3);
    expect(awayAfterSecond.losses).toBe(4);

    const after = await prisma.scheduledGame.findUniqueOrThrow({
      where: { id: scheduled.id },
    });
    expect(after.status).toBe("final");
    expect(after.gameResultId).toBe(firstId);
    expect(after.homeScore).toBe(112);
    expect(after.awayScore).toBe(101);
  });

  it("rolls back without flipping the scheduled row when Game.create reuses an id", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const seasonYear = 2092;
    const owner = await prisma.user.create({
      data: {
        email: `persist-id-collide-${suffix}@example.com`,
        displayName: "Persist Id Collide Owner",
        passwordHash: "unused",
      },
    });
    ownerIds.push(owner.id);

    const league = await prisma.league.create({
      data: {
        name: "Persist Id Collide League",
        seasonYear,
        ownerUserId: owner.id,
        day: 6,
      },
    });
    const [homeTeam, awayTeam, otherHome, otherAway] = await Promise.all([
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Collide Hawks",
          abbreviation: "CLH",
          conference: "East",
          division: "Test",
          wins: 6,
          losses: 3,
        },
      }),
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Collide Foxes",
          abbreviation: "CLF",
          conference: "West",
          division: "Test",
          wins: 5,
          losses: 4,
        },
      }),
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Prior Hawks",
          abbreviation: "PRH",
          conference: "East",
          division: "Test",
        },
      }),
      prisma.team.create({
        data: {
          leagueId: league.id,
          name: "Prior Foxes",
          abbreviation: "PRF",
          conference: "West",
          division: "Test",
        },
      }),
    ]);

    const reusedId = `game-id-collide-${suffix}`;
    const priorScheduled = await prisma.scheduledGame.create({
      data: {
        leagueId: league.id,
        seasonYear,
        day: 5,
        homeTeamId: otherHome.id,
        awayTeamId: otherAway.id,
        status: "final",
        homeScore: 100,
        awayScore: 90,
        gameResultId: reusedId,
      },
    });
    const priorJson = JSON.stringify({
      id: reusedId,
      leagueId: league.id,
      note: "pre-inserted fixture",
    });
    await prisma.game.create({
      data: {
        id: reusedId,
        leagueId: league.id,
        homeTeamId: otherHome.id,
        awayTeamId: otherAway.id,
        playedAt: new Date("2092-01-01T00:00:00.000Z"),
        resultJson: priorJson,
        isPlayoff: false,
        scheduledGameId: priorScheduled.id,
      },
    });

    const scheduled = await prisma.scheduledGame.create({
      data: {
        leagueId: league.id,
        seasonYear,
        day: 6,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        status: "scheduled",
      },
    });

    const home: Team = {
      id: homeTeam.id,
      leagueId: league.id,
      name: homeTeam.name,
      abbreviation: homeTeam.abbreviation,
      conference: "East",
      division: "Test",
      wins: homeTeam.wins,
      losses: homeTeam.losses,
      gmDirection: "contend",
    };
    const away: Team = {
      id: awayTeam.id,
      leagueId: league.id,
      name: awayTeam.name,
      abbreviation: awayTeam.abbreviation,
      conference: "West",
      division: "Test",
      wins: awayTeam.wins,
      losses: awayTeam.losses,
      gmDirection: "rebuild",
    };

    const collidingResult: GameResult = {
      id: reusedId,
      leagueId: league.id,
      home: emptyTeamLine(home, 118),
      away: emptyTeamLine(away, 110),
      playedAt: new Date().toISOString(),
      scheduledGameId: scheduled.id,
      isPlayoff: false,
    };

    await expect(
      persistResult(league.id, seasonYear, collidingResult, scheduled.id, false, home, away),
    ).rejects.toThrow(`Cannot persist result: game id ${reusedId} already exists.`);

    const after = await prisma.scheduledGame.findUniqueOrThrow({
      where: { id: scheduled.id },
    });
    expect(after.status).toBe("scheduled");
    expect(after.gameResultId).toBeNull();
    expect(after.homeScore).toBeNull();
    expect(after.awayScore).toBeNull();

    const priorGame = await prisma.game.findUniqueOrThrow({ where: { id: reusedId } });
    expect(priorGame.scheduledGameId).toBe(priorScheduled.id);
    expect(priorGame.resultJson).toBe(priorJson);
    expect(priorGame.homeTeamId).toBe(otherHome.id);
    expect(priorGame.awayTeamId).toBe(otherAway.id);

    expect(
      await prisma.game.count({
        where: { leagueId: league.id, scheduledGameId: scheduled.id },
      }),
    ).toBe(0);

    const [homeAfter, awayAfter] = await Promise.all([
      prisma.team.findUniqueOrThrow({ where: { id: homeTeam.id } }),
      prisma.team.findUniqueOrThrow({ where: { id: awayTeam.id } }),
    ]);
    expect(homeAfter.wins).toBe(6);
    expect(homeAfter.losses).toBe(3);
    expect(awayAfter.wins).toBe(5);
    expect(awayAfter.losses).toBe(4);

    expect(
      await prisma.newsItem.count({
        where: { leagueId: league.id, kind: "game" },
      }),
    ).toBe(0);
    expect(
      await prisma.teamSeasonStat.count({
        where: { teamId: { in: [homeTeam.id, awayTeam.id] }, seasonYear },
      }),
    ).toBe(0);
  });
});
