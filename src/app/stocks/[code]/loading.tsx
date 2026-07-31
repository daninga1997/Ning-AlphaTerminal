import { AppShell } from "@/components/layout/app-shell";
import { StockDetailSkeleton } from "@/components/stocks/detail/stock-detail-skeleton";

export default function StockDetailLoading() {
  return (
    <AppShell>
      <StockDetailSkeleton />
    </AppShell>
  );
}
