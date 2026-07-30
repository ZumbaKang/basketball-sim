import type { GameResult, Player, Team } from "@basketball-sim/shared";
import { MIN_AVAILABLE_PLAYERS, simulateGame } from "@basketball-sim/sim";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { toPlayer, toTeam } from "./mappers.js";

/** Optional hooks for tests — throw from afterGameCreate to force a mid-write rollback. */
export type PersistResultOptions = {
  afterGameCreate?: (tx: Prisma.TransactionClient) => void | Promise<void>;
};

function availablePlayers(players: Player[]): Player[] {
  return players
    .filter((p) => p.injuredDays <= 0)
    .sort((a, b) => a.rotationOrder - b.rotationOrder || b.ratings.overall - a.ratings.overall);
}

function assertHealthyRosters(homeTeam: Team, homePlayers: Player[], awayTeam: Team, awayPlayers: Player[]): void {
  const shortages: string[] = [];
  if (homePlayers.length < MIN_AVAILABLE_PLAYERS) {
    shortages.push(
      `home team ${homeTeam.name} has ${homePlayers.length} healthy player${
        homePlayers.length === 1 ? "" : "s"
      } (need at least ${MIN_AVAILABLE_PLAYERS})`,
    );
  }
  if (awayPlayers.length < MIN_AVAILABLE_PLAYERS) {
    shortages.push(
      `away team ${awayTeam.name} has ${awayPlayers.length} healthy player${
        awayPlayers.length === 1 ? "" : "s"
      } (need at least ${MIN_AVAILABLE_PLAYERS})`,
    );
  }
  if (shortages.length > 0) {
    throw new Error(`Cannot simulate scheduled game: ${shortages.join("; ")}.`);
  }
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
  // Fail closed before simulate/persist — never substitute injured players to fill a short roster.
  assertHealthyRosters(homeTeam, homePlayers, awayTeam, awayPlayers);

  const result = simulateGame({
    leagueId: sg.leagueId,
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
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

/**
 * Persist a simulated box score and mark the scheduled row final.
 * All writes run in one transaction so a mid-write failure cannot leave a
 * `Game` row without matching `final` status / game news.
 */
export async function persistResult(
  leagueId: string,
  seasonYear: number,
  result: GameResult,
  scheduledGameId: string,
  isPlayoff: boolean,
  homeTeam: Team,
  awayTeam: Team,
  options?: PersistResultOptions,
) {
  const homeWon = result.home.pts > result.away.pts;

  await prisma.$transaction(async (tx) => {
    const saved = await tx.game.create({
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

    if (options?.afterGameCreate) {
      await options.afterGameCreate(tx);
    }

    await tx.scheduledGame.update({
      where: { id: scheduledGameId },
      data: {
        status: "final",
        homeScore: result.home.pts,
        awayScore: result.away.pts,
        gameResultId: saved.id,
      },
    });

    await tx.team.update({
      where: { id: homeTeam.id },
      data: homeWon ? { wins: { increment: 1 } } : { losses: { increment: 1 } },
    });
    await tx.team.update({
      where: { id: awayTeam.id },
      data: homeWon ? { losses: { increment: 1 } } : { wins: { increment: 1 } },
    });

    await upsertTeamSeason(tx, homeTeam.id, seasonYear, homeWon, result.home.pts, result.away.pts);
    await upsertTeamSeason(tx, awayTeam.id, seasonYear, !homeWon, result.away.pts, result.home.pts);

    for (const line of [...result.home.players, ...result.away.players]) {
      await tx.playerSeasonStat.upsert({
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

    const leagueDay = (await tx.league.findUniqueOrThrow({ where: { id: leagueId } })).day;

    // Light injury rolls
    for (const line of [...result.home.players, ...result.away.players]) {
      if (line.minutes > 28 && Math.random() < 0.02) {
        const days = 1 + Math.floor(Math.random() * 7);
        await tx.player.update({
          where: { id: line.playerId },
          data: { injuredDays: days },
        });
        await tx.newsItem.create({
          data: {
            leagueId,
            seasonYear,
            day: leagueDay,
            kind: "injury",
            headline: `${line.playerName} sidelined`,
            body: `Expected out ${days} day(s).`,
          },
        });
      }
    }

    await tx.newsItem.create({
      data: {
        leagueId,
        seasonYear,
        day: leagueDay,
        kind: "game",
        headline: `${result.home.teamName} ${result.home.pts}, ${result.away.teamName} ${result.away.pts}`,
        body: isPlayoff ? "Playoff matchup" : "Regular season",
      },
    });
  });
}

async function upsertTeamSeason(
  tx: Prisma.TransactionClient,
  teamId: string,
  seasonYear: number,
  won: boolean,
  ptsFor: number,
  ptsAgainst: number,
) {
  await tx.teamSeasonStat.upsert({
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
