import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";

type IssueLike = { path: ReadonlyArray<PropertyKey>; message: string; code?: string };

/** Maps Zod issues to react-hook-form field errors (first issue wins per top-level field). */
export function applyZodIssuesToRhf<T extends FieldValues>(
  issues: IssueLike[],
  setError: UseFormSetError<T>
): void {
  const seen = new Set<string>();
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key !== "string" || seen.has(key)) {
      continue;
    }
    seen.add(key);
    setError(key as FieldPath<T>, {
      type: issue.code ?? "validation",
      message: issue.message
    });
  }
}
