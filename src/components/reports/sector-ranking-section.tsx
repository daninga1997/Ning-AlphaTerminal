import type { ReportSector } from "@/types/report";

export function SectorRankingSection({ sectors }: { sectors: ReportSector[] }) {
  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
        Main Sectors
      </p>
      <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">主线板块</h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {sectors.map((sector) => (
          <div className="rounded-lg border border-[#252A33] bg-[#090A0D] p-4" key={sector.name}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-[#8B95A7]">#{sector.rank}</div>
                <h3 className="mt-1 font-semibold text-[#F4F7FB]">{sector.name}</h3>
              </div>
              <span className="font-mono text-sm font-semibold text-emerald-100">{sector.heat}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#1A1F27]">
              <div className="h-full rounded-full bg-[#22C55E]" style={{ width: `${sector.heat}%` }} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[#8B95A7]">{sector.summary}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
