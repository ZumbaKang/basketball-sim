import type {
  Contract,
  GameResult,
  League,
  NewsItem,
  Player,
  Position,
  ScheduleGame,
  Team,
  User,
  Conference,
  GmDirection,
  LeaguePhase,
  ScheduledGameStatus,
  NewsKind,
} from "@basketball-sim/shared";

export function toUser(row: {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toLeague(row: {
  id: string;
  name: string;
  seasonYear: number;
  ownerUserId: string;
  userTeamId: string | null;
  phase: string;
  day: number;
  salaryCap: number;
}): League {
  return {
    id: row.id,
    name: row.name,
    seasonYear: row.seasonYear,
    ownerUserId: row.ownerUserId,
    userTeamId: row.userTeamId,
    phase: row.phase as LeaguePhase,
    day: row.day,
    salaryCap: row.salaryCap,
  };
}

export function toTeam(row: {
  id: string;
  leagueId: string;
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  gmDirection: string;
}): Team {
  return {
    id: row.id,
    leagueId: row.leagueId,
    name: row.name,
    abbreviation: row.abbreviation,
    conference: row.conference as Conference,
    division: row.division,
    wins: row.wins,
    losses: row.losses,
    gmDirection: row.gmDirection as GmDirection,
  };
}

export function toPlayer(row: {
  id: string;
  teamId: string | null;
  name: string;
  position: string;
  age: number;
  potential: number;
  overall: number;
  offense: number;
  defense: number;
  shooting: number;
  rebounding: number;
  playmaking: number;
  stamina: number;
  rotationOrder: number;
  targetMinutes: number;
  injuredDays: number;
}): Player {
  return {
    id: row.id,
    teamId: row.teamId,
    name: row.name,
    position: row.position as Position,
    age: row.age,
    potential: row.potential,
    ratings: {
      overall: row.overall,
      offense: row.offense,
      defense: row.defense,
      shooting: row.shooting,
      rebounding: row.rebounding,
      playmaking: row.playmaking,
      stamina: row.stamina,
    },
    rotationOrder: row.rotationOrder,
    targetMinutes: row.targetMinutes,
    injuredDays: row.injuredDays,
    isFreeAgent: row.teamId == null,
  };
}

export function toContract(row: {
  id: string;
  playerId: string;
  teamId: string | null;
  salary: number;
  yearsRemaining: number;
}): Contract {
  return {
    id: row.id,
    playerId: row.playerId,
    teamId: row.teamId,
    salary: row.salary,
    yearsRemaining: row.yearsRemaining,
  };
}

export function toScheduleGame(row: {
  id: string;
  leagueId: string;
  seasonYear: number;
  day: number;
  homeTeamId: string;
  awayTeamId: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  isPlayoff: boolean;
  seriesId: string | null;
  gameResultId: string | null;
}): ScheduleGame {
  return {
    id: row.id,
    leagueId: row.leagueId,
    seasonYear: row.seasonYear,
    day: row.day,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    status: row.status as ScheduledGameStatus,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    isPlayoff: row.isPlayoff,
    seriesId: row.seriesId,
    gameResultId: row.gameResultId,
  };
}

export function toNews(row: {
  id: string;
  leagueId: string;
  seasonYear: number;
  day: number;
  kind: string;
  headline: string;
  body: string;
  createdAt: Date;
}): NewsItem {
  return {
    id: row.id,
    leagueId: row.leagueId,
    seasonYear: row.seasonYear,
    day: row.day,
    kind: row.kind as NewsKind,
    headline: row.headline,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

export function parseGameResult(json: string): GameResult {
  return JSON.parse(json) as GameResult;
}
