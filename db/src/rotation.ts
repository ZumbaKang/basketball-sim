import type { Player } from "@basketball-sim/shared";

export async function updateRotation(
  userId: string,
  leagueId: string,
  orders: { playerId: string; rotationOrder: number; targetMinutes: number }[],
): Promise<Player[]> {
  const { prisma } = await import("./prisma.js");
  const league = await prisma.league.findFirst({ where: { id: leagueId, ownerUserId: userId } });
  if (!league?.userTeamId) throw new Error("Franchise required");

  for (const row of orders) {
    const player = await prisma.player.findFirst({
      where: { id: row.playerId, teamId: league.userTeamId },
    });
    if (!player) continue;
    await prisma.player.update({
      where: { id: row.playerId },
      data: {
        rotationOrder: row.rotationOrder,
        targetMinutes: row.targetMinutes,
      },
    });
  }

  const { toPlayer } = await import("./mappers.js");
  const roster = await prisma.player.findMany({
    where: { teamId: league.userTeamId },
    orderBy: { rotationOrder: "asc" },
  });
  return roster.map(toPlayer);
}
