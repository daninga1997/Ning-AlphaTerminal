import pytest

from app.errors import AkshareServiceError
from app.symbol_utils import to_akshare_symbol, to_alpha_code, validate_stock_code


def test_accepts_only_shenzhen_main_board_codes():
    assert validate_stock_code("002472") == "002472"
    assert validate_stock_code("000661") == "000661"
    assert validate_stock_code("001234") == "001234"


@pytest.mark.parametrize("code", ["603228", "300750", "abc123", "00247", "002472.sz"])
def test_rejects_non_shenzhen_main_board_codes(code):
    with pytest.raises(AkshareServiceError) as error:
        validate_stock_code(code)

    assert error.value.code == "INVALID_STOCK_CODE"


def test_symbol_conversion_is_centralized():
    assert to_akshare_symbol("002472") == "002472"
    assert to_alpha_code("002472") == "002472"
