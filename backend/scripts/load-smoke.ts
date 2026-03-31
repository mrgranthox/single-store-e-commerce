const baseUrl = process.env.LOAD_SMOKE_BASE_URL ?? "http://127.0.0.1:4000";
const concurrency = Number(process.env.LOAD_SMOKE_CONCURRENCY ?? 10);
const iterations = Number(process.env.LOAD_SMOKE_ITERATIONS ?? 5);
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

  return {
    path,
    ok: response.ok,
    status: response.status,
    durationMs
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

  console.log(
    JSON.stringify(
      {
        baseUrl,
        concurrency,
        iterations,
        requests: results.length,
        failures: failures.length,
        averageDurationMs: Number(averageDurationMs.toFixed(2)),
        p95DurationMs: Number(p95DurationMs.toFixed(2))
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
};

void main();
