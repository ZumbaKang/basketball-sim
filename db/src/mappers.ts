import type {
  GameResult,
  League,
  Player,
  Position,
  Team,
  User,
} from "@basketball-sim/shared";

type DbUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
};

type DbLeague = {
  id: string;
  name: string;
  seasonYear: number;
  ownerUserId: string;
};

type DbTeam = {
  id: string;
  leagueId: string;
  name: string;
  abbreviation: string;
  conference: string | null;
};

type DbPlayer = {
  id: string;
  teamId: string;
  name: string;
  position: string;
  overall: number;
  offense: number;
  defense: number;
  shooting: number;
  rebounding: number;
  playmaking: number;
  stamina: number;
};

export function toUser(row: DbUser): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toLeague(row: DbLeague): League {
  return {
    id: row.id,
    name: row.name,
    seasonYear: row.seasonYear,
    ownerUserId: row.ownerUserId,
  };
}

export function toTeam(row: DbTeam): Team {
  return {
    id: row.id,
    leagueId: row.leagueId,
    name: row.name,
    abbreviation: row.abbreviation,
    conference: row.conference ?? undefined,
  };
}

export function toPlayer(row: DbPlayer): Player {
  return {
    id: row.id,
    teamId: row.teamId,
    name: row.name,
    position: row.position as Position,
    ratings: {
      overall: row.overall,
      offense: row.offense,
      defense: row.defense,
      shooting: row.shooting,
      rebounding: row.rebounding,
      playmaking: row.playmaking,
      stamina: row.stamina,
    },
  };
}

export function parseGameResult(json: string): GameResult {
  return JSON.parse(json) as GameResult;
}
