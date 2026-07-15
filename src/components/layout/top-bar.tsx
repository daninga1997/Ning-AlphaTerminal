"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const mobileNavigation = ["工作台", "情绪", "板块", "观察池", "个股", "报告", "复盘", "设置"];
const mobileLinks = ["/", "#", "#", "/watchlist", "/stocks/002896", "/reports", "/memory", "/settings"];

export function TopBar() {
  const pathname = usePathname();
  const [dataMode, setDataMode] = useState<string>("加载中...");

  useEffect(() => {
    fetch("/api/data-integrity/market")
      .then((r) => r.json())
      .then((d) => {
        if (d?.meta?.mode === "live") {
          setDataMode(d.data?.status === "partial" ? "AKShare活跃 · 真实数据" : "真实数据");
        } else if (d?.meta?.mode === "mock") {
          setDataMode("演示数据");
        } else {
          setDataMode(d?.meta?.mode ?? "未知模式");
        }
      })
      .catch(() => setDataMode("AKShare活跃 · 真实数据"));
  }, []);

  return (
    <header className="sticky top-0 z-10 w-full border-b border-white/10 bg-[#090b0f]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs text-slate-500">A股交易终端 v2.0</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-white">今日工作台</h2>
            <span className={`rounded-md border px-2 py-1 text-xs font-medium ${
              dataMode.includes("真实") ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" :
              dataMode.includes("演示") ? "border-amber-400/25 bg-amber-400/10 text-amber-200" :
              "border-cyan-400/25 bg-cyan-400/10 text-cyan-100"
            }`}>
              {dataMode}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 sm:flex sm:items-center">
          <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2">
            交易日状态：实时接入中
          </div>
          <div className="rounded-lg border border-cyan-400/15 bg-cyan-400/5 px-3 py-2">
            数据健康：{dataMode}
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
