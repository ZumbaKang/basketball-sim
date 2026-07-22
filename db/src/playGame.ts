import type { GameResult, Player, Team } from "@basketball-sim/shared";
import { simulateGame } from "@basketball-sim/sim";
import { prisma } from "./prisma.js";
import { toPlayer, toTeam } from "./mappers.js";

function availablePlayers(players: Player[]): Player[] {
  return players
    .filter((p) => p.injuredDays <= 0)
    .sort((a, b) => a.rotationOrder - b.rotationOrder || b.ratings.overall - a.ratings.overall);
}

export async function simulateScheduledGame(scheduledGameId: string): Promise<GameResult> {
  const sg = await prisma.scheduledGame.findUniqueOrThrow({
    where: { id: scheduledGameId },
    include: {
      league: true,
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
    },
  });
  if (sg.status === "final") {
    if (!sg.gameResultId) throw new Error("Final game missing result");
    const existing = await prisma.game.findUniqueOrThrow({ where: { id: sg.gameResultId } });
    return JSON.parse(existing.resultJson) as GameResult;
  }

  const homeTeam = toTeam(sg.homeTeam);
  const awayTeam = toTeam(sg.awayTeam);
  const homePlayers = availablePlayers(sg.homeTeam.players.map(toPlayer));
  const awayPlayers = availablePlayers(sg.awayTeam.players.map(toPlayer));

  const result = simulateGame({
    leagueId: sg.leagueId,
    homeTeam,
    awayTeam,
    homePlayers: homePlayers.length ? homePlayers : sg.homeTeam.players.map(toPlayer),
    awayPlayers: awayPlayers.length ? awayPlayers : sg.awayTeam.players.map(toPlayer),
    seed: hashSeed(sg.id),
  });
  result.scheduledGameId = sg.id;
  result.isPlayoff = sg.isPlayoff;

  await persistResult(sg.leagueId, sg.seasonYear, result, sg.id, sg.isPlayoff, homeTeam, awayTeam);
  return result;
}

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

async function persistResult(
  leagueId: string,
  seasonYear: number,
  result: GameResult,
  scheduledGameId: string,
  isPlayoff: boolean,
  homeTeam: Team,
  awayTeam: Team,
) {
  const homeWon = result.home.pts > result.away.pts;

  const saved = await prisma.game.create({
    data: {
      id: result.id,
      leagueId,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      playedAt: new Date(result.playedAt),
      resultJson: JSON.stringify(result),
      isPlayoff,
      scheduledGameId,
    },
  });

  await prisma.scheduledGame.update({
    where: { id: scheduledGameId },
    data: {
      status: "final",
      homeScore: result.home.pts,
      awayScore: result.away.pts,
      gameResultId: saved.id,
    },
  });

  await prisma.team.update({
    where: { id: homeTeam.id },
    data: homeWon ? { wins: { increment: 1 } } : { losses: { increment: 1 } },
  });
  await prisma.team.update({
    where: { id: awayTeam.id },
    data: homeWon ? { losses: { increment: 1 } } : { wins: { increment: 1 } },
  });

  await upsertTeamSeason(homeTeam.id, seasonYear, homeWon, result.home.pts, result.away.pts);
  await upsertTeamSeason(awayTeam.id, seasonYear, !homeWon, result.away.pts, result.home.pts);

  for (const line of [...result.home.players, ...result.away.players]) {
    await prisma.playerSeasonStat.upsert({
      where: { playerId_seasonYear: { playerId: line.playerId, seasonYear } },
      create: {
        playerId: line.playerId,
        teamId: line.teamId,
        seasonYear,
        games: 1,
        minutes: line.minutes,
        pts: line.pts,
        reb: line.reb,
        ast: line.ast,
        stl: line.stl,
        blk: line.blk,
        tov: line.tov,
        fgm: line.fgm,
        fga: line.fga,
        tpm: line.tpm,
        tpa: line.tpa,
        ftm: line.ftm,
        fta: line.fta,
      },
      update: {
        games: { increment: 1 },
        minutes: { increment: line.minutes },
        pts: { increment: line.pts },
        reb: { increment: line.reb },
        ast: { increment: line.ast },
        stl: { increment: line.stl },
        blk: { increment: line.blk },
        tov: { increment: line.tov },
        fgm: { increment: line.fgm },
        fga: { increment: line.fga },
        tpm: { increment: line.tpm },
        tpa: { increment: line.tpa },
        ftm: { increment: line.ftm },
        fta: { increment: line.fta },
      },
    });
  }

  // Light injury rolls
  for (const line of [...result.home.players, ...result.away.players]) {
    if (line.minutes > 28 && Math.random() < 0.02) {
      const days = 1 + Math.floor(Math.random() * 7);
      await prisma.player.update({
        where: { id: line.playerId },
        data: { injuredDays: days },
      });
      await prisma.newsItem.create({
        data: {
          leagueId,
          seasonYear,
          day: (await prisma.league.findUniqueOrThrow({ where: { id: leagueId } })).day,
          kind: "injury",
          headline: `${line.playerName} sidelined`,
          body: `Expected out ${days} day(s).`,
        },
      });
    }
  }

  await prisma.newsItem.create({
    data: {
      leagueId,
      seasonYear,
      day: (await prisma.league.findUniqueOrThrow({ where: { id: leagueId } })).day,
      kind: "game",
      headline: `${result.home.teamName} ${result.home.pts}, ${result.away.teamName} ${result.away.pts}`,
      body: isPlayoff ? "Playoff matchup" : "Regular season",
    },
  });
}

async function upsertTeamSeason(
  teamId: string,
  seasonYear: number,
  won: boolean,
  ptsFor: number,
  ptsAgainst: number,
) {
  await prisma.teamSeasonStat.upsert({
    where: { teamId_seasonYear: { teamId, seasonYear } },
    create: {
      teamId,
      seasonYear,
      wins: won ? 1 : 0,
      losses: won ? 0 : 1,
      ptsFor,
      ptsAgainst,
    },
    update: {
      wins: won ? { increment: 1 } : undefined,
      losses: won ? undefined : { increment: 1 },
      ptsFor: { increment: ptsFor },
      ptsAgainst: { increment: ptsAgainst },
    },
  });
}

/** Legacy ad-hoc play still supported for tests — creates an ephemeral scheduled game. */
export async function playGame(
  userId: string,
  request: { leagueId: string; homeTeamId: string; awayTeamId: string },
): Promise<GameResult> {
  const league = await prisma.league.findFirst({
    where: { id: request.leagueId, ownerUserId: userId },
  });
  if (!league) throw new Error("League not found");
  if (request.homeTeamId === request.awayTeamId) throw new Error("Home and away teams must differ");

  const sg = await prisma.scheduledGame.create({
    data: {
      leagueId: league.id,
      seasonYear: league.seasonYear,
      day: league.day,
      homeTeamId: request.homeTeamId,
      awayTeamId: request.awayTeamId,
      status: "scheduled",
    },
  });
  return simulateScheduledGame(sg.id);
}
