import { prisma } from "./prisma.js";

interface NextUserGameLookup {
  leagueId: string;
  seasonYear: number;
  teamId: string;
}

export function findNextUserRegularSeasonGame({
  leagueId,
  seasonYear,
  teamId,
}: NextUserGameLookup) {
  return prisma.scheduledGame.findFirst({
    where: {
      leagueId,
      seasonYear,
      status: "scheduled",
      isPlayoff: false,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: [{ day: "asc" }],
  });
}
