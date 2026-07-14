import { MarketDataError } from "../../market-data-errors";
import { akshareServiceUnavailable } from "./akshare-provider-errors";

type AkShareSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

type AkShareFailure = {
  success: false;
  error?: {
    code?: string;
    message?: string;
  };
};

export type AkShareApiResponse<T> = AkShareSuccess<T> | AkShareFailure;

export type AkShareApiClientOptions = {
  baseUrl: string;
  timeoutMs: number;
  fetcher?: typeof fetch;
};

export class AkShareApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(options: AkShareApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs;
    this.fetcher = options.fetcher ?? fetch;
  }

  async get<T>(path: string): Promise<AkShareSuccess<T>> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw akshareServiceUnavailable();
    }

    const payload = (await response.json().catch(() => null)) as AkShareApiResponse<T> | null;
    if (!response.ok || !payload?.success) {
      const code = payload && "error" in payload ? payload.error?.code : undefined;
      const message = payload && "error" in payload ? payload.error?.message : undefined;
      throw new MarketDataError(code ?? "AKSHARE_SERVICE_ERROR", message ?? "AKShare服务返回异常", response.status || 502);
    }
    return payload;
  }
}
