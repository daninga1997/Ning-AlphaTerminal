"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchHint = {
  code: string;
  name: string;
};

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHint[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchStocks = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    try {
      const resp = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`);
      const payload = await resp.json();
      if (payload.success && Array.isArray(payload.data)) {
        setResults(payload.data.slice(0, 10) as SearchHint[]);
        setOpen(true);
      } else {
        setResults([]);
        setOpen(false);
      }
    } catch {
      setOpen(false);
    }
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <input
        autoComplete="off"
        className="h-10 w-60 rounded-md border border-[#252A33] bg-[#090A0D] px-3 text-sm text-[#F4F7FB] outline-none placeholder:text-[#586174] focus:border-cyan-300"
        id="global-search-input"
        onChange={(e) => {
          setQuery(e.target.value);
          searchStocks(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && /^\d{6}$/.test(query)) {
            router.push(`/stocks/${query}`);
            setOpen(false);
          }
        }}
        placeholder="搜索深市股票，输代码回车直达"
        type="text"
        value={query}
      />
      {open && (
        <ul className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-[#252A33] bg-[#090A0D] shadow-lg">
          {results.length > 0 ? (
            results.map((r) => (
              <li
                key={r.code}
                className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-white/10"
                onClick={() => {
                  router.push(`/stocks/${r.code}`);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="text-[#F4F7FB]">{r.name}</span>
                <span className="font-mono text-xs text-[#586174]">{r.code}</span>
              </li>
            ))
          ) : /^\d{6}$/.test(query) && !/^(000|001|002|003)\d{3}$/.test(query) ? (
            <li className="px-3 py-2 text-sm text-amber-200">仅支持深市主板（000/001/002/003 开头）</li>
          ) : (
            <li className="px-3 py-2 text-sm text-[#8B95A7]">没有找到匹配的深市主板股票</li>
          )}
        </ul>
      )}
    </div>
  );
}
