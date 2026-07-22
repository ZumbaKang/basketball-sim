import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { User } from "@basketball-sim/shared";
import { prisma } from "./prisma.js";
import { toUser } from "./mappers.js";

const SESSION_DAYS = 14;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type AuthResult = {
  user: User;
  sessionToken: string;
};

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || input.password.length < 8) {
    throw new Error("Valid email and password (8+ chars) required");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already registered");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      displayName: input.displayName.trim() || email.split("@")[0]!,
      passwordHash,
    },
  });

  return createSessionForUser(user.id);
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Invalid email or password");

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new Error("Invalid email or password");

  return createSessionForUser(user.id);
}

async function createSessionForUser(userId: string): Promise<AuthResult> {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: { token: tokenHash, userId, expiresAt },
    include: { user: true },
  });

  return { user: toUser(session.user), sessionToken: rawToken };
}

export async function logoutSession(sessionToken: string): Promise<void> {
  const tokenHash = hashToken(sessionToken);
  await prisma.session.deleteMany({ where: { token: tokenHash } });
}

export async function getUserFromSession(sessionToken: string | undefined | null): Promise<User | null> {
  if (!sessionToken) return null;
  const tokenHash = hashToken(sessionToken);
  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }
  return toUser(session.user);
}
