"""
腾讯财经实时行情数据客户端

直接调用国内免费公开行情接口：
- 腾讯财经实时行情 (http://qt.gtimg.cn/)
- 腾讯财经分钟线数据 (http://ifzq.gtimg.cn/)
"""
from __future__ import annotations
import asyncio
import json
import time
import pandas as pd
import requests


def _ts() -> str:
    """返回当前毫秒时间戳用于防缓存"""
    return str(int(time.time() * 1000))


class TencentQuoteClient:
    """腾讯财经实时行情接口"""
    BASE = "http://qt.gtimg.cn/"

    @staticmethod
    async def get_quotes(codes: list[str]) -> pd.DataFrame:
        """获取多只股票报价，返回DataFrame"""
        symbols = ",".join(f"sz{code}" for code in codes)
        url = f"{TencentQuoteClient.BASE}q={symbols}&_={_ts()}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "*/*",
            "Referer": "https://finance.qq.com/",
        }
        resp = await asyncio.to_thread(requests.get, url, headers=headers, timeout=12)
        resp.encoding = "gbk"
        text = resp.text
        records = []

        for line in text.strip().split("\n"):
            if "=" not in line:
                continue
            try:
                name_part, data_part = line.split('="', 1)
                code_str = name_part.split("_")[-1]
                code = code_str[2:]
                fields = data_part.strip('";').split("~")
                if len(fields) < 49:
                    continue

                records.append({
                    "代码": code,
                    "名称": fields[1],
                    "最新价": float(fields[3]) if fields[3] else 0,
                    "昨收": float(fields[4]) if fields[4] else 0,
                    "今开": float(fields[5]) if fields[5] else 0,
                    "成交量": float(fields[6]) if fields[6] else 0,
                    "最高": float(fields[33]) if fields[33] else 0,
                    "最低": float(fields[34]) if fields[34] else 0,
                    "成交额": float(fields[37]) if fields[37] else 0,
                    "涨跌额": float(fields[31]) if fields[31] else 0,
                    "涨跌幅": float(fields[32]) if fields[32] else 0,
                    "换手率": float(fields[38]) if fields[38] else 0,
                    "量比": float(fields[49]) if len(fields) > 49 and fields[49] else 0,
                })
            except (ValueError, IndexError):
                continue

        if not records:
            return pd.DataFrame()
        return pd.DataFrame(records)


class TencentMinuteClient:
    """腾讯财经分钟线数据客户端"""

    @staticmethod
    async def get_minute_bars(code: str) -> pd.DataFrame:
        """
        获取单只股票当日分钟线数据
        返回格式: 时间, 代码, 开盘, 最高, 最低, 收盘, 成交量, 成交额
        """
        url = f"http://ifzq.gtimg.cn/appstock/app/minute/query?_var=min_data&code=sz{code}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "*/*",
            "Referer": "https://gu.qq.com/",
        }
        resp = await asyncio.to_thread(requests.get, url, headers=headers, timeout=10)
        text = resp.text

        prefix = "min_data="
        start = text.find(prefix)
        if start == -1:
            return pd.DataFrame()
        start += len(prefix)

        try:
            payload = json.loads(text[start:])
            stock_key = f"sz{code}"
            data_list = (
                payload.get("data", {})
                .get(stock_key, {})
                .get("data", {})
                .get("data", [])
            )
        except json.JSONDecodeError:
            return pd.DataFrame()

        if not data_list:
            return pd.DataFrame()

        records = []
        today = time.strftime("%Y-%m-%d")

        for entry in data_list:
            try:
                parts = entry.split(" ")
                if len(parts) < 4:
                    continue
                time_str = parts[0].strip()
                price = float(parts[1])
                volume = float(parts[2])
                amount = float(parts[3])
                if len(time_str) != 4:
                    continue

                records.append({
                    "时间": f"{today} {time_str[:2]}:{time_str[2:]}",
                    "代码": code,
                    "开盘": price,
                    "最高": price,
                    "最低": price,
                    "收盘": price,
                    "成交量": volume,
                    "成交额": amount,
                })
            except (ValueError, IndexError):
                continue

        return pd.DataFrame(records)