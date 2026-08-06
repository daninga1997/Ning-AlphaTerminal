export type TradingDayCalendar = {
  nextTradingDay(afterTradingDate: string): string | null;
};

export type T1CalendarInput = {
  acquiredTradingDate: string;
  calendar: TradingDayCalendar;
};

export function getNextSellableTradingDay(input: T1CalendarInput): string {
  if (!isCanonicalTradingDate(input.acquiredTradingDate)) {
    throw new Error("TRADING_DATE_INVALID");
  }

  const nextTradingDay = input.calendar.nextTradingDay(
    input.acquiredTradingDate,
  );

  if (nextTradingDay === null) {
    throw new Error("NEXT_TRADING_DAY_UNAVAILABLE");
  }

  if (
    !isCanonicalTradingDate(nextTradingDay) ||
    nextTradingDay <= input.acquiredTradingDate
  ) {
    throw new Error("NEXT_TRADING_DAY_INVALID");
  }

  return nextTradingDay;
}

function isCanonicalTradingDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);

  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
