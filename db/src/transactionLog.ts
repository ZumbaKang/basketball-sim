import type { NewsItem, NewsKind } from "@basketball-sim/shared";
import { toNews } from "./mappers.js";
import { prisma } from "./prisma.js";

const TRANSACTION_KINDS: NewsKind[] = ["trade", "signing", "draft", "transaction"];

/**
 * Lists every roster move recorded during the league's current season.
 *
 * General news such as game results, injuries, and season announcements is
 * intentionally excluded so callers can render a dedicated transaction log.
 */
export async function listSeasonTransactions(
  userId: string,
  leagueId: string,
): Promise<NewsItem[]> {
  const league = await prisma.league.findFirst({
    where: { id: leagueId, ownerUserId: userId },
    select: { seasonYear: true },
  });
  if (!league) throw new Error("League not found");

  const rows = await prisma.newsItem.findMany({
    where: {
      leagueId,
      seasonYear: league.seasonYear,
      kind: { in: TRANSACTION_KINDS },
    },
    orderBy: [{ day: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  });

  return rows.map(toNews);
}
