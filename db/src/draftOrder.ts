import { prisma } from "./prisma.js";

type DraftOrderTeam = {
  id: string;
  wins: number;
  losses: number;
};

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

/**
 * Assigns draft slots from worst to best regular-season record, then resolves
 * any pending top-N protection against the resulting overall slot.
 */
export async function createDraftOrderAndResolveConveyance(
  leagueId: string,
  seasonYear: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const teams = await tx.team.findMany({
      where: { leagueId },
      select: { id: true, wins: true, losses: true },
    });
    const orderedTeams = teams.sort(compareDraftOrder);
    const slotByOriginalTeam = new Map(
      orderedTeams.map((team, index) => [team.id, index + 1]),
    );
    const picks = await tx.draftPick.findMany({
      where: { leagueId, seasonYear, playerId: null },
    });

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
        data.ownerTeamId =
          pickNumber <= pick.protectedThrough
            ? pick.originalTeamId
            : pick.conveyanceTeamId;
        data.protectedThrough = null;
        data.conveyanceTeamId = null;
      }

      await tx.draftPick.update({
        where: { id: pick.id },
        data,
      });
    }
  });
}
