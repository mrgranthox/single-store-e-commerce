import type { PropsWithChildren } from "react";

export const BulkActionBar = ({ children }: PropsWithChildren) => (
  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e0e2f0] bg-[#f8f9fb] px-4 py-3">
    {children}
  </div>
);
