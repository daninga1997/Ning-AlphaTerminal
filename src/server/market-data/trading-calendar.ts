const holidaySet = new Set<string>([]);

export function isConfiguredHoliday(date: string): boolean {
  return holidaySet.has(date);
}
