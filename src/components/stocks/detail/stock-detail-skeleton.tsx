function SkeletonBlock({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-[#252A33] ${className}`} />;
}

function SkeletonPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function StockDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4" data-testid="stock-detail-loading">
      <section className="rounded-lg border border-cyan-400/20 bg-[#111318] p-5">
        <SkeletonBlock className="h-4 w-28" />
        <div className="mt-4 flex flex-wrap gap-3">
          <SkeletonBlock className="h-8 w-40" />
          <SkeletonBlock className="h-7 w-20" />
          <SkeletonBlock className="h-7 w-24" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <SkeletonBlock className="h-16" key={index} />)}
        </div>
      </section>

      <SkeletonPanel title="交易计划">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <SkeletonBlock className="h-20" key={index} />)}
        </div>
      </SkeletonPanel>

      <SkeletonPanel title="模拟交易">
        <SkeletonBlock className="h-16 w-full" />
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <SkeletonBlock className="h-16" key={index} />)}
        </div>
      </SkeletonPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonPanel title="短线评分分解"><SkeletonBlock className="h-52" /></SkeletonPanel>
        <SkeletonPanel title="中线评分分解"><SkeletonBlock className="h-52" /></SkeletonPanel>
      </div>

      <SkeletonPanel title="技术指标"><SkeletonBlock className="h-28" /></SkeletonPanel>
      <SkeletonPanel title="价格走势"><SkeletonBlock className="h-80" /></SkeletonPanel>
    </div>
  );
}
