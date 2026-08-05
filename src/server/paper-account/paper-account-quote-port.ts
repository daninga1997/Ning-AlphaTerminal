import type { PriceFen } from "@/lib/paper-account/paper-account-types";

export type PaperAccountQuoteStatus =
  | "fresh"
  | "delayed"
  | "stale"
  | "unavailable";

export type PaperAccountQuote = {
  priceFen: PriceFen;
  status: PaperAccountQuoteStatus;
  observedAt: string;
};

export type PaperAccountQuoteReader = {
  getLatestQuotes(
    codes: string[],
  ): Promise<ReadonlyMap<string, PaperAccountQuote>>;
};