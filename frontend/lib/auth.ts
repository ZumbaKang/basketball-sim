import { cookies } from "next/headers";
import { getUserFromSession } from "@basketball-sim/db";
import { SESSION_COOKIE } from "./session";

export async function requireUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const user = await getUserFromSession(token);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return { user, token: token! };
}

export async function optionalUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return getUserFromSession(token);
}
