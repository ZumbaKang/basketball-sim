import { NextResponse } from "next/server";
import { playUserNextGame } from "@basketball-sim/db";
import { optionalUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await optionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as { leagueId?: string };
    if (!body.leagueId) return NextResponse.json({ error: "leagueId required" }, { status: 400 });
    const game = await playUserNextGame(user.id, body.leagueId);
    return NextResponse.json({ game });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Play failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
