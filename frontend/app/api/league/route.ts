import { NextResponse } from "next/server";
import { ensureLeagueForUser, listGamesForLeague } from "@basketball-sim/db";
import { optionalUser } from "@/lib/auth";

export async function GET() {
  const user = await optionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshot = await ensureLeagueForUser(user.id);
  const games = await listGamesForLeague(snapshot.league.id, user.id);
  return NextResponse.json({ user, snapshot, games });
}
