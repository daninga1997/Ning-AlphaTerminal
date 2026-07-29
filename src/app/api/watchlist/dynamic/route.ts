import { NextResponse } from "next/server";
import type { StrategyAction } from "@/types/strategy-action";
import { upsertDynamicEntry, getAllDynamicEntries, getEntryCount } from "@/server/watchlist-storage/dynamic-watchlist-repository";
import { computeSignalValidUntil } from "@/server/watchlist-storage/signal-validity";

/**
 * GET /api/watchlist/dynamic
 * 返回全部动态观察池条目
 */
export async function GET() {
  const entries = getAllDynamicEntries();
  return NextResponse.json({ success: true, data: entries, count: getEntryCount() });
}

/**
 * POST /api/watchlist/dynamic
 * 写入/更新动态观察池条目（幂等UPSERT）
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, name, action, blockers, conclusion, analysisDate, hvPercentile } = body as {
      code: string;
      name: string;
      action: StrategyAction;
      blockers: string[];
      conclusion: string;
      analysisDate: string;
      hvPercentile?: number | null;
    };

    if (!code || !/^(000|001|002)\d{3}$/.test(code)) {
      return NextResponse.json({ success: false, error: "无效的股票代码" }, { status: 400 });
    }

    const signalValidUntil = computeSignalValidUntil(
      action,
      new Date(analysisDate),
      hvPercentile ?? null,
    );

    // 指数退避重试（最多3次）
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
    const entry = await upsertDynamicEntry({
      code,
      name,
          lastAction: action,
          dataBlockers: blockers ?? [],
          lastConclusion: conclusion,
          lastAnalysisDate: analysisDate,
          signalValidUntil,
        });

        return NextResponse.json({ success: true, data: entry });
      } catch (err) {
        lastError = err as Error;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
        }
      }
    }

    return NextResponse.json(
      { success: false, error: "自动加入观察池失败（数据库写入异常）" },
      { status: 500 },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "请求格式无效" },
      { status: 400 },
    );
  }
}