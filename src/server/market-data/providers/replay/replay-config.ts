import path from "node:path";

export const replayConfig = {
  dataDir: path.join(process.cwd(), "data", "replay"),
  initialTime: "2026-07-14T09:30:00+08:00",
  source: "csv-replay-provider",
} as const;

export type ReplaySpeed = "1x" | "5x" | "20x" | "max";
