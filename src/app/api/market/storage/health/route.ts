import { errorJson } from "@/server/market-data/api-response";
import { PrismaMarketDataRepository } from "@/server/market-storage/prisma-market-data-repository";

export async function GET() {
  try {
    const repository = new PrismaMarketDataRepository();
    const health = await repository.getFetchHealthSummary();
    return Response.json({ success: true, data: health });
  } catch (error) {
    return errorJson(error);
  }
}
