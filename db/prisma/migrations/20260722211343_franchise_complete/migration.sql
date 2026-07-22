-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "userTeamId" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'regular',
    "day" INTEGER NOT NULL DEFAULT 1,
    "salaryCap" INTEGER NOT NULL DEFAULT 140000000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "League_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "conference" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "gmDirection" TEXT NOT NULL DEFAULT 'window',
    CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT,
    "leagueId" TEXT,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "age" INTEGER NOT NULL DEFAULT 24,
    "potential" INTEGER NOT NULL DEFAULT 70,
    "overall" INTEGER NOT NULL,
    "offense" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "shooting" INTEGER NOT NULL,
    "rebounding" INTEGER NOT NULL,
    "playmaking" INTEGER NOT NULL,
    "stamina" INTEGER NOT NULL,
    "rotationOrder" INTEGER NOT NULL DEFAULT 99,
    "targetMinutes" INTEGER NOT NULL DEFAULT 0,
    "injuredDays" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Player_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT,
    "salary" INTEGER NOT NULL,
    "yearsRemaining" INTEGER NOT NULL,
    CONSTRAINT "Contract_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contract_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduledGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "isPlayoff" BOOLEAN NOT NULL DEFAULT false,
    "seriesId" TEXT,
    "gameResultId" TEXT,
    CONSTRAINT "ScheduledGame_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduledGame_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduledGame_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "playedAt" DATETIME NOT NULL,
    "resultJson" TEXT NOT NULL,
    "isPlayoff" BOOLEAN NOT NULL DEFAULT false,
    "scheduledGameId" TEXT,
    CONSTRAINT "Game_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerSeasonStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT,
    "seasonYear" INTEGER NOT NULL,
    "games" INTEGER NOT NULL DEFAULT 0,
    "minutes" REAL NOT NULL DEFAULT 0,
    "pts" INTEGER NOT NULL DEFAULT 0,
    "reb" INTEGER NOT NULL DEFAULT 0,
    "ast" INTEGER NOT NULL DEFAULT 0,
    "stl" INTEGER NOT NULL DEFAULT 0,
    "blk" INTEGER NOT NULL DEFAULT 0,
    "tov" INTEGER NOT NULL DEFAULT 0,
    "fgm" INTEGER NOT NULL DEFAULT 0,
    "fga" INTEGER NOT NULL DEFAULT 0,
    "tpm" INTEGER NOT NULL DEFAULT 0,
    "tpa" INTEGER NOT NULL DEFAULT 0,
    "ftm" INTEGER NOT NULL DEFAULT 0,
    "fta" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlayerSeasonStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamSeasonStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "ptsFor" INTEGER NOT NULL DEFAULT 0,
    "ptsAgainst" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TeamSeasonStat_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsItem_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DraftPick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "pick" INTEGER NOT NULL,
    "originalTeamId" TEXT NOT NULL,
    "ownerTeamId" TEXT NOT NULL,
    "playerId" TEXT,
    CONSTRAINT "DraftPick_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DraftPick_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeasonChampion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    CONSTRAINT "SeasonChampion_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "teamId" TEXT,
    CONSTRAINT "Award_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeasonStat_playerId_seasonYear_key" ON "PlayerSeasonStat"("playerId", "seasonYear");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSeasonStat_teamId_seasonYear_key" ON "TeamSeasonStat"("teamId", "seasonYear");
