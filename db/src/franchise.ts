import type { FranchiseHome } from "@basketball-sim/shared";
import { prisma } from "./prisma.js";
import { ensureLeagueForUser, listGamesForLeague } from "./league.js";
import { getStandings } from "./standings.js";
import { toNews, toPlayer, toScheduleGame, toUser } from "./mappers.js";

export async function getFranchiseHome(userId: string): Promise<FranchiseHome> {
  const snapshot = await ensureLeagueForUser(userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const standings = await getStandings(snapshot.league.id);
  const recentGames = await listGamesForLeague(snapshot.league.id, userId);

  const nextGameRow = snapshot.userTeamId
    ? await prisma.scheduledGame.findFirst({
        where: {
          leagueId: snapshot.league.id,
          status: "scheduled",
          OR: [{ homeTeamId: snapshot.userTeamId }, { awayTeamId: snapshot.userTeamId }],
        },
        orderBy: [{ day: "asc" }],
      })
    : null;

  const newsRows = await prisma.newsItem.findMany({
    where: { leagueId: snapshot.league.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const roster = snapshot.userTeamId
    ? snapshot.players
        .filter((p) => p.teamId === snapshot.userTeamId)
        .sort((a, b) => a.rotationOrder - b.rotationOrder)
    : [];

  const payroll = snapshot.contracts
    .filter((c) => c.teamId === snapshot.userTeamId)
    .reduce((s, c) => s + c.salary, 0);

  return {
    user: toUser(user),
    snapshot,
    standings,
    nextGame: nextGameRow ? toScheduleGame(nextGameRow) : null,
    recentGames: recentGames.slice(0, 10),
    news: newsRows.map(toNews),
    roster: roster.map((p) => p),
    payroll,
  };
}

void toPlayer;
