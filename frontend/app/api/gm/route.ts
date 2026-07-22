import { NextResponse } from "next/server";
import { proposeTrade, tradeFinder, offerFreeAgent } from "@basketball-sim/db";
import type { FreeAgentOffer, TradeProposal } from "@basketball-sim/shared";
import { optionalUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await optionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as {
      action: "propose" | "finder" | "offer";
      proposal?: TradeProposal;
      leagueId?: string;
      playerId?: string;
      offer?: FreeAgentOffer;
    };
    if (body.action === "propose" && body.proposal) {
      return NextResponse.json({ decision: await proposeTrade(user.id, body.proposal) });
    }
    if (body.action === "finder" && body.leagueId && body.playerId) {
      return NextResponse.json({
        packages: await tradeFinder(user.id, body.leagueId, body.playerId),
      });
    }
    if (body.action === "offer" && body.offer) {
      return NextResponse.json({ result: await offerFreeAgent(user.id, body.offer) });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
