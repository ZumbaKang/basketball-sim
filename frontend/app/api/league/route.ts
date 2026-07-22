import { NextResponse } from "next/server";
import { getFranchiseHome, listFranchiseChoices } from "@basketball-sim/db";
import { optionalUser } from "@/lib/auth";

export async function GET() {
  const user = await optionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const home = await getFranchiseHome(user.id);
  if (!home.snapshot.userTeamId) {
    const choices = await listFranchiseChoices(user.id);
    return NextResponse.json({ needsFranchise: true, choices, leagueId: home.snapshot.league.id, user });
  }
  return NextResponse.json({ needsFranchise: false, home });
}
