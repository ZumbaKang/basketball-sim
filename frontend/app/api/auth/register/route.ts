import { NextResponse } from "next/server";
import { registerUser, ensureLeagueForUser } from "@basketball-sim/db";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      displayName?: string;
    };
    if (!body.email || !body.password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    const result = await registerUser({
      email: body.email,
      password: body.password,
      displayName: body.displayName ?? "",
    });
    await ensureLeagueForUser(result.user.id);
    const response = NextResponse.json({ user: result.user });
    response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
