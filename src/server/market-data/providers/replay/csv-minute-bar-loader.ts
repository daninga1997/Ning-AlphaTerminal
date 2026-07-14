import fs from "node:fs";
import path from "node:path";
import type { MinuteBar } from "../../../../types/market-data";
import { MarketDataError } from "../../market-data-errors";
import { assertValidMinuteBar } from "../../minute-bars";
import { replayConfig } from "./replay-config";

export function loadReplayMinuteBars(code: string): MinuteBar[] {
  const filePath = path.join(replayConfig.dataDir, `${code}.csv`);
  if (!fs.existsSync(filePath)) {
    throw new MarketDataError("REPLAY_FILE_NOT_FOUND", "回放CSV文件不存在", 404);
  }
  const [header, ...lines] = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
  if (header !== "timestamp,open,high,low,close,volume,amount") {
    throw new MarketDataError("INVALID_REPLAY_CSV", "回放CSV表头无效", 500);
  }
  return lines.map((line) => {
    const [timestamp, open, high, low, close, volume, amount] = line.split(",");
    const closeNumber = Number(close);
    const volumeNumber = Number(volume);
    const amountNumber = Number(amount);
    const bar: MinuteBar = {
      code,
      timestamp,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: closeNumber,
      volume: volumeNumber,
      amount: amountNumber,
      averagePrice: volumeNumber > 0 ? amountNumber / volumeNumber : closeNumber,
      previousClose: Number(open),
      source: replayConfig.source,
      receivedAt: replayConfig.initialTime,
      status: "historical_replay",
      isDemo: true,
      isReplay: true,
    };
    assertValidMinuteBar(bar);
    return bar;
  });
}
