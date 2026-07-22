import type { GameResult, LeagueSnapshot, PlayGameRequest } from "@basketball-sim/shared";
import { prisma } from "./prisma.js";
import { toLeague, toPlayer, toTeam, parseGameResult } from "./mappers.js";

export async function ensureLeagueForUser(userId: string): Promise<LeagueSnapshot> {
  const existing = await prisma.league.findFirst({
    where: { ownerUserId: userId },
    include: { teams: { include: { players: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return {
      league: toLeague(existing),
      teams: existing.teams.map(toTeam),
      players: existing.teams.flatMap((t) => t.players.map(toPlayer)),
    };
  }

  return createSeededLeague(userId);
}

export async function getLeagueSnapshot(leagueId: string, userId: string): Promise<LeagueSnapshot> {
  const league = await prisma.league.findFirst({
    where: { id: leagueId, ownerUserId: userId },
    include: { teams: { include: { players: true } } },
  });
  if (!league) throw new Error("League not found");

  return {
    league: toLeague(league),
    teams: league.teams.map(toTeam),
    players: league.teams.flatMap((t) => t.players.map(toPlayer)),
  };
}

export async function listGamesForLeague(leagueId: string, userId: string): Promise<GameResult[]> {
  const league = await prisma.league.findFirst({ where: { id: leagueId, ownerUserId: userId } });
  if (!league) throw new Error("League not found");

  const games = await prisma.game.findMany({
    where: { leagueId },
    orderBy: { playedAt: "desc" },
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

type SeedTeam = {
  name: string;
  abbreviation: string;
  conference: string;
  players: { name: string; position: string; overall: number }[];
};

function ratingsFromOverall(overall: number) {
  return {
    overall,
    offense: overall,
    defense: Math.max(40, overall - 3),
    shooting: Math.max(40, overall - 2),
    rebounding: Math.max(40, overall - 5),
    playmaking: Math.max(40, overall - 4),
    stamina: Math.max(40, overall - 1),
  };
}

const SEED_TEAMS: SeedTeam[] = [
  {
    name: "Harbor Hawks",
    abbreviation: "HHK",
    conference: "East",
    players: [
      { name: "Jonah Pike", position: "PG", overall: 84 },
      { name: "Ellis Shore", position: "SG", overall: 81 },
      { name: "Malik Trent", position: "SF", overall: 79 },
      { name: "Omar Vale", position: "PF", overall: 82 },
      { name: "Theo Crane", position: "C", overall: 80 },
      { name: "Chris Bell", position: "PG", overall: 72 },
      { name: "Andre Holt", position: "SG", overall: 71 },
      { name: "Nate Quill", position: "SF", overall: 70 },
      { name: "Ben Rook", position: "PF", overall: 69 },
      { name: "Sam Drift", position: "C", overall: 68 },
    ],
  },
  {
    name: "Metro Foxes",
    abbreviation: "MFX",
    conference: "East",
    players: [
      { name: "Kai Mercer", position: "PG", overall: 83 },
      { name: "Devon Blake", position: "SG", overall: 80 },
      { name: "Riley Frost", position: "SF", overall: 78 },
      { name: "Hugo Lane", position: "PF", overall: 81 },
      { name: "Marcus Cole", position: "C", overall: 79 },
      { name: "Finn Adler", position: "PG", overall: 71 },
      { name: "Jasper York", position: "SG", overall: 70 },
      { name: "Leo Pratt", position: "SF", overall: 69 },
      { name: "Owen Greer", position: "PF", overall: 68 },
      { name: "Paul Hines", position: "C", overall: 67 },
    ],
  },
  {
    name: "Canyon Coyotes",
    abbreviation: "CCY",
    conference: "West",
    players: [
      { name: "Rex Dalton", position: "PG", overall: 82 },
      { name: "Vince Ortega", position: "SG", overall: 80 },
      { name: "Caleb Moss", position: "SF", overall: 81 },
      { name: "Ike Barlow", position: "PF", overall: 78 },
      { name: "Dorian Knox", position: "C", overall: 83 },
      { name: "Sean Pitt", position: "PG", overall: 70 },
      { name: "Tyler Ames", position: "SG", overall: 69 },
      { name: "Wade Kemp", position: "SF", overall: 68 },
      { name: "Yuri Nash", position: "PF", overall: 67 },
      { name: "Zack Orr", position: "C", overall: 66 },
    ],
  },
  {
    name: "Ironclad Irons",
    abbreviation: "IRI",
    conference: "West",
    players: [
      { name: "Quinn Avery", position: "PG", overall: 80 },
      { name: "Brett Colson", position: "SG", overall: 82 },
      { name: "Hector Diaz", position: "SF", overall: 79 },
      { name: "Ivan Brooks", position: "PF", overall: 84 },
      { name: "Jules Mercer", position: "C", overall: 81 },
      { name: "Kyle Dunn", position: "PG", overall: 71 },
      { name: "Lance Orth", position: "SG", overall: 70 },
      { name: "Milo West", position: "SF", overall: 69 },
      { name: "Noel Park", position: "PF", overall: 68 },
      { name: "Otto Reed", position: "C", overall: 67 },
    ],
  },
];

export async function createSeededLeague(userId: string): Promise<LeagueSnapshot> {
  const league = await prisma.league.create({
    data: {
      name: "Continental Circuit",
      seasonYear: new Date().getFullYear(),
      ownerUserId: userId,
      teams: {
        create: SEED_TEAMS.map((team) => ({
          name: team.name,
          abbreviation: team.abbreviation,
          conference: team.conference,
          players: {
            create: team.players.map((p) => {
              const r = ratingsFromOverall(p.overall);
              return {
                name: p.name,
                position: p.position,
                ...r,
              };
            }),
          },
        })),
      },
    },
    include: { teams: { include: { players: true } } },
  });

  return {
    league: toLeague(league),
    teams: league.teams.map(toTeam),
    players: league.teams.flatMap((t) => t.players.map(toPlayer)),
  };
}

export type { PlayGameRequest };
