import { PrismaClient } from "@prisma/client";

const globalForMarketStorage = globalThis as unknown as {
  marketStoragePrisma?: PrismaClient;
};

export const marketStoragePrisma =
  globalForMarketStorage.marketStoragePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForMarketStorage.marketStoragePrisma = marketStoragePrisma;
