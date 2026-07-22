import { NextResponse } from "next/server";
import { getStandings } from "@basketball-sim/db";
import { optionalUser } from "@/lib/auth";
import { ensureLeagueForUser } from "@basketball-sim/db";

export async function GET() {
  const user = await optionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const snapshot = await ensureLeagueForUser(user.id);
  const standings = await getStandings(snapshot.league.id);
  return NextResponse.json({ standings, league: snapshot.league });
}
