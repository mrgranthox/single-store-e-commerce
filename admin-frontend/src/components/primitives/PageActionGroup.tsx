import type { PropsWithChildren } from "react";

export const PageActionGroup = ({ children }: PropsWithChildren) => (
  <div className="flex flex-wrap items-center gap-3">{children}</div>
);
