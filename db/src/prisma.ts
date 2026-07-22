import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

/** Resolve SQLite file URLs against db/prisma so Next (cwd=frontend) and Prisma CLI agree. */
function resolveDatabaseUrl(): string {
  const prismaDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../prisma");
  const fallback = path.join(prismaDir, "dev.db");
  const raw = process.env.DATABASE_URL ?? `file:${fallback}`;

  if (!raw.startsWith("file:")) return raw;

  const filePath = raw.slice("file:".length);
  if (path.isAbsolute(filePath)) return raw;

  // Relative paths from various cwds → always pin to package prisma DB
  return `file:${fallback}`;
}

process.env.DATABASE_URL = resolveDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
