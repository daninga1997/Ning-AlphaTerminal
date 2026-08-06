import type { PrismaClient } from "@prisma/client";

import { prisma as tradingMemoryPrisma } from "../trading-memory/prisma-client";

export const paperAccountPrisma: PrismaClient = tradingMemoryPrisma;
