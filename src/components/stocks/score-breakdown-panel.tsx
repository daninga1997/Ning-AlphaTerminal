import type { ScoreBreakdownItem } from "@/types/scoring";

export function ScoreBreakdownPanel({
  title,
  total,
  grade,
  breakdown,
  reasons,
  warnings,
}: {
  title: string;
  total: number;
  grade: string;
  breakdown: ScoreBreakdownItem[];
  reasons: string[];
  warnings: string[];
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111722] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-white">{title}</h3>
          <div className="mt-1 text-xs text-slate-500">分项可解释评分</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold text-white">{total}</div>
          <div className="text-xs text-cyan-100">评级：{grade}</div>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {breakdown.map((item) => (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3" key={item.key}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-white">
                {item.label}
                {item.isDemoInput ? (
                  <span className="ml-2 rounded border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-xs text-amber-100">
                    演示评分
                  </span>
                ) : null}
              </div>
              <div className="text-sm text-slate-200">
                {item.score}/{item.maxScore}
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-cyan-300"
                style={{ width: `${(item.score / item.maxScore) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{item.reason}</p>
          </div>
        ))}
      </div>
      {reasons.length > 0 ? (
        <div className="mt-4">
          <div className="text-xs text-slate-500">加分理由</div>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-400/10 p-3">
          <div className="text-xs font-medium text-amber-100">风险警告</div>
          <ul className="mt-2 space-y-1 text-xs text-amber-50/80">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
