export function MemorySection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[#F4F7FB]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[#8B95A7]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
