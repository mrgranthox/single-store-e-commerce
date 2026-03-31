const baseUrl = process.env.SOAK_BASE_URL ?? "http://127.0.0.1:4000";
const durationMs = Number(process.env.SOAK_DURATION_MS ?? 120_000);
const stageDurationMs = Number(process.env.SOAK_STAGE_DURATION_MS ?? 30_000);
const concurrencyStart = Number(process.env.SOAK_CONCURRENCY_START ?? 8);
const concurrencyStep = Number(process.env.SOAK_CONCURRENCY_STEP ?? 4);
const targets = (process.env.SOAK_TARGETS ?? "/health,/api/products,/api/support/public-config")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

type RequestResult = {
  path: string;
  ok: boolean;
  status: number;
  durationMs: number;
};

const runRequest = async (path: string): Promise<RequestResult> => {
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

const summarize = (results: RequestResult[]) => {
  const failures = results.filter((result) => !result.ok);
  const averageDurationMs =
    results.reduce((sum, result) => sum + result.durationMs, 0) / Math.max(results.length, 1);
  const sortedDurations = [...results]
    .map((result) => result.durationMs)
    .sort((left, right) => left - right);
  const percentile = (value: number) =>
    sortedDurations[Math.min(sortedDurations.length - 1, Math.floor(sortedDurations.length * value))] ?? 0;

  return {
    requests: results.length,
    failures: failures.length,
    averageDurationMs: Number(averageDurationMs.toFixed(2)),
    p95DurationMs: Number(percentile(0.95).toFixed(2)),
    p99DurationMs: Number(percentile(0.99).toFixed(2))
  };
};

const main = async () => {
  if (targets.length === 0) {
    throw new Error("No soak-smoke targets were provided.");
  }

  const suiteStartedAt = Date.now();
  const stages: Array<{
    concurrency: number;
    results: RequestResult[];
    summary: ReturnType<typeof summarize>;
  }> = [];
  let stageIndex = 0;

  while (Date.now() - suiteStartedAt < durationMs) {
    const concurrency = concurrencyStart + concurrencyStep * stageIndex;
    const stageStartedAt = Date.now();
    const stageResults: RequestResult[] = [];
    let targetIndex = 0;

    while (Date.now() - stageStartedAt < stageDurationMs) {
      const batch = await Promise.all(
        Array.from({ length: concurrency }, async () => {
          const path = targets[targetIndex % targets.length]!;
          targetIndex += 1;
          return runRequest(path);
        })
      );

      stageResults.push(...batch);
    }

    stages.push({
      concurrency,
      results: stageResults,
      summary: summarize(stageResults)
    });
    stageIndex += 1;
  }

  const allResults = stages.flatMap((stage) => stage.results);
  const overall = summarize(allResults);

  console.log(
    JSON.stringify(
      {
        baseUrl,
        durationMs,
        stageDurationMs,
        targets,
        overall,
        stages: stages.map((stage, index) => ({
          stage: index + 1,
          concurrency: stage.concurrency,
          ...stage.summary
        }))
      },
      null,
      2
    )
  );

  if (overall.failures > 0) {
    process.exitCode = 1;
  }
};

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
