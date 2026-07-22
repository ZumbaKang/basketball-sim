import { NextResponse } from "next/server";
import { loginUser, ensureLeagueForUser } from "@basketball-sim/db";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    const result = await loginUser({ email: body.email, password: body.password });
    await ensureLeagueForUser(result.user.id);
    const response = NextResponse.json({ user: result.user });
    response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
