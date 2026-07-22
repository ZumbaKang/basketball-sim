import { prisma } from "./prisma.js";

/** Generate a balanced-ish home/away schedule (~82 games/team) across season days. */
export async function generateSchedule(leagueId: string, seasonYear: number, teamIds: string[]) {
  const n = teamIds.length;
  if (n < 2) return;

  // Circle method double round-robin, then pad/trim toward ~82 games.
  const rounds: { home: string; away: string }[][] = [];
  const teams = [...teamIds];
  if (teams.length % 2 === 1) teams.push("BYE");

  const m = teams.length;
  const half = m / 2;
  const arr = teams.slice(1);

  for (let round = 0; round < m - 1; round++) {
    const pairings: { home: string; away: string }[] = [];
    const left = [teams[0]!, ...arr.slice(0, half - 1)];
    const right = arr.slice(half - 1).reverse();
    for (let i = 0; i < half; i++) {
      const a = left[i]!;
      const b = right[i]!;
      if (a === "BYE" || b === "BYE") continue;
      if ((round + i) % 2 === 0) pairings.push({ home: a, away: b });
      else pairings.push({ home: b, away: a });
    }
    rounds.push(pairings);
    arr.unshift(arr.pop()!);
  }

  // Second half: reverse home/away
  const allRounds = [
    ...rounds,
    ...rounds.map((r) => r.map((g) => ({ home: g.away, away: g.home }))),
  ];

  // Stretch across ~170 calendar days (NBA-ish), packing multiple games/day.
  const seasonDays = 170;
  const games: {
    leagueId: string;
    seasonYear: number;
    day: number;
    homeTeamId: string;
    awayTeamId: string;
    status: string;
  }[] = [];

  let day = 1;
  for (const round of allRounds) {
    for (const g of round) {
      games.push({
        leagueId,
        seasonYear,
        day,
        homeTeamId: g.home,
        awayTeamId: g.away,
        status: "scheduled",
      });
    }
    day += Math.max(1, Math.floor(seasonDays / allRounds.length));
    if (day > seasonDays) day = seasonDays;
  }

  // Extra inter-conference noise to approach ~82 GPS: repeat shuffled subset
  const targetPerTeam = 82;
  const counts = new Map(teamIds.map((id) => [id, 0]));
  for (const g of games) {
    counts.set(g.homeTeamId, (counts.get(g.homeTeamId) ?? 0) + 1);
    counts.set(g.awayTeamId, (counts.get(g.awayTeamId) ?? 0) + 1);
  }

  let extraDay = 2;
  while ([...counts.values()].some((c) => c < targetPerTeam)) {
    for (let i = 0; i < teamIds.length; i += 2) {
      const a = teamIds[i]!;
      const b = teamIds[(i + 1 + Math.floor(extraDay / 3)) % teamIds.length]!;
      if (a === b) continue;
      if ((counts.get(a) ?? 0) >= targetPerTeam && (counts.get(b) ?? 0) >= targetPerTeam) continue;
      const home = extraDay % 2 === 0 ? a : b;
      const away = home === a ? b : a;
      games.push({
        leagueId,
        seasonYear,
        day: Math.min(seasonDays, extraDay),
        homeTeamId: home,
        awayTeamId: away,
        status: "scheduled",
      });
      counts.set(home, (counts.get(home) ?? 0) + 1);
      counts.set(away, (counts.get(away) ?? 0) + 1);
    }
    extraDay += 1;
    if (extraDay > seasonDays * 2) break;
  }

  await prisma.scheduledGame.createMany({ data: games });
}
