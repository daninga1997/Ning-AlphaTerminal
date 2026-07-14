import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  tradingMemoryPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.tradingMemoryPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.tradingMemoryPrisma = prisma;
}
