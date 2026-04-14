export const AdminShellSkeleton = () => (
  <div className="min-h-screen bg-[#f8f9fb]">
    <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-5 md:px-6">
      <aside className="hidden h-[calc(100vh-2.5rem)] w-64 shrink-0 rounded-3xl bg-[#13161e] md:block" />
      <main className="min-h-[calc(100vh-2.5rem)] flex-1 rounded-[32px] border border-[#e0e2f0] bg-white p-6 shadow-sm">
        <div className="h-6 w-40 animate-pulse rounded-full bg-[#eef1f8]" />
        <div className="mt-4 h-10 w-80 animate-pulse rounded-2xl bg-[#eef1f8]" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl bg-[#f4f6fb]" />
          ))}
        </div>
        <div className="mt-8 h-72 animate-pulse rounded-3xl bg-[#f4f6fb]" />
      </main>
    </div>
  </div>
);
