import { InfoRail } from "./info-rail";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export function AppShell({
  children,
  rightRail,
}: Readonly<{ children: React.ReactNode; rightRail?: React.ReactNode }>) {
  return (
    <div className="min-h-dvh w-full bg-[#090b0f] text-slate-100">
      <div className="flex min-h-dvh w-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col w-full">
          <TopBar />
          <div className="grid flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="min-w-0 w-full px-4 py-4 sm:px-6 lg:px-8">{children}</main>
            {rightRail ?? <InfoRail />}
          </div>
        </div>
      </div>
    </div>
  );
}
