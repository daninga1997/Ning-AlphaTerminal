import type { PrismaClient } from "@prisma/client";

import { paperAccountPrisma } from "./paper-account-prisma-client";
import type {
  PaperAccountTransactionContext,
  PaperAccountUnitOfWork,
} from "./paper-account-unit-of-work";
import { createPrismaPaperAccountRepositories } from "./prisma-paper-account-repositories";

export function createPrismaPaperAccountUnitOfWork(
  prisma: PrismaClient,
): PaperAccountUnitOfWork {
  return {
    async run<T>(
      work: (context: PaperAccountTransactionContext) => Promise<T>,
    ): Promise<T> {
      return prisma.$transaction(async (transactionClient) => {
        const scope = { active: true };
        const context = createPrismaPaperAccountRepositories(
          transactionClient,
          scope,
        );

        try {
          return await work(context);
        } finally {
          scope.active = false;
        }
      });
    },
  };
}

export const paperAccountUnitOfWork =
  createPrismaPaperAccountUnitOfWork(paperAccountPrisma);
