import type { SectorSnapshot } from "../../../types/market-data";
import type { DataIntegrityIssue, DataIntegrityIssueCode } from "../../../types/data-integrity";

export interface SectorValidationResult {
  isValid: boolean;
  issues: DataIntegrityIssue[];
  sectorNames: string[];
}

/**
 * 板块快照数据字段完整性校验
 */
export function validateSectors(
  sectors: SectorSnapshot[] | null | undefined,
  expectedTradingDate: string,
): SectorValidationResult {
  const issues: DataIntegrityIssue[] = [];
  const sectorNames: string[] = [];

  if (!sectors || sectors.length === 0) {
    issues.push(warn("SECTOR_DATA_MISSING", "板块数据缺失"));
    return { isValid: true, issues, sectorNames: [] };
  }

  for (const sector of sectors) {
    sectorNames.push(sector.name);

    // 日期检查
    if (sector.marketTimestamp) {
      const sectorDate = extractDate(sector.marketTimestamp);
      if (sectorDate !== expectedTradingDate) {
        issues.push(warn("WRONG_TRADING_DATE", `${sector.name}: 日期(${sectorDate})与预期(${expectedTradingDate})不一致`));
      }
    }

    // strengthScore
    if (typeof sector.strengthScore !== "number" || sector.strengthScore < 0 || sector.strengthScore > 100) {
      issues.push(warn("PRICE_INVALID", `${sector.name}: strengthScore无效: ${sector.strengthScore}`));
    }

    // source
    if (!sector.source) {
      issues.push(warn("PROVIDER_UNAVAILABLE", `${sector.name}: 来源缺失`));
    }
  }

  return {
    isValid: issues.filter((i) => i.isCritical).length === 0,
    issues,
    sectorNames,
  };
}

function warn(code: DataIntegrityIssueCode, message: string): DataIntegrityIssue {
  return { code, message, isCritical: false };
}

function extractDate(iso: string): string {
  return iso.slice(0, 10);
}
