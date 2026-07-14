export function MemoryMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#252A33] bg-[#090A0D] p-3">
      <div className="text-xs text-[#8B95A7]">{label}</div>
      <div className="mt-1 break-words font-mono text-sm font-semibold text-[#F4F7FB]">{value}</div>
    </div>
  );
}
