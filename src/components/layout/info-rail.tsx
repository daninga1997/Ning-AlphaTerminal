const notices = ["右侧信息栏预留", "后续用于数据状态", "后续用于风险提示", "后续用于报告摘要"];

export function InfoRail() {
  return (
    <aside className="border-t border-white/10 bg-[#0d1118] px-4 py-4 sm:px-6 lg:px-8 xl:border-l xl:border-t-0 xl:px-5">
      <div className="xl:sticky xl:top-24">
        <h2 className="text-sm font-medium text-slate-200">信息栏</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {notices.map((notice) => (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4" key={notice}>
              <div className="text-sm text-white">{notice}</div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                当前阶段仅展示布局占位，不连接任何行情、API 或数据库。
              </p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
