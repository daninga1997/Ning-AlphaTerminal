import re
from typing import TypedDict

_HINT_PATTERN = re.compile(r'v_hint="(?P<hints>.*)"', re.DOTALL)
_SZSE_MAINBOARD = re.compile(r"^(000|001|002)\d{3}$")
_UNICODE_ESCAPE = re.compile(r"\\u([0-9a-fA-F]{4})")


class SearchCandidate(TypedDict):
    code: str
    name: str
    exchange: str
    source: str


def _decode_unicode_escapes(value: str) -> str:
    return _UNICODE_ESCAPE.sub(lambda match: chr(int(match.group(1), 16)), value)


def parse_szse_mainboard_hints(payload: str, limit: int = 10) -> list[SearchCandidate]:
    match = _HINT_PATTERN.search(payload)
    if not match:
        return []

    results: list[SearchCandidate] = []
    seen: set[str] = set()
    for hint in match.group("hints").split("^"):
        fields = hint.split("~")
        if len(fields) < 3:
            continue

        market, code, name = fields[0].lower(), fields[1], _decode_unicode_escapes(fields[2])
        if market != "sz" or not _SZSE_MAINBOARD.fullmatch(code) or code in seen:
            continue

        seen.add(code)
        results.append(
            {
                "code": code,
                "name": name,
                "exchange": "SZSE",
                "source": "tencent_smartbox",
            },
        )
        if len(results) == limit:
            break

    return results
