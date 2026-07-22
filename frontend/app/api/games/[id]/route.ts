import { NextResponse } from "next/server";
import { getGame } from "@basketball-sim/db";
import { optionalUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await optionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const game = await getGame(id, user.id);
    return NextResponse.json({ game });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Game not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
