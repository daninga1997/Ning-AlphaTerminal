type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class MarketDataCache {
  private readonly values = new Map<string, CacheEntry<unknown>>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly lastSuccess = new Map<string, unknown>();

  async getOrLoad<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = this.values.get(key);
    if (cached && cached.expiresAt > now) return cached.value as T;

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const pending = loader()
      .then((value) => {
        this.values.set(key, { value, expiresAt: Date.now() + ttlMs });
        this.lastSuccess.set(key, value);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });
    this.inflight.set(key, pending);
    return pending;
  }

  async getOrLoadWithFallback<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
  ): Promise<{ value: T; fromFallback: boolean }> {
    try {
      const value = await this.getOrLoad(key, ttlMs, loader);
      return { value, fromFallback: false };
    } catch (error) {
      const fallback = this.getLastSuccess<T>(key);
      if (fallback) return { value: fallback, fromFallback: true };
      throw error;
    }
  }

  getLastSuccess<T>(key: string): T | null {
    return (this.lastSuccess.get(key) as T | undefined) ?? null;
  }
}
