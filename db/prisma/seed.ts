import { registerUser, ensureLeagueForUser, playGame, prisma } from "./src/index.js";

async function main() {
  const email = `seed-${Date.now()}@example.com`;
  const { user } = await registerUser({
    email,
    password: "password123",
    displayName: "Seed Commissioner",
  });
  const snapshot = await ensureLeagueForUser(user.id);
  console.log(`Seeded league ${snapshot.league.name} with ${snapshot.teams.length} teams for ${user.email}`);
  if (snapshot.teams.length >= 2) {
    const game = await playGame(user.id, {
      leagueId: snapshot.league.id,
      homeTeamId: snapshot.teams[0]!.id,
      awayTeamId: snapshot.teams[1]!.id,
    });
    console.log(`Sample game ${game.home.teamName} ${game.home.pts} - ${game.away.pts} ${game.away.teamName}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
