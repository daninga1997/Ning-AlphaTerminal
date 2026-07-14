import { AppShell } from "@/components/layout/app-shell";
import { ReportsView } from "@/components/reports/reports-view";
import { mockReports } from "@/data/mock-reports";

export default function ReportsPage() {
  return (
    <AppShell>
      <ReportsView reports={mockReports} />
    </AppShell>
  );
}
