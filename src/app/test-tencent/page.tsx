"use client";

import { useEffect, useState } from "react";
import {
  assessTencentQuoteResponse,
  type TencentQuoteApiResponse,
} from "@/components/tencent-quote-test/tencent-quote-validation";
import type { StockQuote } from "@/types/market-data";

const quoteUrl = "/api/market/quotes?codes=002472,002317";

export default function TencentVerificationPage() {
  const [response, setResponse] = useState<TencentQuoteApiResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuotes() {
      try {
        const result = await fetch(quoteUrl, { cache: "no-store" });
        const payload = (await result.json()) as TencentQuoteApiResponse;
        setResponse(payload);
      } catch {
        setRequestError("Next 到腾讯服务不可用");
      }
    }

    void loadQuotes();
  }, []);

  const verification = response ? assessTencentQuoteResponse(response) : null;
  const quotes = response?.success ? response.data : [];
  const message = verification
    ? verification.ok
      ? "验证通过：腾讯真实报价已到达前端"
      : `验证未通过：${verification.reason}`
    : requestError ?? "正在请求同源行情 API...";
  const messageClass = verification?.ok ? "text-[#33C481]" : requestError || verification ? "text-[#FF7070]" : "text-[#8B95A7]";

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10 text-[#F4F7FB]">
      <header>
        <h1 className="text-2xl font-semibold">腾讯报价端到端验证</h1>
        <p className="mt-2 text-sm text-[#8B95A7]">
          仅用于确认 FastAPI、Next.js API 与浏览器展示链路；不修改交易终端主页面。
        </p>
      </header>

      <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
        <p className={messageClass}>{message}</p>
        {response?.success ? <ResponseMetadata response={response} /> : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {quotes.map((quote) => <QuoteCard key={quote.code} quote={quote} />)}
      </section>

      {response ? (
        <pre className="overflow-x-auto rounded-lg border border-[#252A33] bg-[#090A0D] p-5 text-xs text-[#C7CEDA]">
          {JSON.stringify(response, null, 2)}
        </pre>
      ) : null}
    </main>
  );
}

function ResponseMetadata({ response }: { response: Extract<TencentQuoteApiResponse, { success: true }> }) {
  return (
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-[#8B95A7]">来源</dt>
        <dd>{response.meta.source}</dd>
      </div>
      <div>
        <dt className="text-[#8B95A7]">模式</dt>
        <dd>{response.meta.mode ?? "-"}</dd>
      </div>
      <div>
        <dt className="text-[#8B95A7]">状态</dt>
        <dd>{response.meta.status}</dd>
      </div>
      <div>
        <dt className="text-[#8B95A7]">服务接收时间</dt>
        <dd>{response.meta.receivedAt}</dd>
      </div>
    </dl>
  );
}

function QuoteCard({ quote }: { quote: StockQuote }) {
  return (
    <article className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <p className="text-sm text-[#8B95A7]">{quote.code}</p>
      <h2 className="mt-1 text-lg font-semibold">{quote.name}</h2>
      <p className="mt-5 text-2xl font-semibold">{quote.price.toFixed(2)}</p>
      <p className="mt-1 text-sm text-[#8B95A7]">
        涨跌幅 {quote.changePercent.toFixed(2)}% · {quote.marketTimestamp || "上游未提供有效盘中时间"}
      </p>
    </article>
  );
}
