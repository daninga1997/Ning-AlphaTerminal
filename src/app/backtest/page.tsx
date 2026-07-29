import { BacktestView } from "@/components/backtest/backtest-view";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default function BacktestPage() {
  return (
    <AppShell>
      <BacktestView />
    </AppShell>
  );
}
