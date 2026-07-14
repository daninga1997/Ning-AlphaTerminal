type ScoreBadgeProps = {
  label: string;
  score: number;
};

function getScoreClassName(score: number): string {
  if (score >= 90) return "border-emerald-300/30 bg-emerald-400/12 text-emerald-100";
  if (score >= 80) return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
  if (score >= 70) return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  return "border-slate-300/15 bg-white/5 text-slate-300";
}

export function ScoreBadge({ label, score }: ScoreBadgeProps) {
  return (
    <span
      className={`inline-flex min-w-16 items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs ${getScoreClassName(score)}`}
    >
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold">{score}</span>
    </span>
  );
}
