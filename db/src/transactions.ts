import type { Prisma } from "@prisma/client";
import type {
  FreeAgentOffer,
  TradeAsset,
  TradeDecision,
  TradeProposal,
} from "@basketball-sim/shared";
import {
  evaluateTrade,
  findTradePackages,
  preferFreeAgent,
  type EvaluableDraftPick,
  type EvaluablePlayer,
} from "@basketball-sim/gm";
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

async function loadTradableDraftPicks(
  leagueId: string,
  ownerTeamId: string,
): Promise<EvaluableDraftPick[]> {
  return prisma.draftPick.findMany({
    where: {
      leagueId,
      ownerTeamId,
      playerId: null,
      conveyanceTeamId: null,
    },
    select: {
      id: true,
      seasonYear: true,
      round: true,
      pick: true,
    },
  });
}

function isValidProtection(
  protection: TradeAsset["draftPickProtection"],
): boolean {
  return (
    !protection ||
    protection.kind === "unprotected" ||
    (protection.kind === "top" &&
      Number.isInteger(protection.protectedThrough) &&
      protection.protectedThrough >= 1 &&
      protection.protectedThrough <= 30)
  );
}

function invalidDraftPickDecision(proposal: TradeProposal): TradeDecision | null {
  const seen = new Set<string>();
  for (const asset of [...proposal.fromAssets, ...proposal.toAssets]) {
    if (!asset.draftPickId) continue;
    if (seen.has(asset.draftPickId) || !isValidProtection(asset.draftPickProtection)) {
      return {
        accepted: false,
        reason: "Draft pick details or protection terms are invalid.",
        proposal,
      };
    }
    seen.add(asset.draftPickId);
  }
  return null;
}

function invalidPlayerAssetDecision(
  proposal: TradeProposal,
  fromPlayers: EvaluablePlayer[],
  toPlayers: EvaluablePlayer[],
): TradeDecision | null {
  const fromIds = new Set(fromPlayers.map((player) => player.id));
  const toIds = new Set(toPlayers.map((player) => player.id));
  const seen = new Set<string>();

  for (const asset of proposal.fromAssets) {
    if (!asset.playerId) continue;
    if (seen.has(asset.playerId) || !fromIds.has(asset.playerId)) {
      return {
        accepted: false,
        reason: "Player asset does not belong to the declaring team.",
        proposal,
      };
    }
    seen.add(asset.playerId);
  }

  for (const asset of proposal.toAssets) {
    if (!asset.playerId) continue;
    if (seen.has(asset.playerId) || !toIds.has(asset.playerId)) {
      return {
        accepted: false,
        reason: "Player asset does not belong to the declaring team.",
        proposal,
      };
    }
    seen.add(asset.playerId);
  }

  return null;
}

async function applyDraftPickAsset(
  tx: Prisma.TransactionClient,
  asset: TradeAsset,
  leagueId: string,
  sourceTeamId: string,
  recipientTeamId: string,
): Promise<void> {
  if (!asset.draftPickId) return;

  const protection = asset.draftPickProtection;
  const isProtected = protection?.kind === "top";
  const result = await tx.draftPick.updateMany({
    where: {
      id: asset.draftPickId,
      leagueId,
      ownerTeamId: sourceTeamId,
      originalTeamId: isProtected ? sourceTeamId : undefined,
      conveyanceTeamId: null,
      playerId: null,
    },
    data: isProtected
      ? {
          protectedThrough: protection.protectedThrough,
          conveyanceTeamId: recipientTeamId,
        }
      : {
          ownerTeamId: recipientTeamId,
          protectedThrough: null,
          conveyanceTeamId: null,
        },
  });
  if (result.count !== 1) {
    throw new Error("Draft pick is no longer tradable");
  }
}

async function applyPlayerAsset(
  tx: Prisma.TransactionClient,
  playerId: string,
  sourceTeamId: string,
  recipientTeamId: string,
): Promise<void> {
  const playerResult = await tx.player.updateMany({
    where: { id: playerId, teamId: sourceTeamId },
    data: { teamId: recipientTeamId },
  });
  if (playerResult.count !== 1) {
    throw new Error("Player is no longer on the trading team");
  }

  await tx.contract.updateMany({
    where: { playerId, teamId: sourceTeamId },
    data: { teamId: recipientTeamId },
  });
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

  const invalidPickDecision = invalidDraftPickDecision(proposal);
  if (invalidPickDecision) return invalidPickDecision;

  const [ourPlayers, theirPlayers, ourDraftPicks, theirDraftPicks] =
    await Promise.all([
      loadEvaluable(proposal.fromTeamId),
      loadEvaluable(proposal.toTeamId),
      loadTradableDraftPicks(league.id, proposal.fromTeamId),
      loadTradableDraftPicks(league.id, proposal.toTeamId),
    ]);

  const invalidPlayerDecision = invalidPlayerAssetDecision(
    proposal,
    ourPlayers,
    theirPlayers,
  );
  if (invalidPlayerDecision) return invalidPlayerDecision;

  // AI team perspective: they receive fromAssets, send toAssets
  const decision = evaluateTrade({
    proposal,
    direction: theirTeam.gmDirection as "contend" | "window" | "rebuild" | "tank" | "cheap",
    ourPlayers: theirPlayers,
    theirPlayers: ourPlayers,
    ourDraftPicks: theirDraftPicks,
    theirDraftPicks: ourDraftPicks,
    currentSeasonYear: league.seasonYear,
  });

  if (decision.accepted) {
    await prisma.$transaction(async (tx) => {
      await applyTrade(tx, proposal, league.id);
      await tx.newsItem.create({
        data: {
          leagueId: league.id,
          seasonYear: league.seasonYear,
          day: league.day,
          kind: "trade",
          headline: `Trade with ${theirTeam.name} completed`,
          body: decision.reason,
        },
      });
    });
  }

  return decision;
}

async function applyTrade(
  tx: Prisma.TransactionClient,
  proposal: TradeProposal,
  leagueId: string,
) {
  for (const asset of proposal.fromAssets) {
    if (asset.playerId) {
      await applyPlayerAsset(
        tx,
        asset.playerId,
        proposal.fromTeamId,
        proposal.toTeamId,
      );
    }
    if (asset.draftPickId) {
      await applyDraftPickAsset(
        tx,
        asset,
        leagueId,
        proposal.fromTeamId,
        proposal.toTeamId,
      );
    }
  }
  for (const asset of proposal.toAssets) {
    if (asset.playerId) {
      await applyPlayerAsset(
        tx,
        asset.playerId,
        proposal.toTeamId,
        proposal.fromTeamId,
      );
    }
    if (asset.draftPickId) {
      await applyDraftPickAsset(
        tx,
        asset,
        leagueId,
        proposal.toTeamId,
        proposal.fromTeamId,
      );
    }
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
