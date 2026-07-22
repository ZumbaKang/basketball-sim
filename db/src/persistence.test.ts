import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assignFranchise,
  ensureLeagueForUser,
  getFranchiseHome,
  getUserFromSession,
  playGame,
  prisma,
  registerUser,
} from "../src/index.js";

describe("franchise persistence", () => {
  const email = `franchise-${Date.now()}@example.com`;
  const password = "password123";

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds 30 teams, assigns franchise, and plays a game", async () => {
    const { user, sessionToken } = await registerUser({
      email,
      password,
      displayName: "Owner",
    });
    expect(await getUserFromSession(sessionToken)).not.toBeNull();

    const snapshot = await ensureLeagueForUser(user.id);
    expect(snapshot.teams).toHaveLength(30);
    expect(snapshot.players.length).toBeGreaterThanOrEqual(400);

    const teamId = snapshot.teams[0]!.id;
    const assigned = await assignFranchise(user.id, teamId);
    expect(assigned.userTeamId).toBe(teamId);

    const home = await getFranchiseHome(user.id);
    expect(home.roster.length).toBeGreaterThan(10);
    expect(home.standings).toHaveLength(30);

    const away = snapshot.teams[1]!.id;
    const result = await playGame(user.id, {
      leagueId: snapshot.league.id,
      homeTeamId: teamId,
      awayTeamId: away,
    });
    expect(result.home.pts).toBeGreaterThan(80);
  }, 120_000);
});
