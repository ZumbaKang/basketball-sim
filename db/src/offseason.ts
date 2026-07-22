import { prisma } from "./prisma.js";
import { ratingsFromOverall, makeRoster } from "./seedData.js";
import { generateSchedule } from "./schedule.js";
import { generateDraftClass, runAiDraft } from "./draft.js";

export async function runOffseason(leagueId: string) {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const seasonYear = league.seasonYear;

  // Develop / age players
  const players = await prisma.player.findMany({
    where: { OR: [{ team: { leagueId } }, { leagueId }] },
  });
  for (const p of players) {
    const age = p.age + 1;
    let overall = p.overall;
    if (age <= 25) overall = Math.min(p.potential, overall + (p.potential > overall ? 2 : 1));
    else if (age >= 32) overall = Math.max(50, overall - 2);
    else if (age >= 29) overall = Math.max(50, overall - 1);
    const r = ratingsFromOverall(overall);
    await prisma.player.update({
      where: { id: p.id },
      data: { age, ...r },
    });
  }

  // Expire contracts → FA
  const expiring = await prisma.contract.findMany({
    where: { yearsRemaining: 1, team: { leagueId } },
    include: { player: true },
  });
  for (const c of expiring) {
    await prisma.player.update({
      where: { id: c.playerId },
      data: { teamId: null, leagueId },
    });
    await prisma.contract.delete({ where: { id: c.id } });
  }
  await prisma.contract.updateMany({
    where: { yearsRemaining: { gt: 1 }, team: { leagueId } },
    data: { yearsRemaining: { decrement: 1 } },
  });

  await generateDraftClass(leagueId, seasonYear + 1);
  await runAiDraft(leagueId, seasonYear + 1, league.userTeamId);

  // Reset records, bump season, new schedule
  const teams = await prisma.team.findMany({ where: { leagueId } });
  await prisma.team.updateMany({ where: { leagueId }, data: { wins: 0, losses: 0 } });
  await prisma.scheduledGame.deleteMany({ where: { leagueId, seasonYear: { lte: seasonYear } } });

  const nextYear = seasonYear + 1;
  await prisma.league.update({
    where: { id: leagueId },
    data: { seasonYear: nextYear, phase: "regular", day: 1 },
  });

  for (const t of teams) {
    await prisma.teamSeasonStat.create({
      data: { teamId: t.id, seasonYear: nextYear },
    });
  }

  await generateSchedule(
    leagueId,
    nextYear,
    teams.map((t) => t.id),
  );

  // Ensure each team has draft picks for following year
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i]!;
    for (const round of [1, 2]) {
      await prisma.draftPick.create({
        data: {
          leagueId,
          seasonYear: nextYear + 1,
          round,
          pick: i + 1 + (round - 1) * teams.length,
          originalTeamId: team.id,
          ownerTeamId: team.id,
        },
      });
    }
  }

  await prisma.newsItem.create({
    data: {
      leagueId,
      seasonYear: nextYear,
      day: 1,
      kind: "season",
      headline: `${nextYear} season tips off`,
      body: "Rosters reshaped. Fresh schedule posted.",
    },
  });
}

// silence unused import in case draft helpers use makeRoster later
void makeRoster;
