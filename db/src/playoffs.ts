import type { GameResult } from "@basketball-sim/shared";
import { prisma } from "./prisma.js";
import { getStandings } from "./standings.js";
import { simulateScheduledGame } from "./playGame.js";
import { computeAwards } from "./awards.js";

export async function maybeStartPlayoffs(leagueId: string) {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const remaining = await prisma.scheduledGame.count({
    where: { leagueId, seasonYear: league.seasonYear, status: "scheduled", isPlayoff: false },
  });
  if (remaining > 0) return;

  const standings = await getStandings(leagueId);
  const east = standings.filter((s) => s.conference === "East").slice(0, 8);
  const west = standings.filter((s) => s.conference === "West").slice(0, 8);
  if (east.length < 8 || west.length < 8) {
    // Not enough teams — crown top overall
    const top = standings.sort((a, b) => b.winPct - a.winPct)[0]!;
    await crownChampion(leagueId, league.seasonYear, top.teamId, top.teamName);
    return;
  }

  const day = league.day + 1;
  await seedRound(leagueId, league.seasonYear, day, "E-R1", [
    [east[0]!, east[7]!],
    [east[3]!, east[4]!],
    [east[1]!, east[6]!],
    [east[2]!, east[5]!],
  ]);
  await seedRound(leagueId, league.seasonYear, day, "W-R1", [
    [west[0]!, west[7]!],
    [west[3]!, west[4]!],
    [west[1]!, west[6]!],
    [west[2]!, west[5]!],
  ]);

  await prisma.league.update({
    where: { id: leagueId },
    data: { phase: "playoffs", day },
  });
  await prisma.newsItem.create({
    data: {
      leagueId,
      seasonYear: league.seasonYear,
      day,
      kind: "season",
      headline: "Playoffs begin",
      body: "Eight teams per conference chase the Continental Cup.",
    },
  });
}

async function seedRound(
  leagueId: string,
  seasonYear: number,
  day: number,
  prefix: string,
  pairs: { teamId: string; teamName: string }[][],
) {
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]!;
    const a = pair[0]!;
    const b = pair[1]!;
    const seriesId = `${prefix}-${i + 1}`;
    // Schedule up to 7 games; we'll stop when series ends
    for (let g = 1; g <= 7; g++) {
      const homeFirst = g === 1 || g === 2 || g === 5 || g === 7;
      await prisma.scheduledGame.create({
        data: {
          leagueId,
          seasonYear,
          day: day + g - 1,
          homeTeamId: homeFirst ? a.teamId : b.teamId,
          awayTeamId: homeFirst ? b.teamId : a.teamId,
          status: g === 1 ? "scheduled" : "scheduled",
          isPlayoff: true,
          seriesId,
        },
      });
    }
  }
}

export async function advancePlayoffsIfNeeded(
  leagueId: string,
  autoSim: boolean,
): Promise<GameResult[]> {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const played: GameResult[] = [];

  // Play all scheduled playoff games for current day where series not decided
  const dayGames = await prisma.scheduledGame.findMany({
    where: {
      leagueId,
      seasonYear: league.seasonYear,
      day: league.day,
      status: "scheduled",
      isPlayoff: true,
    },
  });

  for (const g of dayGames) {
    if (!(await seriesStillActive(g.seriesId!))) {
      await prisma.scheduledGame.update({ where: { id: g.id }, data: { status: "final", homeScore: 0, awayScore: 0 } });
      continue;
    }
    if (!autoSim && league.userTeamId && (g.homeTeamId === league.userTeamId || g.awayTeamId === league.userTeamId)) {
      continue;
    }
    played.push(await simulateScheduledGame(g.id));
  }

  await prisma.league.update({ where: { id: leagueId }, data: { day: { increment: 1 } } });

  // Check for completed series and finals
  await promoteSeriesWinners(leagueId, league.seasonYear);

  const finalsLeft = await prisma.scheduledGame.count({
    where: { leagueId, seasonYear: league.seasonYear, isPlayoff: true, status: "scheduled" },
  });
  if (finalsLeft === 0) {
    // Determine champion from last finals series
    const last = await prisma.scheduledGame.findFirst({
      where: { leagueId, seasonYear: league.seasonYear, isPlayoff: true, status: "final", seriesId: { startsWith: "FINALS" } },
      orderBy: { day: "desc" },
    });
    if (last) {
      const winnerId =
        (last.homeScore ?? 0) > (last.awayScore ?? 0) ? last.homeTeamId : last.awayTeamId;
      const team = await prisma.team.findUniqueOrThrow({ where: { id: winnerId } });
      await crownChampion(leagueId, league.seasonYear, team.id, team.name);
    }
  }

  return played;
}

