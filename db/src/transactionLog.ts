import type { NewsItem, NewsKind } from "@basketball-sim/shared";
import { toNews } from "./mappers.js";
import { prisma } from "./prisma.js";

const TRANSACTION_KINDS: NewsKind[] = ["trade", "signing", "draft", "transaction"];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type SeasonTransactionCursor = {
  leagueId: string;
  seasonYear: number;
  day: number;
  createdAt: string;
  id: string;
};

export type SeasonTransactionPage = {
  transactions: NewsItem[];
  nextCursor: SeasonTransactionCursor | null;
};

export type ListSeasonTransactionsOptions = {
  limit?: number;
  cursor?: SeasonTransactionCursor;
};

function normalizeLimit(limit: number | undefined): number {
  const normalized = limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > MAX_PAGE_SIZE) {
    throw new RangeError(`Transaction page size must be between 1 and ${MAX_PAGE_SIZE}`);
  }
  return normalized;
}

function parseCursor(cursor: SeasonTransactionCursor | undefined): {
  leagueId: string;
  seasonYear: number;
  day: number;
  createdAt: Date;
  id: string;
} | null {
  if (!cursor) return null;

  if (
    typeof cursor.leagueId !== "string"
    || cursor.leagueId.length === 0
    || !Number.isInteger(cursor.seasonYear)
    || !Number.isInteger(cursor.day)
    || typeof cursor.createdAt !== "string"
    || typeof cursor.id !== "string"
    || cursor.id.length === 0
  ) {
    throw new Error("Invalid transaction cursor");
  }

  const createdAt = new Date(cursor.createdAt);
  if (Number.isNaN(createdAt.getTime())) throw new Error("Invalid transaction cursor");

  return {
    leagueId: cursor.leagueId,
    seasonYear: cursor.seasonYear,
    day: cursor.day,
    createdAt,
    id: cursor.id,
  };
}

/**
 * Lists one page of roster moves recorded during the league's current season.
 *
 * General news such as game results, injuries, and season announcements is
 * intentionally excluded so callers can render a dedicated transaction log.
 * The composite cursor follows the same descending order as the query, keeping
 * pagination stable when multiple moves share a day or timestamp.
 */
export async function listSeasonTransactions(
  userId: string,
  leagueId: string,
  options: ListSeasonTransactionsOptions = {},
): Promise<SeasonTransactionPage> {
  const limit = normalizeLimit(options.limit);
  const cursor = parseCursor(options.cursor);
  const league = await prisma.league.findFirst({
    where: { id: leagueId, ownerUserId: userId },
    select: { seasonYear: true },
  });
  if (!league) throw new Error("League not found");
  if (cursor && (cursor.leagueId !== leagueId || cursor.seasonYear !== league.seasonYear)) {
    throw new Error("Transaction cursor does not match the requested league and season");
  }

  const rows = await prisma.newsItem.findMany({
    where: {
      leagueId,
      seasonYear: league.seasonYear,
      kind: { in: TRANSACTION_KINDS },
      ...(cursor
        ? {
            OR: [
              { day: { lt: cursor.day } },
              {
                day: cursor.day,
                createdAt: { lt: cursor.createdAt },
              },
              {
                day: cursor.day,
                createdAt: cursor.createdAt,
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ day: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
  const lastRow = pageRows.at(-1);

  return {
    transactions: pageRows.map(toNews),
    nextCursor: hasNextPage && lastRow
      ? {
          leagueId,
          seasonYear: league.seasonYear,
          day: lastRow.day,
          createdAt: lastRow.createdAt.toISOString(),
          id: lastRow.id,
        }
      : null,
  };
}
