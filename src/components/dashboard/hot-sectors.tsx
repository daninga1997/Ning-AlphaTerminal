import type { SectorPulse } from "./dashboard-view-model";
import { SectionTitle } from "./dashboard-primitives";

export function HotSectors({ sectors }: { sectors: SectorPulse[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111722] p-4">
      <SectionTitle eyebrow="主线板块" title="主线板块" />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {sectors.map((sector) => (
          <div className="min-h-[118px] rounded-lg border border-white/10 bg-white/[0.03] p-4" key={sector.name}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-white">{sector.name}</h3>
              <span className="font-mono text-sm font-semibold text-emerald-100">{sector.heat}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${sector.heat}%` }} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              热度靠前，重点观察 {sector.leaders.join("、")} 的计划触发情况。
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
