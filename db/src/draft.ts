import { prisma } from "./prisma.js";
import { ratingsFromOverall } from "./seedData.js";

const NAMES_A = ["Ace", "Blake", "Cody", "Drew", "Evan", "Ford", "Gage", "Hank", "Irv", "Jett"];
const NAMES_B = ["Nolan", "Orion", "Pax", "Reed", "Sloan", "Tate", "Vaughn", "Wes", "Xander", "Yale"];
const POS = ["PG", "SG", "SF", "PF", "C"] as const;

export async function generateDraftClass(leagueId: string, seasonYear: number) {
  // Prospects stored as free agents with age 19 and high potential
  for (let i = 0; i < 60; i++) {
    const overall = 58 + Math.floor(Math.random() * 20);
    const potential = Math.min(96, overall + 8 + Math.floor(Math.random() * 12));
    const r = ratingsFromOverall(overall);
    await prisma.player.create({
      data: {
        leagueId,
        teamId: null,
        name: `${NAMES_A[i % NAMES_A.length]} ${NAMES_B[Math.floor(i / 2) % NAMES_B.length]} ${i}`,
        position: POS[i % POS.length]!,
        age: 19,
        potential,
        rotationOrder: 99,
        targetMinutes: 12,
        ...r,
      },
    });
  }
}

export async function runAiDraft(leagueId: string, seasonYear: number, userTeamId: string | null) {
  const picks = await prisma.draftPick.findMany({
    where: { leagueId, seasonYear, playerId: null },
    orderBy: [{ round: "asc" }, { pick: "asc" }],
  });
  const prospects = await prisma.player.findMany({
    where: { leagueId, teamId: null, age: { lte: 20 } },
    orderBy: [{ potential: "desc" }, { overall: "desc" }],
  });
  let idx = 0;
  for (const pick of picks) {
    if (userTeamId && pick.ownerTeamId === userTeamId) {
      // leave for user — auto-pick best remaining to keep season moving
    }
    const prospect = prospects[idx++];
    if (!prospect) break;
    await prisma.player.update({
      where: { id: prospect.id },
      data: {
        teamId: pick.ownerTeamId,
        leagueId: null,
        rotationOrder: 10,
        targetMinutes: 16,
      },
    });
    await prisma.contract.create({
      data: {
        playerId: prospect.id,
        teamId: pick.ownerTeamId,
        salary: 4_000_000 + pick.round * 1_000_000,
        yearsRemaining: 3,
      },
    });
    await prisma.draftPick.update({
      where: { id: pick.id },
      data: { playerId: prospect.id },
    });
  }
}

export async function userDraftPlayer(
  userId: string,
  leagueId: string,
  playerId: string,
) {
  const league = await prisma.league.findFirst({ where: { id: leagueId, ownerUserId: userId } });
  if (!league?.userTeamId) throw new Error("No franchise");
  const pick = await prisma.draftPick.findFirst({
    where: {
      leagueId,
      seasonYear: league.seasonYear + (league.phase === "offseason" ? 1 : 0),
      ownerTeamId: league.userTeamId,
      playerId: null,
    },
    orderBy: [{ round: "asc" }, { pick: "asc" }],
  });
  // During auto offseason draft already ran; allow signing undrafted FA rookies
  const player = await prisma.player.findFirst({ where: { id: playerId, teamId: null } });
  if (!player) throw new Error("Player unavailable");
  await prisma.player.update({
    where: { id: playerId },
    data: { teamId: league.userTeamId, leagueId: null, rotationOrder: 11, targetMinutes: 14 },
  });
  await prisma.contract.create({
    data: {
      playerId,
      teamId: league.userTeamId,
      salary: 2_500_000,
      yearsRemaining: 2,
    },
  });
  if (pick) {
    await prisma.draftPick.update({ where: { id: pick.id }, data: { playerId } });
  }
  return player;
}
