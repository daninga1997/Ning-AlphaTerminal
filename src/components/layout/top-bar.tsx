"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mobileNavigation = ["工作台", "情绪", "板块", "观察池", "报告", "复盘", "设置"];
const mobileLinks = ["/", "#", "#", "/watchlist", "#", "#", "#"];

export function TopBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 w-full border-b border-white/10 bg-[#090b0f]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs text-slate-500">第一阶段 UI 框架</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-white">今日工作台</h2>
            <span className="rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
              Mock 数据
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 sm:flex sm:items-center">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            交易日状态：待接入
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            数据健康：占位
          </div>
        </div>
      </div>
      <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {mobileNavigation.map((item, index) => (
          <Link
            className={`h-9 shrink-0 rounded-lg px-3 text-sm ${
              mobileLinks[index] === pathname
                ? "bg-cyan-400/12 text-cyan-200"
                : "bg-white/5 text-slate-300"
            }`}
            href={mobileLinks[index] ?? "#"}
            key={item}
          >
            {item}
          </Link>
        ))}
      </nav>
    </header>
  );
}
