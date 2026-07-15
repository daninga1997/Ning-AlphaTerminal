import type { StockQuote } from "../../../types/market-data";
import type { DataIntegrityIssue, DataIntegrityIssueCode } from "../../../types/data-integrity";

export interface QuoteValidationResult {
  isValid: boolean;
  issues: DataIntegrityIssue[];
}

/**
 * 报价数据字段完整性校验
 */
export function validateQuote(quote: StockQuote | null | undefined, expectedTradingDate: string): QuoteValidationResult {
  const issues: DataIntegrityIssue[] = [];

  if (!quote) {
    issues.push(critical("QUOTE_MISSING", "报价数据缺失"));
    return { isValid: false, issues };
  }

  // code
  if (!quote.code || typeof quote.code !== "string" || quote.code.length !== 6) {
    issues.push(critical("PRICE_INVALID", `股票代码无效: ${quote.code}`));
  }

  // price
  if (typeof quote.price !== "number" || !isFinite(quote.price) || quote.price <= 0) {
    issues.push(critical("PRICE_INVALID", `价格无效: ${quote.price}`));
  }

  // previousClose
  if (typeof quote.previousClose !== "number" || !isFinite(quote.previousClose) || quote.previousClose <= 0) {
    issues.push(critical("PRICE_INVALID", `昨收无效: ${quote.previousClose}`));
  }

  // OHLC 逻辑校验
  if (quote.high < quote.low) {
    issues.push(critical("OHLC_INVALID", `最高价(${quote.high}) < 最低价(${quote.low})`));
  }
  if (quote.high < quote.open || quote.high < quote.price) {
    issues.push(critical("OHLC_INVALID", `最高价(${quote.high}) < 开盘价或最新价`));
  }
  if (quote.low > quote.open || quote.low > quote.price) {
    issues.push(critical("OHLC_INVALID", `最低价(${quote.low}) > 开盘价或最新价`));
  }

  // marketTimestamp
  if (!quote.marketTimestamp) {
    issues.push(critical("MARKET_TIMESTAMP_MISSING", "marketTimestamp缺失"));
  } else {
    const quoteDate = extractDate(quote.marketTimestamp);
    if (quoteDate !== expectedTradingDate) {
      issues.push(critical("WRONG_TRADING_DATE", `报价日期(${quoteDate})与预期交易日(${expectedTradingDate})不一致`));
    }
  }

  // source
  if (!quote.source) {
    issues.push(warning("PROVIDER_UNAVAILABLE", "报价来源缺失"));
  }

  // status
  if (quote.status === "unavailable") {
    issues.push(critical("QUOTE_MISSING", "报价状态为unavailable"));
  }

  // volume
  if (typeof quote.volume !== "number" || quote.volume < 0 || !isFinite(quote.volume)) {
    issues.push(warning("VOLUME_INVALID", `成交量无效: ${quote.volume}`));
  }

  return {
    isValid: issues.filter((i) => i.isCritical).length === 0,
    issues,
  };
}

function extractDate(iso: string): string {
  return iso.slice(0, 10);
}

function critical(code: DataIntegrityIssueCode, message: string): DataIntegrityIssue {
  return { code, message, isCritical: true };
}

function warning(code: DataIntegrityIssueCode, message: string): DataIntegrityIssue {
  return { code, message, isCritical: false };
}