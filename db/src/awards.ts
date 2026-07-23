import { prisma } from "./prisma.js";

export async function computeAwards(leagueId: string, seasonYear: number) {
  const teams = await prisma.team.findMany({
    where: { leagueId },
    select: { id: true },
  });
  if (!teams.length) return;

  const stats = await prisma.playerSeasonStat.findMany({
    where: {
      seasonYear,
      teamId: { in: teams.map((team) => team.id) },
      games: { gte: 1 },
    },
    select: {
      playerId: true,
      teamId: true,
      games: true,
      minutes: true,
      pts: true,
      reb: true,
      ast: true,
      stl: true,
      blk: true,
      player: {
        select: {
          name: true,
          age: true,
        },
      },
    },
  });
  if (!stats.length) return;

  const scored = stats.map((s) => ({
    ...s,
    ppg: s.pts / s.games,
    rpg: s.reb / s.games,
    apg: s.ast / s.games,
    spg: s.stl / s.games,
    bpg: s.blk / s.games,
    mpg: s.minutes / s.games,
    score: s.pts / s.games + s.reb / s.games * 0.7 + s.ast / s.games * 0.9,
  }));

  const mvp = [...scored].sort((a, b) => b.score - a.score)[0]!;
  const dpoy = [...scored].sort((a, b) => b.spg + b.bpg - (a.spg + a.bpg))[0]!;
  const roy = [...scored]
    .filter((s) => s.player.age <= 22)
    .sort((a, b) => b.score - a.score)[0];
  const smoy = [...scored]
    .filter((s) => s.mpg < 28)
    .sort((a, b) => b.ppg - a.ppg)[0];

  const awards = [
    { kind: "MVP", row: mvp },
    { kind: "DPOY", row: dpoy },
    ...(roy ? [{ kind: "ROY", row: roy }] : []),
    ...(smoy ? [{ kind: "SMOY", row: smoy }] : []),
  ];

  for (const a of awards) {
    await prisma.award.create({
      data: {
        leagueId,
        seasonYear,
        kind: a.kind,
        playerId: a.row.playerId,
        playerName: a.row.player.name,
        teamId: a.row.teamId,
      },
    });
  }

  const allLeague = [...scored].sort((a, b) => b.score - a.score).slice(0, 5);
  for (const row of allLeague) {
    await prisma.award.create({
      data: {
        leagueId,
        seasonYear,
        kind: "ALL_LEAGUE",
        playerId: row.playerId,
        playerName: row.player.name,
        teamId: row.teamId,
      },
    });
  }
}
