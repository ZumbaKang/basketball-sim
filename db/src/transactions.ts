import type { FreeAgentOffer, TradeDecision, TradeProposal } from "@basketball-sim/shared";
import { evaluateTrade, findTradePackages, preferFreeAgent, type EvaluablePlayer } from "@basketball-sim/gm";
import { prisma } from "./prisma.js";
import { toPlayer } from "./mappers.js";

async function loadEvaluable(teamId: string): Promise<EvaluablePlayer[]> {
  const players = await prisma.player.findMany({
    where: { teamId },
    include: { contracts: true },
  });
  return players.map((p) => ({
    ...toPlayer(p),
    salary: p.contracts[0]?.salary ?? 1_000_000,
    yearsRemaining: p.contracts[0]?.yearsRemaining ?? 1,
  }));
}

export async function proposeTrade(userId: string, proposal: TradeProposal): Promise<TradeDecision> {
  const league = await prisma.league.findFirst({
    where: { id: proposal.leagueId, ownerUserId: userId },
  });
  if (!league?.userTeamId) throw new Error("Franchise required");
  if (proposal.fromTeamId !== league.userTeamId) {
    throw new Error("You may only propose trades from your team");
  }

  const theirTeam = await prisma.team.findFirst({
    where: { id: proposal.toTeamId, leagueId: league.id },
  });
  if (!theirTeam) throw new Error("Target team not found");

  const ourPlayers = await loadEvaluable(proposal.fromTeamId);
  const theirPlayers = await loadEvaluable(proposal.toTeamId);
  // AI team perspective: they receive fromAssets, send toAssets
  const decision = evaluateTrade({
    proposal,
    direction: theirTeam.gmDirection as "contend" | "window" | "rebuild" | "tank" | "cheap",
    ourPlayers: theirPlayers,
    theirPlayers: ourPlayers,
  });

  if (decision.accepted) {
    await applyTrade(proposal);
    await prisma.newsItem.create({
      data: {
        leagueId: league.id,
        seasonYear: league.seasonYear,
        day: league.day,
        kind: "trade",
        headline: `Trade with ${theirTeam.name} completed`,
        body: decision.reason,
      },
    });
  }

  return decision;
}

async function applyTrade(proposal: TradeProposal) {
  for (const asset of proposal.fromAssets) {
    if (!asset.playerId) continue;
    await prisma.player.update({
      where: { id: asset.playerId },
      data: { teamId: proposal.toTeamId },
    });
    await prisma.contract.updateMany({
      where: { playerId: asset.playerId },
      data: { teamId: proposal.toTeamId },
    });
  }
  for (const asset of proposal.toAssets) {
    if (!asset.playerId) continue;
    await prisma.player.update({
      where: { id: asset.playerId },
      data: { teamId: proposal.fromTeamId },
    });
    await prisma.contract.updateMany({
      where: { playerId: asset.playerId },
      data: { teamId: proposal.fromTeamId },
    });
  }
}

export async function tradeFinder(userId: string, leagueId: string, playerId: string) {
  const league = await prisma.league.findFirst({ where: { id: leagueId, ownerUserId: userId } });
  if (!league?.userTeamId) throw new Error("Franchise required");
  const target = (await loadEvaluable(league.userTeamId)).find((p) => p.id === playerId);
  if (!target) throw new Error("Player not on your roster");

  const teams = await prisma.team.findMany({ where: { leagueId, id: { not: league.userTeamId } } });
  const packages: { teamId: string; teamName: string; proposal: TradeProposal; decision: TradeDecision }[] = [];

  for (const team of teams.slice(0, 12)) {
    const their = await loadEvaluable(team.id);
    const drafts = findTradePackages({
      targetPlayer: target,
      ourPlayers: their,
      direction: team.gmDirection as "contend" | "window" | "rebuild" | "tank" | "cheap",
    });
    for (const d of drafts.slice(0, 1)) {
      const proposal: TradeProposal = {
        leagueId,
        fromTeamId: league.userTeamId,
        toTeamId: team.id,
        fromAssets: [{ playerId: target.id }],
        toAssets: d.toAssets,
      };
      const decision = evaluateTrade({
        proposal,
        direction: team.gmDirection as "contend" | "window" | "rebuild" | "tank" | "cheap",
        ourPlayers: their,
        theirPlayers: [target],
      });
      packages.push({ teamId: team.id, teamName: team.name, proposal, decision });
    }
  }
  return packages.filter((p) => p.decision.accepted).slice(0, 5);
}

export async function offerFreeAgent(userId: string, offer: FreeAgentOffer) {
  const league = await prisma.league.findFirst({
    where: { id: offer.leagueId, ownerUserId: userId },
  });
  if (!league?.userTeamId || league.userTeamId !== offer.teamId) {
    throw new Error("Can only offer from your franchise");
  }
  const player = await prisma.player.findFirst({
    where: { id: offer.playerId, teamId: null },
  });
  if (!player) throw new Error("Not a free agent");

  const payroll = await prisma.contract.aggregate({
    where: { teamId: offer.teamId },
    _sum: { salary: true },
  });
  if ((payroll._sum.salary ?? 0) + offer.salary > league.salaryCap * 1.1) {
    throw new Error("Offer would blow past the soft cap");
  }

  const rivals = await prisma.team.findMany({
    where: { leagueId: league.id, id: { not: offer.teamId } },
    take: 5,
  });
  const userTeam = await prisma.team.findUniqueOrThrow({ where: { id: offer.teamId } });
  const offers = [
    {
      teamId: offer.teamId,
      salary: offer.salary,
      years: offer.years,
      direction: userTeam.gmDirection as "contend" | "window" | "rebuild" | "tank" | "cheap",
      wins: userTeam.wins,
    },
    ...rivals.map((t) => ({
      teamId: t.id,
      salary: Math.round(offer.salary * (0.85 + Math.random() * 0.3)),
      years: offer.years,
      direction: t.gmDirection as "contend" | "window" | "rebuild" | "tank" | "cheap",
      wins: t.wins,
    })),
  ];

  const winner = preferFreeAgent(
    {
      ...toPlayer(player),
      salary: offer.salary,
      yearsRemaining: offer.years,
    },
    offers,
  );

  if (winner !== offer.teamId) {
    const team = winner ? await prisma.team.findUnique({ where: { id: winner } }) : null;
    return {
      signed: false,
      reason: `Player chose ${team?.name ?? "another club"} instead.`,
    };
  }

  await prisma.player.update({
    where: { id: player.id },
    data: { teamId: offer.teamId, leagueId: null, rotationOrder: 12, targetMinutes: 18 },
  });
  await prisma.contract.create({
    data: {
      playerId: player.id,
      teamId: offer.teamId,
      salary: offer.salary,
      yearsRemaining: offer.years,
    },
  });
  await prisma.newsItem.create({
    data: {
      leagueId: league.id,
      seasonYear: league.seasonYear,
      day: league.day,
      kind: "signing",
      headline: `${player.name} signs`,
      body: `$${offer.salary.toLocaleString()} over ${offer.years} year(s).`,
    },
  });
  return { signed: true, reason: `${player.name} is on your roster.` };
}
