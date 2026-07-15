import { writeFile, appendFile, mkdir } from "fs/promises";
import { join } from "path";
import type { IntegrityAuditEntry } from "../../types/data-integrity";

const LOG_DIR = join(process.cwd(), "data", "integrity-logs");
const MAX_AGE_DAYS = 30;

/**
 * 写入完整性审计日志（JSONL格式）
 *
 * 写入失败不影响行情页面。
 * 不记录完整行情、密钥、用户隐私。
 * 日志不得提交Git（已在.gitignore中）。
 */
export async function writeAuditLog(entry: IntegrityAuditEntry): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    const dateStr = entry.validatedAt.slice(0, 10);
    const filePath = join(LOG_DIR, `integrity-${dateStr}.jsonl`);
    const line = JSON.stringify(entry) + "\n";
    await appendFile(filePath, line, "utf-8");
  } catch {
    // 写入失败不影响行情页面
  }
}

/**
 * 读取指定日期的审计日志
 */
export async function readAuditLogs(dateStr: string): Promise<IntegrityAuditEntry[]> {
  try {
    const filePath = join(LOG_DIR, `integrity-${dateStr}.jsonl`);
    const content = await import("fs").then((fs) => fs.readFileSync(filePath, "utf-8"));
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as IntegrityAuditEntry);
  } catch {
    return [];
  }
}

/**
 * 获取最近审计日志摘要（供Settings页面显示）
 */
export async function getRecentAuditSummary(limit = 10): Promise<
  Array<{
    validatedAt: string;
    code: string;
    status: string;
    completenessPercent: number;
  }>
> {
  const now = new Date();
  const results: Array<{
    validatedAt: string;
    code: string;
    status: string;
    completenessPercent: number;
  }> = [];

  for (let i = 0; i < MAX_AGE_DAYS && results.length < limit; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    try {
      const logs = await readAuditLogs(dateStr);
      for (const log of logs) {
        if (results.length >= limit) break;
        results.push({
          validatedAt: log.validatedAt,
          code: log.code,
          status: log.status,
          completenessPercent: log.completenessPercent,
        });
      }
    } catch {
      continue;
    }
  }

  return results;
}

/**
 * 导出审计日志为CSV
 */
export async function exportAuditCsv(startDate: string, endDate: string): Promise<string> {
  const lines: string[] = ["validatedAt,code,analysisTradingDate,status,permission,completenessPercent,issueCodes,sources"];
  // TODO: implement full export
  return lines.join("\n");
}