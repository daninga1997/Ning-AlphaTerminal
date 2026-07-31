"use client";

import { AppShell } from "../../../components/layout/app-shell";

export default function StockDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return (
    <AppShell>
      <section className="mx-auto max-w-3xl rounded-lg border border-rose-400/25 bg-[#111318] p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-200/70">Detail Unavailable</p>
        <h1 className="mt-3 text-2xl font-semibold text-[#F4F7FB]">详情页暂时无法加载</h1>
        <p className="mt-3 text-sm leading-6 text-[#8B95A7]">当前数据请求未完成。请重新加载本页；交易记录和观察池不会因此被修改。</p>
        <button
          className="mt-6 inline-flex h-10 items-center rounded-md border border-rose-400/30 bg-rose-400/10 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20"
          onClick={reset}
          type="button"
        >
          重新加载
        </button>
      </section>
    </AppShell>
  );
}
