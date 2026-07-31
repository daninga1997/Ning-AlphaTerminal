/**
 * 批量策略研究：拉取深市主板股票的历史日线（腾讯行情服务），
 * 统计三套生产策略（收盘确认信号）在信号后 1/3/5/10 个交易日的收益、胜率，
 * 并与“全样本持有”基准对比。
 *
 * 用法：
 *   npm run signal:study                       # 观察池 20 只
 *   npm run signal:study 002472 002317         # 指定股票
 *
 * 前置：本地腾讯行情服务（services/tencent-service，:8001）已启动。
 */
import { watchlistCodes } from "../src/server/market-sync/sector-mapping";
import { fetchBacktestHistory } from "../src/lib/backtest/backtest-history";
import {
  evaluateStrategyStudy,
  mergeStudyResults,
  type ReturnStat,
  type SignalKind,
} from "../src/lib/research/signal-study";

const STRATEGIES: SignalKind[] = ["leader_first_yin", "late_session_daily", "trend_swing_compatible"];
const STRATEGY_NAMES: Record<SignalKind, string> = {
  leader_first_yin: "龙头首阴修复",
  late_session_daily: "尾盘趋势（收盘确认）",
  trend_swing_compatible: "趋势波段",
};

async function main(): Promise<void> {
  const requestedCodes = process.argv.slice(2);
  const codes = requestedCodes.length > 0 ? requestedCodes : watchlistCodes;
  const end = new Date().toISOString().slice(0, 10);
  const perStrategy: Record<SignalKind, ReturnStat[][]> = {
    leader_first_yin: [],
    late_session_daily: [],
    trend_swing_compatible: [],
  };
  let loadedCount = 0;

  for (const code of codes) {
    try {
      const history = await fetchBacktestHistory({ code, start: "2000-01-01", end });
      for (const strategy of STRATEGIES) {
        perStrategy[strategy].push(evaluateStrategyStudy(code, history.bars, strategy));
      }
      loadedCount += 1;
      console.log(`✓ ${code} 已载入 ${history.bars.length} 根日线`);
    } catch (error) {
      console.warn(`✗ ${code} 拉取失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (loadedCount === 0) {
    console.error("\n没有可用历史数据。请先启动本地腾讯行情服务（npm run tencent:service）。");
    process.exit(1);
  }

  console.log(`\n共 ${loadedCount} 只股票，基准 = 每个交易日次日开盘买入、持有 N 日收盘卖出。`);
  STRATEGIES.forEach((strategy) => {
    const merged = mergeStudyResults(perStrategy[strategy]);
    console.log(`\n== ${STRATEGY_NAMES[strategy]} ==`);
    console.table(
      merged.map((row) => ({
        持有交易日: row.horizon,
        信号数: row.signalCount,
        信号均值收益: `${row.meanReturnPercent}%`,
        信号胜率: `${row.winRatePercent}%`,
        基准均值收益: `${row.baselineMeanPercent}%`,
        基准胜率: `${row.baselineWinRatePercent}%`,
        超额收益: `${row.excessPercent}%`,
      })),
    );
  });

}

void main();
