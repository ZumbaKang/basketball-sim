import { prisma } from "./prisma.js";

interface NextUserGameLookup {
  leagueId: string;
  seasonYear: number;
  teamId: string;
  currentDay: number;
}

export function findNextUserRegularSeasonGame({
  leagueId,
  seasonYear,
  teamId,
  currentDay,
}: NextUserGameLookup) {
  return prisma.scheduledGame.findFirst({
    where: {
      leagueId,
      seasonYear,
      day: { gte: currentDay },
      status: "scheduled",
      isPlayoff: false,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: [{ day: "asc" }],
  });
}
