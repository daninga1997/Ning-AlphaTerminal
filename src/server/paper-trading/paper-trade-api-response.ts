import { NextResponse } from "next/server";
import { PaperTradeError } from "./paper-trade-runtime";

export function paperTradeErrorResponse(error: unknown) {
  if (error instanceof PaperTradeError) return errorResponse(error.code, error.status);
  if (error instanceof Error && error.message === "INVALID_PAPER_TRADE_FILTER") {
    return errorResponse("INVALID_PAPER_TRADE_FILTER", 400);
  }
  return errorResponse("PAPER_TRADE_UNAVAILABLE", 503);
}

export function paperTradeSuccess(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function errorResponse(code: string, status: number) {
  return NextResponse.json({ success: false, error: { code } }, { status });
}

