from app.search_parser import parse_szse_mainboard_hints


def test_keeps_only_szse_mainboard_results():
    raw = 'v_hint="sz~002594~比亚迪~byd~GP-A^sh~600519~贵州茅台~mt~GP-A^sz~300750~宁德时代~ndsd~GP-A"'

    assert parse_szse_mainboard_hints(raw) == [
        {
            "code": "002594",
            "name": "比亚迪",
            "exchange": "SZSE",
            "source": "tencent_smartbox",
        },
    ]


def test_returns_empty_list_for_missing_or_unsupported_hints():
    assert parse_szse_mainboard_hints('v_hint="hk~01211~比亚迪股份~byd~GP"') == []
    assert parse_szse_mainboard_hints("") == []
