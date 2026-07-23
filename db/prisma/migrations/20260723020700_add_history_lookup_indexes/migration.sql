-- CreateIndex
CREATE INDEX "ScheduledGame_leagueId_seasonYear_status_isPlayoff_day_idx"
ON "ScheduledGame"("leagueId", "seasonYear", "status", "isPlayoff", "day");

-- CreateIndex
CREATE INDEX "PlayerSeasonStat_seasonYear_teamId_idx"
ON "PlayerSeasonStat"("seasonYear", "teamId");
