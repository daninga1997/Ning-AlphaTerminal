export function MemoryHeader({ total }: { total: number }) {
  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">Trading Memory</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#F4F7FB]">交易记忆</h1>
          <p className="mt-2 text-sm text-[#8B95A7]">
            记录交易计划、冻结当时评分与信号，并用于盘后复盘。当前为本地 SQLite 数据。
          </p>
        </div>
        <div className="rounded-full border border-[#4F8CFF]/25 bg-[#4F8CFF]/10 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">
          共 {total} 个计划 · 演示/本地记录
        </div>
      </div>
    </section>
  );
}
