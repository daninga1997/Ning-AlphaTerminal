import type { ScoreBreakdownItem, ScoreResult } from "@/types/scoring";

type ScoreBreakdownPanelProps = {
  title: string;
  subtitle: string;
  score: ScoreResult<string>;
};

function getItemWarnings(item: ScoreBreakdownItem, warnings: string[]): string[] {
  const keywords = [item.label, item.key];
  const matched = warnings.filter((warning) => keywords.some((keyword) => warning.includes(keyword)));
  return matched.length > 0 ? matched : ["暂无分项风险警告"];
}

function getDeductionText(item: ScoreBreakdownItem): string {
  if (item.score >= item.maxScore) return "无明确扣分项";
  return `当前分项未拿满，剩余 ${item.maxScore - item.score} 分由规则限制。`;
}

export function ScoreBreakdownPanel({ title, subtitle, score }: ScoreBreakdownPanelProps) {
  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
            Score Explanation
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">{title}</h2>
          <p className="mt-1 text-sm text-[#8B95A7]">{subtitle}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-semibold text-[#F4F7FB]">{score.total}</div>
          <div className="text-xs text-[#7AA7FF]">评级 {score.grade}</div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {score.breakdown.map((item) => (
          <div className="rounded-lg border border-[#252A33] bg-[#090A0D] p-4" key={item.key}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[#F4F7FB]">{item.label}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#252A33] px-2 py-0.5 text-[11px] text-[#8B95A7]">
                    {item.isDemoInput ? "Mock演示输入" : "算法计算"}
                  </span>
                </div>
              </div>
              <div className="font-mono text-sm font-semibold text-[#DCE4F0]">
                {item.score}/{item.maxScore}
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#1A1F27]">
              <div
                className="h-full rounded-full bg-[#4F8CFF]"
                style={{ width: `${Math.round((item.score / item.maxScore) * 100)}%` }}
              />
            </div>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-[#8B95A7] lg:grid-cols-3">
              <p>加分原因：{item.reason}</p>
              <p>扣分原因：{getDeductionText(item)}</p>
              <p>风险警告：{getItemWarnings(item, score.warnings).join("；")}</p>
            </div>
          </div>
        ))}
      </div>

      {score.reasons.length > 0 ? (
        <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/8 p-3">
          <div className="text-xs font-semibold text-emerald-100">整体加分理由</div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-emerald-50/80">
            {score.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
