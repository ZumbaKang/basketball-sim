import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ensureLeagueForUser,
  getUserFromSession,
  loginUser,
  logoutSession,
  playGame,
  prisma,
  registerUser,
} from "../src/index.js";

const email = `test-${Date.now()}@example.com`;
const password = "password123";

describe("persistence auth + league", () => {
  beforeAll(async () => {
    // Ensure schema is applied; migrate should have run in setup
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("registers, sessions round-trip, and seeds a league", async () => {
    const { user, sessionToken } = await registerUser({
      email,
      password,
      displayName: "Test Owner",
    });

    const fromSession = await getUserFromSession(sessionToken);
    expect(fromSession?.id).toBe(user.id);
    expect(fromSession?.email).toBe(email);

    const snapshot = await ensureLeagueForUser(user.id);
    expect(snapshot.teams.length).toBe(4);
    expect(snapshot.players.length).toBe(40);

    const again = await ensureLeagueForUser(user.id);
    expect(again.league.id).toBe(snapshot.league.id);

    await logoutSession(sessionToken);
    expect(await getUserFromSession(sessionToken)).toBeNull();

    const relogin = await loginUser({ email, password });
    expect(relogin.user.id).toBe(user.id);
  });

  it("plays and persists a game result", async () => {
    const { user } = await loginUser({ email, password });
    const snapshot = await ensureLeagueForUser(user.id);
    const home = snapshot.teams[0]!;
    const away = snapshot.teams[1]!;

    const result = await playGame(user.id, {
      leagueId: snapshot.league.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
    });

    expect(result.home.pts + result.away.pts).toBeGreaterThan(150);
    expect(result.home.players.length).toBeGreaterThan(5);

    const stored = await prisma.game.findUnique({ where: { id: result.id } });
    expect(stored).not.toBeNull();
  });
});
