import { NextResponse } from "next/server";
import iconv from "iconv-lite";

const SEARCH_URL = "https://smartbox.gtimg.cn/s3/";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  if (!query || query.length < 1) return NextResponse.json({ success: true, data: [], meta: {} });

  try {
    const resp = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(query)}&t=all`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(8000),
    });
    const buf = await resp.arrayBuffer();
    const raw = iconv.decode(Buffer.from(buf), "gbk");

    // smartbox format: v_hint="sh~code~name~...^sz~code~name~...^jj~code~name~..."
    // sz~ 可能出现在开头（v_hint=" 之后）或 ^ 之后，因此直接匹配任意位置的 sz 段
    const re = /sz~(\d{6})~([^~]+)~/g;
    const data: { code: string; name: string }[] = [];
    for (const m of raw.matchAll(re)) {
      if (/^(000|001|002|003)\d{3}$/.test(m[1])) {
        data.push({ code: m[1], name: m[2] });
      }
    }
    return NextResponse.json({ success: true, data: data.slice(0, 10), meta: { source: "tencent" } });
  } catch {
    return NextResponse.json({ success: false, error: "搜索服务暂不可用" }, { status: 503 });
  }
}
