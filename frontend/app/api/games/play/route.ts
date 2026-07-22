import { NextResponse } from "next/server";
import { playGame } from "@basketball-sim/db";
import type { PlayGameRequest } from "@basketball-sim/shared";
import { optionalUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await optionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as PlayGameRequest;
    const result = await playGame(user.id, body);
    return NextResponse.json({ game: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not play game";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
