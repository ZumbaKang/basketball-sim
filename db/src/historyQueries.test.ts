import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeAwards } from "./awards.js";
import { prisma } from "./prisma.js";

describe("history query performance", () => {
  const ownerIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ownerIds } } });
    await prisma.$disconnect();
  });

  it("keeps lookup index columns aligned with standings and history filters", async () => {
    const scheduledGameIndex = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      'PRAGMA index_info("ScheduledGame_leagueId_seasonYear_status_isPlayoff_day_idx")',
    );
    expect(scheduledGameIndex.map(({ name }) => name)).toEqual([
      "leagueId",
      "seasonYear",
      "status",
      "isPlayoff",
      "day",
    ]);

    const playerStatIndex = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      'PRAGMA index_info("PlayerSeasonStat_seasonYear_teamId_idx")',
    );
    expect(playerStatIndex.map(({ name }) => name)).toEqual(["seasonYear", "teamId"]);
  });

  it("limits award history reads to teams in the requested league", async () => {
    const seasonYear = 2099;
    const first = await createLeagueWithPlayer("In League", seasonYear, 10);
    const second = await createLeagueWithPlayer("Other League", seasonYear, 100);
    ownerIds.push(first.ownerId, second.ownerId);

    await computeAwards(first.leagueId, seasonYear);

    const awards = await prisma.award.findMany({ where: { leagueId: first.leagueId } });
    expect(awards.length).toBeGreaterThan(0);
    expect(new Set(awards.map(({ playerId }) => playerId))).toEqual(new Set([first.playerId]));
  });
});

async function createLeagueWithPlayer(name: string, seasonYear: number, points: number) {
  const suffix = `${name.toLowerCase().replaceAll(" ", "-")}-${Date.now()}-${Math.random()}`;
  const owner = await prisma.user.create({
    data: {
      email: `${suffix}@example.com`,
      displayName: name,
      passwordHash: "unused",
    },
  });
  const league = await prisma.league.create({
    data: {
      name: `${name} League`,
      seasonYear,
      ownerUserId: owner.id,
    },
  });
  const team = await prisma.team.create({
    data: {
      leagueId: league.id,
      name: `${name} Team`,
      abbreviation: name.slice(0, 3).toUpperCase(),
      conference: "East",
      division: "Test",
    },
  });
  const player = await prisma.player.create({
    data: {
      teamId: team.id,
      name,
      position: "G",
      age: 25,
      potential: 70,
      overall: 70,
      offense: 70,
      defense: 70,
      shooting: 70,
      rebounding: 70,
      playmaking: 70,
      stamina: 70,
    },
  });
  await prisma.playerSeasonStat.create({
    data: {
      playerId: player.id,
      teamId: team.id,
      seasonYear,
      games: 1,
      minutes: 30,
      pts: points,
      reb: points,
      ast: points,
      stl: points,
      blk: points,
    },
  });
  return { ownerId: owner.id, leagueId: league.id, playerId: player.id };
}
