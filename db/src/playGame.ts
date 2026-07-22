import type { GameResult, PlayGameRequest } from "@basketball-sim/shared";
import { simulateGame } from "@basketball-sim/sim";
import { prisma } from "./prisma.js";
import { toPlayer, toTeam } from "./mappers.js";

export async function playGame(userId: string, request: PlayGameRequest): Promise<GameResult> {
  if (request.homeTeamId === request.awayTeamId) {
    throw new Error("Home and away teams must differ");
  }

  const league = await prisma.league.findFirst({
    where: { id: request.leagueId, ownerUserId: userId },
    include: {
      teams: {
        where: { id: { in: [request.homeTeamId, request.awayTeamId] } },
        include: { players: true },
      },
    },
  });

  if (!league) throw new Error("League not found");
  const homeRow = league.teams.find((t) => t.id === request.homeTeamId);
  const awayRow = league.teams.find((t) => t.id === request.awayTeamId);
  if (!homeRow || !awayRow) throw new Error("Both teams must belong to the league");

  const simulated = simulateGame({
    leagueId: league.id,
    homeTeam: toTeam(homeRow),
    awayTeam: toTeam(awayRow),
    homePlayers: homeRow.players.map(toPlayer),
    awayPlayers: awayRow.players.map(toPlayer),
  });

  const saved = await prisma.game.create({
    data: {
      id: simulated.id,
      leagueId: league.id,
      homeTeamId: homeRow.id,
      awayTeamId: awayRow.id,
      playedAt: new Date(simulated.playedAt),
      resultJson: JSON.stringify(simulated),
    },
  });

  return { ...simulated, id: saved.id };
}
