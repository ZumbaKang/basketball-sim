import { prisma } from "./prisma.js";

type DraftOrderTeam = {
  id: string;
  name: string;
  wins: number;
  losses: number;
};

type ConveyanceResolution = {
  round: number;
  pickNumber: number;
  protectedThrough: number;
  originalTeamName: string;
  recipientTeamName: string;
  retained: boolean;
};

/**
 * Resolutions are filed on the first day of the season the picks belong to so
 * the season transaction log surfaces them alongside that season's moves.
 */
const RESOLUTION_DAY = 1;

function winPercentage(team: DraftOrderTeam): number {
  const games = team.wins + team.losses;
  return games === 0 ? 0 : team.wins / games;
}

function compareDraftOrder(a: DraftOrderTeam, b: DraftOrderTeam): number {
  return (
    winPercentage(a) - winPercentage(b) ||
    a.wins - b.wins ||
    b.losses - a.losses ||
    a.id.localeCompare(b.id)
  );
}

function resolutionNews(seasonYear: number, resolution: ConveyanceResolution) {
  const slot = `${seasonYear} Round ${resolution.round} Pick ${resolution.pickNumber}`;
  const protection = `top-${resolution.protectedThrough} protection`;
  return resolution.retained
    ? {
        headline: `${slot} stays with ${resolution.originalTeamName}`,
        body:
          `The No. ${resolution.pickNumber} overall slot fell inside ${protection}, `
          + `so ${resolution.originalTeamName} keeps it and ${resolution.recipientTeamName} receives nothing.`,
      }
    : {
        headline: `${slot} conveys to ${resolution.recipientTeamName}`,
        body:
          `The No. ${resolution.pickNumber} overall slot landed outside ${protection}, `
          + `so ${resolution.originalTeamName} sends it to ${resolution.recipientTeamName}.`,
      };
}

/**
 * Assigns draft slots from worst to best regular-season record, then resolves
 * any pending top-N protection against the resulting overall slot. Every
 * resolved protection is recorded once as a transaction news item so the
 * season log explains where the slot ended up.
 */
export async function createDraftOrderAndResolveConveyance(
  leagueId: string,
  seasonYear: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const teams = await tx.team.findMany({
      where: { leagueId },
      select: { id: true, name: true, wins: true, losses: true },
    });
    const orderedTeams = teams.sort(compareDraftOrder);
    const slotByOriginalTeam = new Map(
      orderedTeams.map((team, index) => [team.id, index + 1]),
    );
    const nameByTeam = new Map(orderedTeams.map((team) => [team.id, team.name]));
    const picks = await tx.draftPick.findMany({
      where: { leagueId, seasonYear, playerId: null },
    });
    const resolutions: ConveyanceResolution[] = [];

    for (const pick of picks) {
      const slot = slotByOriginalTeam.get(pick.originalTeamId);
      if (slot === undefined) {
        throw new Error(
          `Draft pick ${pick.id} references a team outside league ${leagueId}`,
        );
      }
      const pickNumber = (pick.round - 1) * orderedTeams.length + slot;
      const hasProtection = pick.protectedThrough !== null;
      const hasRecipient = pick.conveyanceTeamId !== null;
      if (hasProtection !== hasRecipient) {
        throw new Error(`Draft pick ${pick.id} has incomplete conveyance terms`);
      }

      const data: {
        pick: number;
        ownerTeamId?: string;
        protectedThrough?: null;
        conveyanceTeamId?: null;
      } = { pick: pickNumber };
      if (
        pick.protectedThrough !== null &&
        pick.conveyanceTeamId !== null
      ) {
        const recipientTeamName = nameByTeam.get(pick.conveyanceTeamId);
        if (recipientTeamName === undefined) {
          throw new Error(
            `Draft pick ${pick.id} conveys to a team outside league ${leagueId}`,
          );
        }
        const retained = pickNumber <= pick.protectedThrough;
        data.ownerTeamId = retained ? pick.originalTeamId : pick.conveyanceTeamId;
        data.protectedThrough = null;
        data.conveyanceTeamId = null;
        resolutions.push({
          round: pick.round,
          pickNumber,
          protectedThrough: pick.protectedThrough,
          originalTeamName: nameByTeam.get(pick.originalTeamId)!,
          recipientTeamName,
          retained,
        });
      }

      await tx.draftPick.update({
        where: { id: pick.id },
        data,
      });
    }

    for (const resolution of resolutions) {
      await tx.newsItem.create({
        data: {
          leagueId,
          seasonYear,
          day: RESOLUTION_DAY,
          kind: "transaction",
          ...resolutionNews(seasonYear, resolution),
        },
      });
    }
  });
}
