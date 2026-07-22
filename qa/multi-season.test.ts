import { afterAll, describe, expect, it } from "vitest";
import {
  advanceLeague,
  assignFranchise,
  ensureLeagueForUser,
  prisma,
  registerUser,
} from "@basketball-sim/db";

/**
 * Soak: advance many days across a season. Full 2-season playoff path is heavy;
 * this asserts calendar + standings stay coherent under load.
 */
describe("multi-season soak", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("survives a long regular-season advance", async () => {
    const { user } = await registerUser({
      email: `soak-${Date.now()}@example.com`,
      password: "password123",
      displayName: "Soak",
    });
    const snapshot = await ensureLeagueForUser(user.id);
    await assignFranchise(user.id, snapshot.teams[5]!.id);

    const result = await advanceLeague(user.id, {
      leagueId: snapshot.league.id,
      mode: "days",
      days: 40,
      autoSimUserGames: true,
    });

    expect(result.league.day).toBeGreaterThan(1);
    expect(result.standings).toHaveLength(30);
    const played = result.standings.reduce((s, r) => s + r.wins + r.losses, 0);
    expect(played).toBeGreaterThan(100);
  }, 300_000);
});
