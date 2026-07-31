import { AppShell } from "@/components/layout/app-shell";
import { PaperTradesView } from "@/components/paper-trades/paper-trades-view";

export const dynamic = "force-dynamic";

export default function PaperTradesPage() {
  return <AppShell><PaperTradesView /></AppShell>;
}

