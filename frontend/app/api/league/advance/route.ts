import { NextResponse } from "next/server";
import { advanceLeague } from "@basketball-sim/db";
import type { AdvanceRequest } from "@basketball-sim/shared";
import { optionalUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await optionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as AdvanceRequest;
    const result = await advanceLeague(user.id, {
      ...body,
      autoSimUserGames: body.autoSimUserGames ?? true,
    });
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Advance failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
