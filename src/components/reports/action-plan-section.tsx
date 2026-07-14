import type { Report } from "@/types/report";

export function ActionPlanSection({ report }: { report: Report }) {
  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
        Action Plan
      </p>
      <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">下一阶段操作计划</h2>
      <ol className="mt-4 grid gap-3">
        {report.actionPlan.map((item, index) => (
          <li className="rounded-lg border border-[#252A33] bg-[#090A0D] p-3 text-sm text-[#DCE4F0]" key={item}>
            <span className="mr-3 font-mono text-[#7AA7FF]">{index + 1}</span>
            {item}
          </li>
        ))}
      </ol>
      {report.nextCheckAt ? <p className="mt-4 text-sm text-[#8B95A7]">下一检查时间：{report.nextCheckAt}</p> : null}
    </section>
  );
}
