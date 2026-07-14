export function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-1 text-base font-semibold text-white">{title}</h2>
    </div>
  );
}

export function MetricCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const toneClass =
    tone === "good" ? "text-emerald-100" : tone === "warn" ? "text-amber-100" : "text-white";

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

export function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 font-mono text-base font-semibold text-white">{value}</div>
    </div>
  );
}
