import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { MemoryDetailView } from "@/components/memory/memory-detail-view";
import { PrismaTradingPlanRepository } from "@/server/trading-memory/prisma-trading-plan-repository";
import { createTradingMemoryService } from "@/server/trading-memory/trading-memory-service";

export const dynamic = "force-dynamic";

export default async function MemoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await createTradingMemoryService(new PrismaTradingPlanRepository()).getPlan(id);
  if (!plan) notFound();

  return (
    <AppShell>
      <MemoryDetailView plan={plan} />
    </AppShell>
  );
}
