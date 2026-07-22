import { NextResponse } from "next/server";
import { prisma, ensureLeagueForUser } from "@basketball-sim/db";
import { optionalUser } from "@/lib/auth";

export async function GET() {
  const user = await optionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const snapshot = await ensureLeagueForUser(user.id);
  const champions = await prisma.seasonChampion.findMany({
    where: { leagueId: snapshot.league.id },
    orderBy: { seasonYear: "desc" },
  });
  const awards = await prisma.award.findMany({
    where: { leagueId: snapshot.league.id },
    orderBy: [{ seasonYear: "desc" }, { kind: "asc" }],
    take: 50,
  });
  const leaders = await prisma.playerSeasonStat.findMany({
    where: { seasonYear: snapshot.league.seasonYear, games: { gte: 1 } },
    include: { player: true },
    orderBy: { pts: "desc" },
    take: 10,
  });
  return NextResponse.json({
    champions,
    awards,
    leaders: leaders.map((l) => ({
      playerName: l.player.name,
      teamId: l.teamId,
      ppg: l.pts / l.games,
      rpg: l.reb / l.games,
      apg: l.ast / l.games,
      games: l.games,
    })),
  });
}
