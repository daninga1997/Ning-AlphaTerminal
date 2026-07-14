import { NextResponse } from "next/server";
import { TradingMemoryError } from "./trading-memory-errors";

export function memorySuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function memoryError(error: unknown) {
  if (error instanceof TradingMemoryError) {
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
        code: "TRADING_MEMORY_ERROR",
        message: "交易记忆服务异常",
      },
    },
    { status: 500 },
  );
}
