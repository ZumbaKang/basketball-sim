-- CreateIndex
CREATE INDEX "NewsItem_leagueId_seasonYear_kind_idx"
ON "NewsItem"("leagueId", "seasonYear", "kind");
