import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";

export default function StockNotFound() {
  return (
    <AppShell>
      <section className="mx-auto max-w-3xl rounded-lg border border-[#252A33] bg-[#111318] p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
          Stock Not Found
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-[#F4F7FB]">股票不存在</h1>
        <p className="mt-3 text-sm leading-6 text-[#8B95A7]">
          股票代码格式无效或当前模式下无法获取该股票的演示数据（需要 6 位数字代码）。
        </p>
        <Link
          className="mt-6 inline-flex h-10 items-center rounded-md border border-[#252A33] bg-[#090A0D] px-4 text-sm font-semibold text-[#F4F7FB] hover:border-[#4F8CFF]/40"
          href="/watchlist"
        >
          返回观察池
        </Link>
      </section>
    </AppShell>
  );
}
