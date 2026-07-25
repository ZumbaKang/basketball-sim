import type {
  NewsKind,
  SeasonTransactionCursor,
  SeasonTransactionPage,
  SeasonTransactionPageRequest,
} from "@basketball-sim/shared";
import { toNews } from "./mappers.js";
import { prisma } from "./prisma.js";

const TRANSACTION_KINDS: NewsKind[] = ["trade", "signing", "draft", "transaction"];
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function pageSize(request: SeasonTransactionPageRequest): number {
  const limit = request.limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new RangeError(`Transaction page limit must be an integer from 1 to ${MAX_PAGE_SIZE}`);
  }
  return limit;
}

function cursorDate(cursor: SeasonTransactionCursor): Date {
  const createdAt = new Date(cursor.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    throw new TypeError("Transaction cursor createdAt must be a valid timestamp");
  }
  return createdAt;
}

/**
 * Lists one page of roster moves recorded during the league's current season.
 *
 * General news such as game results, injuries, and season announcements is
 * intentionally excluded so callers can render a dedicated transaction log.
 * The cursor matches the descending sort tuple so rows sharing a day and
 * timestamp cannot be duplicated or skipped at page boundaries.
 */
export async function listSeasonTransactions(
  userId: string,
  leagueId: string,
  request: SeasonTransactionPageRequest = {},
): Promise<SeasonTransactionPage> {
  const limit = pageSize(request);
  const boundary = request.cursor ? cursorDate(request.cursor) : null;
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
      ...(request.cursor && boundary
        ? {
            OR: [
              { day: { lt: request.cursor.day } },
              { day: request.cursor.day, createdAt: { lt: boundary } },
              {
                day: request.cursor.day,
                createdAt: boundary,
                id: { lt: request.cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ day: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(toNews);
  const last = hasMore ? items.at(-1) : undefined;

  return {
    items,
    nextCursor: last
      ? { day: last.day, createdAt: last.createdAt, id: last.id }
      : null,
  };
}
