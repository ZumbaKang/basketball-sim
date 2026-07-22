/** Cross-domain contracts only — no implementation logic. */

export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export type Conference = "East" | "West";
export type LeaguePhase = "preseason" | "regular" | "playoffs" | "offseason";
export type GmDirection = "contend" | "window" | "rebuild" | "tank" | "cheap";
export type AdvanceMode = "next" | "toUserGame" | "days" | "season";
export type ScheduledGameStatus = "scheduled" | "final" | "in_progress";
export type NewsKind =
  | "game"
  | "trade"
  | "signing"
  | "draft"
  | "injury"
  | "award"
  | "season"
  | "transaction";

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
  userTeamId: string | null;
  phase: LeaguePhase;
  day: number;
  salaryCap: number;
};

export type Team = {
  id: string;
  leagueId: string;
  name: string;
  abbreviation: string;
  conference: Conference;
  division: string;
  wins: number;
  losses: number;
  gmDirection: GmDirection;
};

export type Player = {
  id: string;
  teamId: string | null;
  name: string;
  position: Position;
  age: number;
  potential: number;
  ratings: PlayerRatings;
  rotationOrder: number;
  targetMinutes: number;
  injuredDays: number;
  isFreeAgent: boolean;
};

export type Contract = {
  id: string;
  playerId: string;
  teamId: string | null;
  salary: number;
  yearsRemaining: number;
};

export type GmProfile = {
  teamId: string;
  direction: GmDirection;
  aggression: number;
  loyalty: number;
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
  scheduledGameId?: string;
  isPlayoff?: boolean;
};

export type PlayGameRequest = {
  leagueId: string;
  homeTeamId: string;
  awayTeamId: string;
};

export type ScheduleGame = {
  id: string;
  leagueId: string;
  seasonYear: number;
  day: number;
  homeTeamId: string;
  awayTeamId: string;
  status: ScheduledGameStatus;
  homeScore: number | null;
  awayScore: number | null;
  isPlayoff: boolean;
  seriesId: string | null;
  gameResultId: string | null;
};

export type StandingsRow = {
  teamId: string;
  teamName: string;
  abbreviation: string;
  conference: Conference;
  division: string;
  wins: number;
  losses: number;
  winPct: number;
  confWins: number;
  confLosses: number;
  pointDiff: number;
  rank: number;
};

export type PlayerSeasonStats = {
  playerId: string;
  teamId: string | null;
  seasonYear: number;
  games: number;
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
};

export type TeamSeasonStats = {
  teamId: string;
  seasonYear: number;
  wins: number;
  losses: number;
  ptsFor: number;
  ptsAgainst: number;
};

export type AdvanceRequest = {
  leagueId: string;
  mode: AdvanceMode;
  days?: number;
  autoSimUserGames?: boolean;
};

export type AdvanceResult = {
  league: League;
  gamesPlayed: GameResult[];
  nextUserGame: ScheduleGame | null;
  standings: StandingsRow[];
  phaseChanged: boolean;
  message: string;
};

export type NewsItem = {
  id: string;
  leagueId: string;
  seasonYear: number;
  day: number;
  kind: NewsKind;
  headline: string;
  body: string;
  createdAt: string;
};

export type TradeAsset = {
  playerId?: string;
  draftPickId?: string;
};

export type TradeProposal = {
  id?: string;
  leagueId: string;
  fromTeamId: string;
  toTeamId: string;
  fromAssets: TradeAsset[];
  toAssets: TradeAsset[];
};

export type TradeDecision = {
  accepted: boolean;
  reason: string;
  proposal: TradeProposal;
};

export type FreeAgentOffer = {
  leagueId: string;
  teamId: string;
  playerId: string;
  salary: number;
  years: number;
};

export type DraftPick = {
  id: string;
  leagueId: string;
  seasonYear: number;
  round: number;
  pick: number;
  originalTeamId: string;
  ownerTeamId: string;
  playerId: string | null;
};

export type DraftProspect = {
  id: string;
  name: string;
  position: Position;
  age: number;
  potential: number;
  ratings: PlayerRatings;
};

export type FranchiseAssignment = {
  leagueId: string;
  userTeamId: string;
};

export type SeasonChampion = {
  seasonYear: number;
  teamId: string;
  teamName: string;
};

export type Award = {
  seasonYear: number;
  kind: "MVP" | "DPOY" | "ROY" | "SMOY" | "ALL_LEAGUE";
  playerId: string;
  playerName: string;
  teamId: string | null;
};

export type LeagueSnapshot = {
  league: League;
  teams: Team[];
  players: Player[];
  contracts: Contract[];
  userTeamId: string | null;
};

export type FranchiseHome = {
  user: User;
  snapshot: LeagueSnapshot;
  standings: StandingsRow[];
  nextGame: ScheduleGame | null;
  recentGames: GameResult[];
  news: NewsItem[];
  roster: Player[];
  payroll: number;
};
