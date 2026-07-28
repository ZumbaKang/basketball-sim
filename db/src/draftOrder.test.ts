import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDraftOrderAndResolveConveyance } from "./draftOrder.js";
import { prisma } from "./prisma.js";
import { listSeasonTransactions } from "./transactionLog.js";

describe("offseason draft order and pick conveyance", () => {
  let userId: string;
  let leagueId: string;
  let protectedPickId: string;
  let conveyedPickId: string;
  let unprotectedPickId: string;
  let secondRoundPickId: string;
  let worstTeamId: string;
  let recipientTeamId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const suffix = `${Date.now()}-${Math.random()}`;
    const owner = await prisma.user.create({
      data: {
        email: `draft-order-${suffix}@example.com`,
        displayName: "Draft Order Owner",
        passwordHash: "unused",
      },
    });
    userId = owner.id;
    const league = await prisma.league.create({
      data: {
        name: "Draft Order League",
        seasonYear: 2099,
        ownerUserId: userId,
      },
    });
    leagueId = league.id;

    const teams = await Promise.all(
      [
        { name: "Worst", abbreviation: "WST", wins: 10, losses: 72 },
        { name: "Second", abbreviation: "SEC", wins: 20, losses: 62 },
        { name: "Third", abbreviation: "THD", wins: 30, losses: 52 },
        { name: "Best", abbreviation: "BST", wins: 40, losses: 42 },
      ].map((team, index) =>
        prisma.team.create({
          data: {
            leagueId,
            conference: index < 2 ? "East" : "West",
            division: "Test",
            ...team,
          },
        }),
      ),
    );
    const [worst, second, third, best] = teams;
    worstTeamId = worst!.id;
    recipientTeamId = best!.id;

    const [protectedPick, conveyedPick, unprotectedPick, secondRoundPick] =
      await Promise.all([
        prisma.draftPick.create({
          data: {
            leagueId,
            seasonYear: 2100,
            round: 1,
            pick: 99,
            originalTeamId: worst!.id,
            ownerTeamId: worst!.id,
            protectedThrough: 2,
            conveyanceTeamId: best!.id,
          },
        }),
        prisma.draftPick.create({
          data: {
            leagueId,
            seasonYear: 2100,
            round: 1,
            pick: 99,
            originalTeamId: third!.id,
            ownerTeamId: third!.id,
            protectedThrough: 2,
            conveyanceTeamId: best!.id,
          },
        }),
        prisma.draftPick.create({
          data: {
            leagueId,
            seasonYear: 2100,
            round: 1,
            pick: 99,
            originalTeamId: second!.id,
            ownerTeamId: best!.id,
          },
        }),
        prisma.draftPick.create({
          data: {
            leagueId,
            seasonYear: 2100,
            round: 2,
            pick: 99,
            originalTeamId: best!.id,
            ownerTeamId: best!.id,
          },
        }),
      ]);
    protectedPickId = protectedPick.id;
    conveyedPickId = conveyedPick.id;
    unprotectedPickId = unprotectedPick.id;
    secondRoundPickId = secondRoundPick.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it("retains a protected slot and conveys a slot outside the protected range", async () => {
    await createDraftOrderAndResolveConveyance(leagueId, 2100);

    const [protectedPick, conveyedPick, unprotectedPick, secondRoundPick] =
      await Promise.all([
        prisma.draftPick.findUniqueOrThrow({ where: { id: protectedPickId } }),
        prisma.draftPick.findUniqueOrThrow({ where: { id: conveyedPickId } }),
        prisma.draftPick.findUniqueOrThrow({ where: { id: unprotectedPickId } }),
        prisma.draftPick.findUniqueOrThrow({ where: { id: secondRoundPickId } }),
      ]);

    expect(protectedPick).toMatchObject({
      pick: 1,
      ownerTeamId: worstTeamId,
      protectedThrough: null,
      conveyanceTeamId: null,
    });
    expect(conveyedPick).toMatchObject({
      pick: 3,
      ownerTeamId: recipientTeamId,
      protectedThrough: null,
      conveyanceTeamId: null,
    });
    expect(unprotectedPick).toMatchObject({
      pick: 2,
      ownerTeamId: recipientTeamId,
    });
    expect(secondRoundPick.pick).toBe(8);
  });

  it("records the retained and conveyed outcomes once each as transaction news", async () => {
    const news = await prisma.newsItem.findMany({
      where: { leagueId, seasonYear: 2100, kind: "transaction" },
      orderBy: { headline: "asc" },
    });

    expect(news).toHaveLength(2);
    const [retained, conveyed] = news;
    expect(retained!.headline).toBe("2100 Round 1 Pick 1 stays with Worst");
    expect(retained!.body).toContain("No. 1 overall");
    expect(retained!.body).toContain("top-2 protection");
    expect(retained!.body).toContain("Best receives nothing");
    expect(conveyed!.headline).toBe("2100 Round 1 Pick 3 conveys to Best");
    expect(conveyed!.body).toContain("No. 3 overall");
    expect(conveyed!.body).toContain("Third sends it to Best");
    expect(news.every((item) => item.day === 1)).toBe(true);
  });

  it("leaves picks without protection terms out of the transaction log", async () => {
    const news = await prisma.newsItem.findMany({
      where: { leagueId, seasonYear: 2100, kind: "transaction" },
    });

    expect(news.some((item) => item.headline.includes("Pick 2"))).toBe(false);
    expect(news.some((item) => item.headline.includes("Round 2"))).toBe(false);
  });

  it("does not re-announce resolutions when draft order is rebuilt", async () => {
    await createDraftOrderAndResolveConveyance(leagueId, 2100);

    const news = await prisma.newsItem.findMany({
      where: { leagueId, seasonYear: 2100, kind: "transaction" },
    });
    expect(news).toHaveLength(2);
  });

  it("surfaces both resolutions exactly once in the season transaction log", async () => {
    await prisma.league.update({
      where: { id: leagueId },
      data: { seasonYear: 2100 },
    });

    const page = await listSeasonTransactions(userId, leagueId);

    const headlines = page.transactions.map((item) => item.headline).sort();
    expect(headlines).toEqual([
      "2100 Round 1 Pick 1 stays with Worst",
      "2100 Round 1 Pick 3 conveys to Best",
    ]);
    expect(page.nextCursor).toBeNull();
  });
});
