import { errorJson } from "@/server/market-data/api-response";
import { PrismaMarketDataRepository } from "@/server/market-storage/prisma-market-data-repository";
import { watchlistCodes } from "@/server/market-sync/sector-mapping";

export async function GET() {
  try {
    const repository = new PrismaMarketDataRepository();
    const coverage = await repository.getCoverageSummary(watchlistCodes);
    return Response.json({ success: true, data: coverage });
  } catch (error) {
    return errorJson(error);
  }
}
