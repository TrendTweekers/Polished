import { PrismaClient } from "@prisma/client";

// Single shared Prisma client across the process. In dev with --watch we reuse
// the instance attached to globalThis to avoid exhausting DB connections.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__polishedPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__polishedPrisma = prisma;
}
