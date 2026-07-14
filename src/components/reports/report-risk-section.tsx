export function ReportRiskSection({ risks }: { risks: string[] }) {
  return (
    <section className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/80">
        Risks
      </p>
      <h2 className="mt-1 text-lg font-semibold text-amber-50">风险提示</h2>
      <ul className="mt-4 grid gap-2 text-sm leading-6 text-amber-50/80">
        {risks.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
    </section>
  );
}
