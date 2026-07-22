import type { LeagueSnapshot } from "@basketball-sim/shared";
import { prisma } from "./prisma.js";
import { toContract, toLeague, toPlayer, toTeam, parseGameResult } from "./mappers.js";
import type { GameResult } from "@basketball-sim/shared";
import { FRANCHISE_TEAMS, makeRoster } from "./seedData.js";
import { generateSchedule } from "./schedule.js";

async function snapshotFromLeague(leagueId: string): Promise<LeagueSnapshot> {
  const league = await prisma.league.findUniqueOrThrow({
    where: { id: leagueId },
    include: {
      teams: {
        include: { players: true, contracts: true },
        orderBy: { name: "asc" },
      },
    },
  });
  const freeAgents = await prisma.player.findMany({
    where: { leagueId, teamId: null },
  });

  return {
    league: toLeague(league),
    teams: league.teams.map(toTeam),
    players: [
      ...league.teams.flatMap((t) => t.players.map(toPlayer)),
      ...freeAgents.map(toPlayer),
    ],
    contracts: league.teams.flatMap((t) => t.contracts.map(toContract)),
    userTeamId: league.userTeamId,
  };
}

export async function ensureLeagueForUser(userId: string): Promise<LeagueSnapshot> {
  const existing = await prisma.league.findFirst({
    where: { ownerUserId: userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return snapshotFromLeague(existing.id);
  return createSeededLeague(userId);
}

export async function getLeagueSnapshot(leagueId: string, userId: string): Promise<LeagueSnapshot> {
  const league = await prisma.league.findFirst({ where: { id: leagueId, ownerUserId: userId } });
  if (!league) throw new Error("League not found");
  return snapshotFromLeague(league.id);
}

export async function listGamesForLeague(leagueId: string, userId: string): Promise<GameResult[]> {
  const league = await prisma.league.findFirst({ where: { id: leagueId, ownerUserId: userId } });
  if (!league) throw new Error("League not found");
  const games = await prisma.game.findMany({
    where: { leagueId },
    orderBy: { playedAt: "desc" },
    take: 40,
  });
  return games.map((g) => parseGameResult(g.resultJson));
}

export async function getGame(gameId: string, userId: string): Promise<GameResult> {
  const game = await prisma.game.findFirst({
    where: { id: gameId, league: { ownerUserId: userId } },
  });
  if (!game) throw new Error("Game not found");
  return parseGameResult(game.resultJson);
}

export async function listFranchiseChoices(userId: string) {
  const league = await ensureLeagueForUser(userId);
  return league.teams.map((t) => ({
    id: t.id,
    name: t.name,
    abbreviation: t.abbreviation,
    conference: t.conference,
    division: t.division,
    gmDirection: t.gmDirection,
  }));
}

export async function assignFranchise(userId: string, teamId: string): Promise<LeagueSnapshot> {
  const league = await prisma.league.findFirst({ where: { ownerUserId: userId } });
  if (!league) throw new Error("League not found");
  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: league.id } });
  if (!team) throw new Error("Team not found");

  await prisma.league.update({
    where: { id: league.id },
    data: { userTeamId: team.id },
  });

  await prisma.newsItem.create({
    data: {
      leagueId: league.id,
      seasonYear: league.seasonYear,
      day: league.day,
      kind: "season",
      headline: `${team.name} under new management`,
      body: `The franchise keys were handed over. Direction: ${team.gmDirection}.`,
    },
  });

  return snapshotFromLeague(league.id);
}

export async function createSeededLeague(userId: string): Promise<LeagueSnapshot> {
  const seasonYear = new Date().getFullYear();
  const league = await prisma.league.create({
    data: {
      name: "Continental Circuit",
      seasonYear,
      ownerUserId: userId,
      phase: "regular",
      day: 1,
      salaryCap: 140_000_000,
    },
  });

  for (let i = 0; i < FRANCHISE_TEAMS.length; i++) {
    const def = FRANCHISE_TEAMS[i]!;
    const roster = makeRoster(i, def.strength);
    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: def.name,
        abbreviation: def.abbreviation,
        conference: def.conference,
        division: def.division,
        gmDirection: def.gmDirection,
        players: {
          create: roster.map((p) => ({
            name: p.name,
            position: p.position,
            age: p.age,
            potential: p.potential,
            overall: p.overall,
            offense: p.offense,
            defense: p.defense,
            shooting: p.shooting,
            rebounding: p.rebounding,
            playmaking: p.playmaking,
            stamina: p.stamina,
            rotationOrder: p.rotationOrder,
            targetMinutes: p.targetMinutes,
          })),
        },
      },
      include: { players: true },
    });

    for (let pi = 0; pi < team.players.length; pi++) {
      const player = team.players[pi]!;
      const seed = roster[pi]!;
      await prisma.contract.create({
        data: {
          playerId: player.id,
          teamId: team.id,
          salary: seed.salary,
          yearsRemaining: seed.yearsRemaining,
        },
      });
    }

    await prisma.teamSeasonStat.create({
      data: { teamId: team.id, seasonYear },
    });

    for (const round of [1, 2]) {
      await prisma.draftPick.create({
        data: {
          leagueId: league.id,
          seasonYear: seasonYear + 1,
          round,
          pick: i + 1 + (round - 1) * FRANCHISE_TEAMS.length,
          originalTeamId: team.id,
          ownerTeamId: team.id,
        },
      });
    }
  }

  const teams = await prisma.team.findMany({ where: { leagueId: league.id } });
  await generateSchedule(league.id, seasonYear, teams.map((t) => t.id));

  await prisma.newsItem.create({
    data: {
      leagueId: league.id,
      seasonYear,
      day: 1,
      kind: "season",
      headline: "Continental Circuit tips off",
      body: "30 franchises. One trophy. Pick your team and run the table.",
    },
  });

  return snapshotFromLeague(league.id);
}
