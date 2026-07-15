"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
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

  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0d1118] px-4 py-5 lg:block">
      <div className="mb-8">
        <div className="text-sm text-slate-400">A股交易终端</div>
        <h1 className="mt-2 text-xl font-semibold text-white">深圳主板观察台</h1>
      </div>
      <nav className="space-y-1">
        {navigationItems.map((item) => (
          <Link
            className={`flex h-10 w-full items-center rounded-lg px-3 text-left text-sm transition ${
              item.href === pathname
                ? "bg-cyan-400/12 text-cyan-200 ring-1 ring-cyan-300/20"
                : "text-slate-400 hover:bg-white/6 hover:text-slate-100"
            }`}
            href={item.href}
            key={item.label}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
