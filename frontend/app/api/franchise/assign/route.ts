import { NextResponse } from "next/server";
import { assignFranchise } from "@basketball-sim/db";
import { optionalUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await optionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as { teamId?: string };
    if (!body.teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });
    const snapshot = await assignFranchise(user.id, body.teamId);
    return NextResponse.json({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
