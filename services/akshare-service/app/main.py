from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .akshare_client import AkShareClient
from .cache import TTLCache
from .config import Settings, get_settings
from .errors import AkshareServiceError, normalize_error
from .models import error_response
from .quote_circuit import QuoteCircuitBreaker
from .quote_strategy import AkShareQuoteStrategy
from .routers import daily_bars, health, minute_bars, quotes


def create_app(client=None, settings: Settings | None = None, quote_strategy=None) -> FastAPI:
  settings = settings or get_settings()
  app = FastAPI(title="Alpha Terminal AKShare Service", version="1.0.0")
  app.state.settings = settings
  app.state.client = client or AkShareClient(settings)
  app.state.quote_strategy = quote_strategy or AkShareQuoteStrategy(client=app.state.client)
  app.state.quote_circuit = QuoteCircuitBreaker(
    failure_threshold=settings.quote_circuit_failure_threshold,
    open_seconds=settings.quote_circuit_open_seconds,
  )
  app.state.cache = TTLCache()
  app.state.last_success_at = None
  app.state.daily_bars_last_success_at = None
  app.state.daily_bars_last_failure_at = None
  app.state.minute_bars_last_success_at = None
  app.state.minute_bars_last_failure_at = None

  app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
  )

  @app.exception_handler(AkshareServiceError)
  async def akshare_error_handler(_: Request, error: AkshareServiceError):
    return JSONResponse(error_response(error.code, error.message, extra_meta=error.details), status_code=error.status_code)

  @app.exception_handler(Exception)
  async def generic_error_handler(_: Request, error: Exception):
    normalized = normalize_error(error)
    return JSONResponse(error_response(normalized.code, normalized.message), status_code=normalized.status_code)

  app.include_router(health.router)
  app.include_router(quotes.router)
  app.include_router(daily_bars.router)
  app.include_router(minute_bars.router)
  return app


app = create_app()
