import { StitchOperationalTableSkeleton } from "@/components/primitives/StitchOperationalTableSkeleton";

/**
 * Inline fallback while a lazy-loaded admin screen chunk resolves (inside AdminShell main).
 */
export const WorkspaceRouteSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Loading workspace">
    <div className="space-y-3">
      <div className="h-7 w-48 max-w-full animate-pulse rounded-lg bg-[#eef1f8]" />
      <div className="h-4 w-[min(100%,28rem)] animate-pulse rounded-md bg-[#f4f6fb]" />
    </div>
    <StitchOperationalTableSkeleton rowCount={7} columnCount={5} />
  </div>
);
