"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const navigationItems = [
  { label: "策略回测", href: "/backtest" },
  { label: "模拟交易", href: "/paper-trades" },
  { label: "今日工作台", href: "/" },
  { label: "市场情绪", href: "#" },
  { label: "主线板块", href: "#" },
  { label: "核心观察池", href: "/watchlist" },
  { label: "个股详情", href: "#" },
  { label: "四类报告", href: "/reports" },
  { label: "交易记忆", href: "/memory" },
  { label: "数据与设置", href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white px-4 py-5 dark:border-white/10 dark:bg-[#0d1118] lg:flex lg:flex-col">
      <div className="mb-8">
        <div className="text-sm text-gray-500">A股交易终端</div>
        <h1 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">深圳主板观察台</h1>
      </div>
      <nav className="space-y-1 flex-1">
        {navigationItems.map((item) => (
          <Link
            className={`flex h-10 w-full items-center rounded-lg px-3 text-left text-sm transition ${
              item.href === pathname
                ? "bg-cyan-400/12 text-cyan-600 dark:text-cyan-200 ring-1 ring-cyan-300/20"
                : "text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-white/6 dark:hover:text-slate-100"
            }`}
            href={item.href}
            key={item.label}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {mounted && (
        <button
          className="mt-4 flex h-10 w-full items-center rounded-lg px-3 text-left text-sm text-gray-500 transition hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-white/6 dark:hover:text-slate-100"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "☀️ 白天" : "🌙 深夜"}
        </button>
      )}
    </aside>
  );
}
