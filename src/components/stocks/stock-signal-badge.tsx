import type { StockSignal } from "@/types/stock";
import { getSignalPresentation } from "../../lib/presentation/signal-presentation";

export function StockSignalBadge({ signal }: { signal: StockSignal }) {
  const presentation = getSignalPresentation(signal);

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${presentation.badgeClassName}`}
    >
      {presentation.chineseLabel}
    </span>
  );
}
