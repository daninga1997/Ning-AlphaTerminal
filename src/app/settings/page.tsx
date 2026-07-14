import { AppShell } from "@/components/layout/app-shell";
import { getLiveProviderConfig } from "@/server/market-data/providers/live/live-provider-config";
import { getMarketDataMode, getProvider } from "@/server/market-data/provider-registry";

export default async function SettingsPage() {
  const mode = getMarketDataMode();
  const liveConfig = getLiveProviderConfig();
  let providerName = "未配置";
  let healthStatus = "不可用";
  let minimumRefreshIntervalMs = liveConfig.minimumIntervalMs;
  const delaySeconds = 0;
  let isLicensedSource = false;
  let akshareVersion = "-";
  let lastSuccessAt = "-";
  let cacheStatus = "-";
  let disclaimer = "Mock/Replay 模式为演示数据；真实行情模式需确认数据来源授权与时效。";

  try {
    const provider = getProvider(mode);
    const health = await provider.healthCheck() as Awaited<ReturnType<typeof provider.healthCheck>> & {
      akshareVersion?: string;
      lastSuccessAt?: string | null;
      cache?: { entries?: number; lastSuccessEntries?: number };
      disclaimer?: string;
    };
    providerName = health.source;
    healthStatus = health.ok ? "健康" : "不可用";
    minimumRefreshIntervalMs = health.capabilities.minimumRefreshIntervalMs;
    isLicensedSource = health.capabilities.isLicensedSource;
    akshareVersion = health.akshareVersion ?? "-";
    lastSuccessAt = health.lastSuccessAt ?? "-";
    cacheStatus = health.cache
      ? `entries ${health.cache.entries ?? 0} / last ${health.cache.lastSuccessEntries ?? 0}`
      : "-";
    disclaimer = health.disclaimer ?? disclaimer;
  } catch {
    if (mode === "live") providerName = liveConfig.providerName || "真实行情供应商尚未配置";
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4">
        <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
            Settings
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#F4F7FB]">行情配置状态</h1>
          <p className="mt-3 text-sm leading-6 text-[#8B95A7]">
            只读状态展示。API 密钥只允许服务端环境变量读取，不在前端保存或显示。
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <SettingMetric label="当前行情模式" value={mode} />
          <SettingMetric label="Provider名称" value={providerName} />
          <SettingMetric label="健康状态" value={healthStatus} />
          <SettingMetric label="最小刷新间隔" value={`${minimumRefreshIntervalMs} ms`} />
          <SettingMetric label="当前延迟" value={`${delaySeconds} 秒`} />
          <SettingMetric label="是否正式授权数据源" value={isLicensedSource ? "是" : "否"} />
          <SettingMetric label="API密钥是否已配置" value={liveConfig.apiKeyConfigured ? "已配置" : "未配置"} />
          <SettingMetric label="AKShare版本" value={akshareVersion} />
          <SettingMetric label="最近成功请求" value={lastSuccessAt} />
          <SettingMetric label="缓存状态" value={cacheStatus} />
        </section>

        <section className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          {disclaimer}
        </section>
      </div>
    </AppShell>
  );
}

function SettingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#252A33] bg-[#111318] p-4">
      <div className="text-xs text-[#8B95A7]">{label}</div>
      <div className="mt-2 text-base font-semibold text-[#F4F7FB]">{value}</div>
    </div>
  );
}
