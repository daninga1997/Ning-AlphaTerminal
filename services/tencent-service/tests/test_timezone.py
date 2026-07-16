from zoneinfo import ZoneInfo


def test_shanghai_timezone_is_available():
    assert ZoneInfo("Asia/Shanghai").key == "Asia/Shanghai"
