import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma.js";
import { listSeasonTransactions } from "./transactionLog.js";

describe("season transaction log", () => {
  const ownerIds: string[] = [];
  let ownerId: string;
  let otherOwnerId: string;
  let leagueId: string;

  beforeAll(async () => {
    await prisma.$connect();

    const suffix = `${Date.now()}-${Math.random()}`;
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

    const [league, otherLeague] = await Promise.all([
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
    ]);
    leagueId = league.id;

    const kinds = ["trade", "signing", "draft", "transaction"] as const;
    await prisma.newsItem.createMany({
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
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ownerIds } } });
    await prisma.$disconnect();
  });

  it("returns every current-season roster move without the news-feed cap", async () => {
    const transactions = await listSeasonTransactions(ownerId, leagueId);

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

  it("rejects reads from users who do not own the league", async () => {
    await expect(listSeasonTransactions(otherOwnerId, leagueId)).rejects.toThrow("League not found");
  });
});
