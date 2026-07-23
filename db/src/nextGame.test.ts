import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findNextUserRegularSeasonGame } from "./nextGame.js";
import { prisma } from "./prisma.js";

describe("next user regular-season game lookup", () => {
  const ownerIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ownerIds } } });
    await prisma.$disconnect();
  });

  it("ignores stale-season and playoff rows even when they occur earlier", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const seasonYear = 2099;
    const owner = await prisma.user.create({
      data: {
        email: `next-game-${suffix}@example.com`,
        displayName: "Next Game Owner",
        passwordHash: "unused",
      },
    });
    ownerIds.push(owner.id);

    const league = await prisma.league.create({
      data: {
        name: "Next Game League",
        seasonYear,
        ownerUserId: owner.id,
      },
    });
    const userTeam = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: "User Team",
        abbreviation: "USR",
        conference: "East",
        division: "Test",
      },
    });
    const opponent = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: "Opponent",
        abbreviation: "OPP",
        conference: "East",
        division: "Test",
      },
    });

    await prisma.scheduledGame.createMany({
      data: [
        {
          id: `playoff-${suffix}`,
          leagueId: league.id,
          seasonYear,
          day: 1,
          homeTeamId: userTeam.id,
          awayTeamId: opponent.id,
          isPlayoff: true,
        },
        {
          id: `stale-${suffix}`,
          leagueId: league.id,
          seasonYear: seasonYear - 1,
          day: 2,
          homeTeamId: opponent.id,
          awayTeamId: userTeam.id,
        },
        {
          id: `current-${suffix}`,
          leagueId: league.id,
          seasonYear,
          day: 3,
          homeTeamId: userTeam.id,
          awayTeamId: opponent.id,
        },
      ],
    });

    const nextGame = await findNextUserRegularSeasonGame({
      leagueId: league.id,
      seasonYear,
      teamId: userTeam.id,
    });

    expect(nextGame?.id).toBe(`current-${suffix}`);
    expect(nextGame).toMatchObject({ seasonYear, isPlayoff: false, day: 3 });
  });
});
