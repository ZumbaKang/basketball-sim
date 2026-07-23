import type { AdvanceRequest, AdvanceResult, GameResult } from "@basketball-sim/shared";
import { prisma } from "./prisma.js";
import { toLeague, toScheduleGame } from "./mappers.js";
import { simulateScheduledGame } from "./playGame.js";
import { getStandings } from "./standings.js";
import { maybeStartPlayoffs, advancePlayoffsIfNeeded } from "./playoffs.js";
import { runOffseason } from "./offseason.js";
import { findNextUserRegularSeasonGame } from "./nextGame.js";

export async function advanceLeague(userId: string, request: AdvanceRequest): Promise<AdvanceResult> {
  const league = await prisma.league.findFirst({
    where: { id: request.leagueId, ownerUserId: userId },
  });
  if (!league) throw new Error("League not found");
  if (!league.userTeamId) throw new Error("Pick a franchise before advancing the season");

  const gamesPlayed: GameResult[] = [];
  let phaseChanged = false;
  let message = "";

  if (league.phase === "offseason") {
    await runOffseason(league.id);
    phaseChanged = true;
    message = "Offseason complete — new season underway";
  } else if (league.phase === "playoffs") {
    const played = await advancePlayoffsIfNeeded(league.id, request.autoSimUserGames ?? true);
    gamesPlayed.push(...played);
    const refreshed = await prisma.league.findUniqueOrThrow({ where: { id: league.id } });
    phaseChanged = refreshed.phase !== "playoffs";
    message = phaseChanged ? "Champion crowned" : `Simulated ${played.length} playoff game(s)`;
  } else {
    const days =
      request.mode === "next"
        ? 1
        : request.mode === "days"
          ? Math.max(1, request.days ?? 1)
          : request.mode === "toUserGame"
            ? 9999
            : 9999;

    let safety = 0;
    while (safety++ < 5000) {
      const current = await prisma.league.findUniqueOrThrow({ where: { id: league.id } });
      if (current.phase !== "regular" && current.phase !== "preseason") break;

      const dayGames = await prisma.scheduledGame.findMany({
        where: {
          leagueId: league.id,
          seasonYear: current.seasonYear,
          day: current.day,
          status: "scheduled",
          isPlayoff: false,
        },
      });

      if (dayGames.length === 0) {
        const remaining = await prisma.scheduledGame.count({
          where: {
            leagueId: league.id,
            seasonYear: current.seasonYear,
            status: "scheduled",
            isPlayoff: false,
            day: { gt: current.day },
          },
        });
        if (remaining === 0) {
          await maybeStartPlayoffs(league.id);
          phaseChanged = true;
          message = "Regular season complete — playoffs begin";
          break;
        }
        await prisma.league.update({ where: { id: league.id }, data: { day: { increment: 1 } } });
        await tickInjuries(league.id);
        if (request.mode === "next") break;
        continue;
      }

      // Pause on user game unless auto
      const userGame = dayGames.find(
        (g) => g.homeTeamId === current.userTeamId || g.awayTeamId === current.userTeamId,
      );
      if (userGame && !request.autoSimUserGames && request.mode !== "season") {
        if (request.mode === "toUserGame" && gamesPlayed.length === 0) {
          // fall through to stop before playing
          message = "Your next game is ready";
          break;
        }
        if (request.mode === "toUserGame") {
          message = `Advanced to your next game (${gamesPlayed.length} simmed)`;
          break;
        }
      }

      for (const g of dayGames) {
        const isUser = g.homeTeamId === current.userTeamId || g.awayTeamId === current.userTeamId;
        if (isUser && !request.autoSimUserGames && request.mode !== "season" && request.mode !== "days") {
          if (request.mode === "next") {
            // play it when advancing next with default auto true; if false, stop
            message = "Your game is ready — tip it off or enable auto-sim";
            break;
          }
        }
        const result = await simulateScheduledGame(g.id);
        gamesPlayed.push(result);
      }

      await prisma.league.update({ where: { id: league.id }, data: { day: { increment: 1 } } });
      await tickInjuries(league.id);

      if (request.mode === "next") {
        message = `Simulated day — ${gamesPlayed.length} game(s)`;
        break;
      }
      if (request.mode === "days" && safety >= days) {
        message = `Advanced ${days} day(s)`;
        break;
      }
      if (request.mode === "toUserGame") {
        const nextUser = await findNextUserRegularSeasonGame({
          leagueId: league.id,
          seasonYear: current.seasonYear,
          teamId: current.userTeamId!,
          currentDay: current.day + 1,
        });
        const refreshed = await prisma.league.findUniqueOrThrow({ where: { id: league.id } });
        if (nextUser && nextUser.day === refreshed.day) {
          message = `Arrived at your next game (${gamesPlayed.length} simmed)`;
          break;
        }
      }
    }
  }

  const refreshed = await prisma.league.findUniqueOrThrow({ where: { id: league.id } });
  const standings = await getStandings(league.id);
  const nextUserGameRow = refreshed.userTeamId
    ? await findNextUserRegularSeasonGame({
        leagueId: league.id,
        seasonYear: refreshed.seasonYear,
        teamId: refreshed.userTeamId,
        currentDay: refreshed.day,
      })
    : null;

  return {
    league: toLeague(refreshed),
    gamesPlayed,
    nextUserGame: nextUserGameRow ? toScheduleGame(nextUserGameRow) : null,
    standings,
    phaseChanged,
    message: message || `Advanced (${gamesPlayed.length} games)`,
  };
}

async function tickInjuries(leagueId: string) {
  await prisma.player.updateMany({
    where: { team: { leagueId }, injuredDays: { gt: 0 } },
    data: { injuredDays: { decrement: 1 } },
  });
}

export async function playUserNextGame(userId: string, leagueId: string): Promise<GameResult> {
  const league = await prisma.league.findFirst({ where: { id: leagueId, ownerUserId: userId } });
  if (!league?.userTeamId) throw new Error("Franchise not selected");
  const next = await findNextUserRegularSeasonGame({
    leagueId,
    seasonYear: league.seasonYear,
    teamId: league.userTeamId,
    currentDay: league.day,
  });
  if (!next) throw new Error("No upcoming games for your team");
  if (next.day > league.day) {
    await advanceLeague(userId, {
      leagueId,
      mode: "toUserGame",
      autoSimUserGames: true,
    });
  }
  return simulateScheduledGame(next.id);
}
