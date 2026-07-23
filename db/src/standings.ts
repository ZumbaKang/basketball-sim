import type { StandingsRow, Conference } from "@basketball-sim/shared";
import { prisma } from "./prisma.js";
import { toTeam } from "./mappers.js";

export async function getStandings(leagueId: string): Promise<StandingsRow[]> {
  const teams = await prisma.team.findMany({
    where: { leagueId },
    select: {
      id: true,
      name: true,
      abbreviation: true,
      conference: true,
      division: true,
      wins: true,
      losses: true,
    },
  });
  const { seasonYear } = await prisma.league.findUniqueOrThrow({
    where: { id: leagueId },
    select: { seasonYear: true },
  });
  const finals = await prisma.scheduledGame.findMany({
    where: { leagueId, seasonYear, status: "final", isPlayoff: false },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
    },
  });

  const confRecords = new Map<string, { w: number; l: number }>();
  const pointDiff = new Map<string, number>();
  for (const t of teams) {
    confRecords.set(t.id, { w: 0, l: 0 });
    pointDiff.set(t.id, 0);
  }

  const teamById = new Map(teams.map((t) => [t.id, t]));
  for (const g of finals) {
    const home = teamById.get(g.homeTeamId)!;
    const away = teamById.get(g.awayTeamId)!;
    const hs = g.homeScore ?? 0;
    const as = g.awayScore ?? 0;
    pointDiff.set(home.id, (pointDiff.get(home.id) ?? 0) + (hs - as));
    pointDiff.set(away.id, (pointDiff.get(away.id) ?? 0) + (as - hs));
    if (home.conference === away.conference) {
      if (hs > as) {
        confRecords.get(home.id)!.w++;
        confRecords.get(away.id)!.l++;
      } else {
        confRecords.get(away.id)!.w++;
        confRecords.get(home.id)!.l++;
      }
    }
  }

  const rows: StandingsRow[] = teams.map((t) => {
    const games = t.wins + t.losses;
    const conf = confRecords.get(t.id)!;
    return {
      teamId: t.id,
      teamName: t.name,
      abbreviation: t.abbreviation,
      conference: t.conference as Conference,
      division: t.division,
      wins: t.wins,
      losses: t.losses,
      winPct: games ? t.wins / games : 0,
      confWins: conf.w,
      confLosses: conf.l,
      pointDiff: pointDiff.get(t.id) ?? 0,
      rank: 0,
    };
  });

  const rankConference = (conf: Conference) => {
    const subset = rows
      .filter((r) => r.conference === conf)
      .sort((a, b) => {
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        const ac = a.confWins / Math.max(1, a.confWins + a.confLosses);
        const bc = b.confWins / Math.max(1, b.confWins + b.confLosses);
        if (bc !== ac) return bc - ac;
        return b.pointDiff - a.pointDiff;
      });
    subset.forEach((r, i) => {
      r.rank = i + 1;
    });
  };
  rankConference("East");
  rankConference("West");
  return rows.sort((a, b) => a.conference.localeCompare(b.conference) || a.rank - b.rank);
}

export { toTeam };
