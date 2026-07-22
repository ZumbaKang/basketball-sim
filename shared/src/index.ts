/** Cross-domain contracts only — no implementation logic. */

export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export type PlayerRatings = {
  overall: number;
  offense: number;
  defense: number;
  shooting: number;
  rebounding: number;
  playmaking: number;
  stamina: number;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
};

export type League = {
  id: string;
  name: string;
  seasonYear: number;
  ownerUserId: string;
};

export type Team = {
  id: string;
  leagueId: string;
  name: string;
  abbreviation: string;
  conference?: string;
};

export type Player = {
  id: string;
  teamId: string;
  name: string;
  position: Position;
  ratings: PlayerRatings;
};

export type PlayerGameLine = {
  playerId: string;
  playerName: string;
  teamId: string;
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  plusMinus?: number;
};

export type TeamGameLine = {
  teamId: string;
  teamName: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  players: PlayerGameLine[];
};

export type GameResult = {
  id: string;
  leagueId: string;
  home: TeamGameLine;
  away: TeamGameLine;
  playedAt: string;
};

export type PlayGameRequest = {
  leagueId: string;
  homeTeamId: string;
  awayTeamId: string;
};

export type LeagueSnapshot = {
  league: League;
  teams: Team[];
  players: Player[];
};
