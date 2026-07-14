import type { TradingPlanRecord } from "@/server/trading-memory/trading-plan-repository";
import { eventLabels } from "./memory-utils";
import { MemorySection } from "./memory-section";

export function TimelineSection({ plan }: { plan: TradingPlanRecord }) {
  return (
    <MemorySection title="事件时间线" subtitle="后续发生的信息，按时间正序排列。">
      <div className="space-y-3">
        {plan.events.map((event) => (
          <div className="rounded-lg border border-[#252A33] bg-[#090A0D] p-3" key={event.id}>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold text-[#F4F7FB]">{eventLabels[event.eventType]}</span>
              <span className="font-mono text-xs text-[#8B95A7]">{event.eventTime}</span>
            </div>
            <p className="mt-2 text-sm text-[#DCE4F0]">{event.description}</p>
          </div>
        ))}
      </div>
    </MemorySection>
  );
}
