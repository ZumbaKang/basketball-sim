-- CreateTable
CREATE TABLE "TradeOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "partnerTeamId" TEXT NOT NULL,
    "ourMargin" REAL NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeOutcome_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TradeOutcome_leagueId_teamId_partnerTeamId_idx" ON "TradeOutcome"("leagueId", "teamId", "partnerTeamId");
