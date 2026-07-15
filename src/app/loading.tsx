export default function Loading() {
  return (
    <div className="min-h-dvh w-full bg-[#090b0f] text-slate-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
          <div className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: "0.2s" }} />
          <div className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: "0.4s" }} />
        </div>
        <p className="text-sm text-slate-400">正在获取实时行情数据...</p>
      </div>
    </div>
  );
}