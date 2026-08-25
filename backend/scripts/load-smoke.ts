const baseUrl = process.env.LOAD_SMOKE_BASE_URL ?? "http://127.0.0.1:4000";
const concurrency = Number(process.env.LOAD_SMOKE_CONCURRENCY ?? 10);
const iterations = Number(process.env.LOAD_SMOKE_ITERATIONS ?? 5);
const serverP95BudgetMs = Number(process.env.LOAD_SMOKE_SERVER_P95_BUDGET_MS ?? process.env.PERF_BUDGET_P95_MS ?? 45);
const targets = (process.env.LOAD_SMOKE_TARGETS ?? "/health,/api/products,/api/support/public-config")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const runRequest = async (path: string) => {
  const startedAt = performance.now();
  const response = await fetch(new URL(path, baseUrl), {
    headers: {
      accept: "application/json"
    }
  });
  const durationMs = performance.now() - startedAt;
  const serverDurationHeader = response.headers.get("x-response-time-ms");
  const serverDurationMs = serverDurationHeader == null ? null : Number(serverDurationHeader);

  return {
    path,
    ok: response.ok,
    status: response.status,
    durationMs,
    serverDurationMs: Number.isFinite(serverDurationMs) ? serverDurationMs : null,
    cache: response.headers.get("x-cache")
  };
};

const main = async () => {
  if (targets.length === 0) {
    throw new Error("No load-smoke targets were provided.");
  }

  const results = [];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const batch = await Promise.all(
      Array.from({ length: concurrency }, async (_, concurrencyIndex) => {
        const path = targets[(iteration * concurrency + concurrencyIndex) % targets.length]!;
        return runRequest(path);
      })
    );

    results.push(...batch);
  }

  const failures = results.filter((result) => !result.ok);
  const averageDurationMs =
    results.reduce((sum, result) => sum + result.durationMs, 0) / results.length;
  const p95DurationMs =
    [...results]
      .sort((left, right) => left.durationMs - right.durationMs)
      [Math.min(results.length - 1, Math.floor(results.length * 0.95))]?.durationMs ?? 0;
  const serverDurations = results
    .map((result) => result.serverDurationMs)
    .filter((durationMs): durationMs is number => durationMs != null);
  const p95ServerDurationMs =
    serverDurations.length > 0
      ? [...serverDurations].sort((left, right) => left - right)[
          Math.min(serverDurations.length - 1, Math.floor(serverDurations.length * 0.95))
        ] ?? 0
      : null;
  const cacheCounts = results.reduce<Record<string, number>>((counts, result) => {
    const cache = result.cache ?? "NONE";
    counts[cache] = (counts[cache] ?? 0) + 1;
    return counts;
  }, {});

  console.log(
    JSON.stringify(
      {
        baseUrl,
        concurrency,
        iterations,
        requests: results.length,
        failures: failures.length,
        averageDurationMs: Number(averageDurationMs.toFixed(2)),
        p95DurationMs: Number(p95DurationMs.toFixed(2)),
        p95ServerDurationMs:
          p95ServerDurationMs == null ? null : Number(p95ServerDurationMs.toFixed(2)),
        serverP95BudgetMs,
        cacheCounts
      },
      null,
      2
    )
  );

  if (failures.length > 0) {
    console.error(
      JSON.stringify(
        failures.map((failure) => ({
          path: failure.path,
          status: failure.status,
          durationMs: Number(failure.durationMs.toFixed(2))
        })),
        null,
        2
      )
    );
    process.exitCode = 1;
  }

  if (p95ServerDurationMs != null && p95ServerDurationMs > serverP95BudgetMs) {
    console.error(
      `Server p95 ${p95ServerDurationMs.toFixed(2)}ms exceeds budget ${serverP95BudgetMs}ms.`
    );
    process.exitCode = 1;
  }
};

void main();
