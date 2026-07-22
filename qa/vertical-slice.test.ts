import { afterAll, describe, expect, it } from "vitest";
import {
  ensureLeagueForUser,
  getGame,
  getUserFromSession,
  listGamesForLeague,
  loginUser,
  playGame,
  prisma,
  registerUser,
} from "@basketball-sim/db";
import { assertRealisticGameResult } from "@basketball-sim/sim";

describe("vertical slice integration", () => {
  const email = `qa-slice-${Date.now()}@example.com`;
  const password = "password123";

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("auth → league → play → persisted realistic box score", async () => {
    const registered = await registerUser({
      email,
      password,
      displayName: "QA Slice",
    });
    expect(registered.user.email).toBe(email);

    const sessionUser = await getUserFromSession(registered.sessionToken);
    expect(sessionUser?.id).toBe(registered.user.id);

    const snapshot = await ensureLeagueForUser(registered.user.id);
    expect(snapshot.teams).toHaveLength(4);
    expect(snapshot.players.length).toBeGreaterThanOrEqual(40);

    const home = snapshot.teams[0]!;
    const away = snapshot.teams[1]!;
    const played = await playGame(registered.user.id, {
      leagueId: snapshot.league.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
    });

    expect(() => assertRealisticGameResult(played)).not.toThrow();
    expect(played.home.pts).toBeGreaterThan(80);
    expect(played.away.pts).toBeGreaterThan(80);

    const stored = await getGame(played.id, registered.user.id);
    expect(stored.id).toBe(played.id);
    expect(stored.home.pts).toBe(played.home.pts);

    const games = await listGamesForLeague(snapshot.league.id, registered.user.id);
    expect(games.some((g) => g.id === played.id)).toBe(true);

    const relogin = await loginUser({ email, password });
    const again = await ensureLeagueForUser(relogin.user.id);
    expect(again.league.id).toBe(snapshot.league.id);
  });
});
