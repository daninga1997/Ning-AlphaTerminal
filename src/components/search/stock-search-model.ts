const SZSE_MAINBOARD_CODE = /^(000|001|002)\d{3}$/;

export function shouldSearchStocks(query: string): boolean {
  const normalized = query.trim();
  return /^\d{6}$/.test(normalized) || Array.from(normalized).length >= 2;
}

export function isUnsupportedStockCode(query: string): boolean {
  const normalized = query.trim();
  return /^\d{6}$/.test(normalized) && !SZSE_MAINBOARD_CODE.test(normalized);
}
