import { NextResponse } from "next/server";
import { optionalUser } from "@/lib/auth";

export async function GET() {
  const user = await optionalUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
