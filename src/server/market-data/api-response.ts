import { NextResponse } from "next/server";
import type { MarketDataMeta, MarketDataResult } from "../../types/market-data";
import { MarketDataError } from "./market-data-errors";

export function marketDataJson<T>(result: MarketDataResult<T>) {
  if (result.success) {
    return NextResponse.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: result.error,
    },
    { status: 500 },
  );
}

export function errorJson(error: unknown) {
  if (error instanceof MarketDataError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode },
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "MARKET_DATA_API_ERROR",
        message: "行情接口异常",
      },
    },
    { status: 500 },
  );
}

export function metaJson<T>(data: T, meta: MarketDataMeta) {
  return NextResponse.json({ success: true, data, meta });
}