async function seriesStillActive(seriesId: string): Promise<boolean> {
  const games = await prisma.scheduledGame.findMany({
    where: { seriesId, status: "final", gameResultId: { not: null } },
  });
  const wins = new Map<string, number>();
  for (const g of games) {
    if (g.homeScore == null || g.awayScore == null) continue;
    if (g.homeScore === 0 && g.awayScore === 0 && !g.gameResultId) continue;
    const winner = g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId;
    wins.set(winner, (wins.get(winner) ?? 0) + 1);
  }
  return ![...wins.values()].some((w) => w >= 4);
}

async function promoteSeriesWinners(leagueId: string, seasonYear: number) {
  const seriesIds = await prisma.scheduledGame.findMany({
    where: { leagueId, seasonYear, isPlayoff: true },
    distinct: ["seriesId"],
    select: { seriesId: true },
  });

  const winners: { seriesId: string; teamId: string }[] = [];
  for (const { seriesId } of seriesIds) {
    if (!seriesId) continue;
    const games = await prisma.scheduledGame.findMany({
      where: { seriesId, status: "final", gameResultId: { not: null } },
    });
    const wins = new Map<string, number>();
    for (const g of games) {
      const winner = (g.homeScore ?? 0) > (g.awayScore ?? 0) ? g.homeTeamId : g.awayTeamId;
      wins.set(winner, (wins.get(winner) ?? 0) + 1);
    }
    const champ = [...wins.entries()].find(([, w]) => w >= 4);
    if (champ) winners.push({ seriesId, teamId: champ[0] });
  }

  const r1East = winners.filter((w) => w.seriesId.startsWith("E-R1")).sort((a, b) => a.seriesId.localeCompare(b.seriesId));
  const r1West = winners.filter((w) => w.seriesId.startsWith("W-R1")).sort((a, b) => a.seriesId.localeCompare(b.seriesId));

  const hasSemis = seriesIds.some((s) => s.seriesId?.startsWith("E-SF"));
  if (r1East.length === 4 && !hasSemis) {
    const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
    await seedRoundPairs(leagueId, seasonYear, league.day, "E-SF", [
      [r1East[0]!.teamId, r1East[1]!.teamId],
      [r1East[2]!.teamId, r1East[3]!.teamId],
    ]);
    await seedRoundPairs(leagueId, seasonYear, league.day, "W-SF", [
      [r1West[0]!.teamId, r1West[1]!.teamId],
      [r1West[2]!.teamId, r1West[3]!.teamId],
    ]);
  }

  const sfEast = winners.filter((w) => w.seriesId.startsWith("E-SF"));
  const sfWest = winners.filter((w) => w.seriesId.startsWith("W-SF"));
  const hasConf = seriesIds.some((s) => s.seriesId?.startsWith("E-CF"));
  if (sfEast.length === 2 && sfWest.length === 2 && !hasConf) {
    const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
    await seedRoundPairs(leagueId, seasonYear, league.day, "E-CF", [[sfEast[0]!.teamId, sfEast[1]!.teamId]]);
    await seedRoundPairs(leagueId, seasonYear, league.day, "W-CF", [[sfWest[0]!.teamId, sfWest[1]!.teamId]]);
  }

  const cfE = winners.find((w) => w.seriesId.startsWith("E-CF"));
  const cfW = winners.find((w) => w.seriesId.startsWith("W-CF"));
  const hasFinals = seriesIds.some((s) => s.seriesId?.startsWith("FINALS"));
  if (cfE && cfW && !hasFinals) {
    const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
    await seedRoundPairs(leagueId, seasonYear, league.day, "FINALS", [[cfE.teamId, cfW.teamId]]);
  }
}

async function seedRoundPairs(
  leagueId: string,
  seasonYear: number,
  day: number,
  prefix: string,
  pairs: [string, string][],
) {
  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i]!;
    const seriesId = `${prefix}-${i + 1}`;
    for (let g = 1; g <= 7; g++) {
      const homeFirst = g === 1 || g === 2 || g === 5 || g === 7;
      await prisma.scheduledGame.create({
        data: {
          leagueId,
          seasonYear,
          day: day + g - 1,
          homeTeamId: homeFirst ? a : b,
          awayTeamId: homeFirst ? b : a,
          status: "scheduled",
          isPlayoff: true,
          seriesId,
        },
      });
    }
  }
}

async function crownChampion(leagueId: string, seasonYear: number, teamId: string, teamName: string) {
  await prisma.seasonChampion.create({
    data: { leagueId, seasonYear, teamId, teamName },
  });
  await computeAwards(leagueId, seasonYear);
  await prisma.league.update({
    where: { id: leagueId },
    data: { phase: "offseason" },
  });
  await prisma.newsItem.create({
    data: {
      leagueId,
      seasonYear,
      day: (await prisma.league.findUniqueOrThrow({ where: { id: leagueId } })).day,
      kind: "season",
      headline: `${teamName} win the Continental Cup`,
      body: `Champions of ${seasonYear}.`,
    },
  });
}
