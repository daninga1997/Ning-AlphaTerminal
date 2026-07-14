from __future__ import annotations

import re

from .errors import AkshareServiceError

_ALLOWED_CODE = re.compile(r"^(000|001|002)\d{3}$")


def validate_stock_code(code: str) -> str:
  if not _ALLOWED_CODE.fullmatch(code):
    raise AkshareServiceError("INVALID_STOCK_CODE", "股票代码无效，仅支持000、001、002开头的深圳主板代码", 400)
  return code


def to_akshare_symbol(code: str) -> str:
  return validate_stock_code(code)


def to_alpha_code(symbol: str) -> str:
  return validate_stock_code(symbol)
