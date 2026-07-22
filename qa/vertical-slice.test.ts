import { afterAll, describe, expect, it } from "vitest";
import {
  advanceLeague,
  assignFranchise,
  ensureLeagueForUser,
  getFranchiseHome,
  prisma,
  proposeTrade,
  registerUser,
} from "@basketball-sim/db";
import { assertRealisticGameResult } from "@basketball-sim/sim";

describe("franchise vertical slice", () => {
  const email = `qa-franchise-${Date.now()}@example.com`;

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("pick franchise, sim days, trade, and keep realism", async () => {
    const { user } = await registerUser({
      email,
      password: "password123",
      displayName: "QA",
    });
    const snapshot = await ensureLeagueForUser(user.id);
    expect(snapshot.teams).toHaveLength(30);
    await assignFranchise(user.id, snapshot.teams[0]!.id);

    const home = await getFranchiseHome(user.id);
    expect(home.roster.length).toBeGreaterThan(10);

    const advanced = await advanceLeague(user.id, {
      leagueId: snapshot.league.id,
      mode: "days",
      days: 3,
      autoSimUserGames: true,
    });
    expect(advanced.gamesPlayed.length).toBeGreaterThan(0);
    for (const g of advanced.gamesPlayed.slice(0, 3)) {
      expect(() => assertRealisticGameResult(g)).not.toThrow();
    }

    const myPlayer = home.roster.sort((a, b) => a.ratings.overall - b.ratings.overall)[0]!;
    const otherTeam = snapshot.teams.find((t) => t.id !== snapshot.teams[0]!.id)!;
    const their = snapshot.players
      .filter((p) => p.teamId === otherTeam.id)
      .sort((a, b) => a.ratings.overall - b.ratings.overall)[0]!;

    const decision = await proposeTrade(user.id, {
      leagueId: snapshot.league.id,
      fromTeamId: snapshot.teams[0]!.id,
      toTeamId: otherTeam.id,
      fromAssets: [{ playerId: myPlayer.id }],
      toAssets: [{ playerId: their.id }],
    });
    expect(typeof decision.accepted).toBe("boolean");
    expect(decision.reason.length).toBeGreaterThan(5);
  }, 180_000);
});
