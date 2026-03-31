const PARAM_RE = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;

/**
 * Replaces `:param` segments with values from the current route. Returns null if any param is missing.
 */
export const resolveEndpointPath = (
  pathTemplate: string,
  routeParams: Readonly<Record<string, string | undefined>>
): string | null => {
  let result = pathTemplate;
  const seen = new Set<string>();

  for (const match of pathTemplate.matchAll(PARAM_RE)) {
    const key = match[1];
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const raw = routeParams[key];
    if (typeof raw !== "string" || !raw.trim()) {
      return null;
    }

    result = result.replace(new RegExp(`:${key}\\b`, "g"), encodeURIComponent(raw.trim()));
  }

  return result;
};
