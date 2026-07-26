import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma.js";
import {
  listSeasonTransactions,
  type SeasonTransactionCursor,
} from "./transactionLog.js";

describe("season transaction log", () => {
  const ownerIds: string[] = [];
  let ownerId: string;
  let otherOwnerId: string;
  let leagueId: string;
  let cursorLeagueId: string;
  let staleSeasonLeagueId: string;
  const collisionTransactionIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();

    const suffix = `${Date.now()}-${Math.random()}`;
    collisionTransactionIds.push(
      ...Array.from(
        { length: 8 },
        (_, index) => `collision-${suffix}-${index.toString().padStart(2, "0")}`,
      ),
    );
    const [owner, otherOwner] = await Promise.all([
      prisma.user.create({
        data: {
          email: `transaction-log-${suffix}@example.com`,
          displayName: "Transaction Log Owner",
          passwordHash: "unused",
        },
      }),
      prisma.user.create({
        data: {
          email: `transaction-log-other-${suffix}@example.com`,
          displayName: "Other Owner",
          passwordHash: "unused",
        },
      }),
    ]);
    ownerId = owner.id;
    otherOwnerId = otherOwner.id;
    ownerIds.push(owner.id, otherOwner.id);

    const [league, otherLeague, cursorLeague, staleSeasonLeague] = await Promise.all([
      prisma.league.create({
        data: {
          name: "Transaction Log League",
          seasonYear: 2099,
          ownerUserId: owner.id,
        },
      }),
      prisma.league.create({
        data: {
          name: "Other Transaction Log League",
          seasonYear: 2099,
          ownerUserId: owner.id,
        },
      }),
      prisma.league.create({
        data: {
          name: "Cursor Transaction Log League",
          seasonYear: 2099,
          ownerUserId: owner.id,
        },
      }),
      prisma.league.create({
        data: {
          name: "Stale Season Cursor League",
          seasonYear: 2099,
          ownerUserId: owner.id,
        },
      }),
    ]);
    leagueId = league.id;
    cursorLeagueId = cursorLeague.id;
    staleSeasonLeagueId = staleSeasonLeague.id;

    const kinds = ["trade", "signing", "draft", "transaction"] as const;
    const collisionCreatedAt = new Date("2099-02-03T04:05:06.000Z");
    await Promise.all([
      prisma.newsItem.createMany({
        data: [
          ...Array.from({ length: 24 }, (_, index) => ({
            leagueId: league.id,
            seasonYear: league.seasonYear,
            day: index + 1,
            kind: kinds[index % kinds.length],
            headline: `Move ${index + 1}`,
            body: `Transaction ${index + 1}`,
          })),
          {
            leagueId: league.id,
            seasonYear: league.seasonYear,
            day: 25,
            kind: "game",
            headline: "Game result",
            body: "Not a roster move",
          },
          {
            leagueId: league.id,
            seasonYear: league.seasonYear - 1,
            day: 82,
            kind: "trade",
            headline: "Previous-season trade",
            body: "Not in the current season",
          },
          {
            leagueId: otherLeague.id,
            seasonYear: otherLeague.seasonYear,
            day: 30,
            kind: "signing",
            headline: "Other-league signing",
            body: "Not in the requested league",
          },
        ],
      }),
      prisma.newsItem.createMany({
        data: collisionTransactionIds.map((id, index) => ({
          id,
          leagueId: cursorLeague.id,
          seasonYear: cursorLeague.seasonYear,
          day: 17,
          kind: kinds[index % kinds.length],
          headline: `Same-boundary move ${index}`,
          body: `Same-boundary transaction ${index}`,
          createdAt: collisionCreatedAt,
        })),
      }),
      prisma.newsItem.createMany({
        data: [
          {
            leagueId: staleSeasonLeague.id,
            seasonYear: staleSeasonLeague.seasonYear,
            day: 2,
            kind: "trade",
            headline: "Newest stale-season move",
            body: "Creates the first page",
          },
          {
            leagueId: staleSeasonLeague.id,
            seasonYear: staleSeasonLeague.seasonYear,
            day: 1,
            kind: "signing",
            headline: "Older stale-season move",
            body: "Creates a next cursor",
          },
        ],
      }),
    ]);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ownerIds } } });
    await prisma.$disconnect();
  });

  it("returns every current-season roster move without the news-feed cap", async () => {
    const transactions = [];
    let cursor: SeasonTransactionCursor | undefined;

    do {
      const page = await listSeasonTransactions(ownerId, leagueId, {
        limit: 7,
        cursor,
      });
      transactions.push(...page.transactions);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(transactions).toHaveLength(24);
    expect(transactions.map(({ day }) => day)).toEqual(
      Array.from({ length: 24 }, (_, index) => 24 - index),
    );
    expect(new Set(transactions.map(({ kind }) => kind))).toEqual(
      new Set(["trade", "signing", "draft", "transaction"]),
    );
    expect(transactions.every(({ leagueId: id, seasonYear }) => id === leagueId && seasonYear === 2099))
      .toBe(true);
    expect(transactions[0]?.createdAt).toMatch(/Z$/);
  });

  it("does not duplicate or omit equal-day rows across cursor pages", async () => {
    const transactionIds: string[] = [];
    let cursor: SeasonTransactionCursor | undefined;

    do {
      const page = await listSeasonTransactions(ownerId, cursorLeagueId, {
        limit: 3,
        cursor,
      });
      transactionIds.push(...page.transactions.map(({ id }) => id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(transactionIds).toEqual([...collisionTransactionIds].sort().reverse());
    expect(new Set(transactionIds).size).toBe(collisionTransactionIds.length);
  });

  it("rejects a cursor issued for a different league", async () => {
    const sourcePage = await listSeasonTransactions(ownerId, cursorLeagueId, { limit: 3 });

    expect(sourcePage.nextCursor).toMatchObject({
      leagueId: cursorLeagueId,
      seasonYear: 2099,
    });
    await expect(
      listSeasonTransactions(ownerId, leagueId, { cursor: sourcePage.nextCursor! }),
    ).rejects.toThrow("Transaction cursor does not match the requested league and season");
  });

  it("rejects a cursor after its league advances to a new season", async () => {
    const oldSeasonPage = await listSeasonTransactions(ownerId, staleSeasonLeagueId, { limit: 1 });
    expect(oldSeasonPage.nextCursor).toMatchObject({
      leagueId: staleSeasonLeagueId,
      seasonYear: 2099,
    });

    await prisma.league.update({
      where: { id: staleSeasonLeagueId },
      data: { seasonYear: 2100 },
    });

    await expect(
      listSeasonTransactions(ownerId, staleSeasonLeagueId, {
        cursor: oldSeasonPage.nextCursor!,
      }),
    ).rejects.toThrow("Transaction cursor does not match the requested league and season");
  });

  it("uses the composite index for season transaction filters", async () => {
    const plan = await prisma.$queryRawUnsafe<Array<{ detail: string }>>(
      `EXPLAIN QUERY PLAN
       SELECT *
       FROM "NewsItem"
       WHERE "leagueId" = ?
         AND "seasonYear" = ?
         AND "kind" IN (?, ?, ?, ?)
       ORDER BY "day" DESC, "createdAt" DESC, "id" DESC`,
      leagueId,
      2099,
      "trade",
      "signing",
      "draft",
      "transaction",
    );

    expect(plan.map(({ detail }) => detail).join("\n")).toMatch(
      /USING INDEX NewsItem_leagueId_seasonYear_kind_idx/,
    );
  });

  it("rejects reads from users who do not own the league", async () => {
    await expect(listSeasonTransactions(otherOwnerId, leagueId)).rejects.toThrow("League not found");
  });
});
