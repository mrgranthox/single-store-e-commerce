import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

type ScenarioResult = {
  scenario: string;
  success: boolean;
  details: Record<string, unknown>;
};

const scenario = process.argv[2] ?? "all";
const isChildProcess = process.argv[3] === "--child";

const runPostgresScenario = async (): Promise<ScenarioResult> => {
  const prisma = new PrismaClient({
    datasourceUrl: "postgresql://fault:fault@127.0.0.1:1/fault?connect_timeout=2"
  });

  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      scenario: "postgres",
      success: false,
      details: {
        reason: "Postgres connectivity unexpectedly succeeded."
      }
    };
  } catch (error) {
    return {
      scenario: "postgres",
      success: true,
      details: {
        message: error instanceof Error ? error.message : String(error)
      }
    };
  } finally {
    await prisma.$disconnect();
  }
};

const runRedisScenario = async (): Promise<ScenarioResult> => {
  const redis = new Redis("redis://127.0.0.1:1", {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    enableReadyCheck: false,
    connectTimeout: 2_000
  });

  try {
    await redis.connect();
    await redis.ping();

    return {
      scenario: "redis",
      success: false,
      details: {
        reason: "Redis connectivity unexpectedly succeeded."
      }
    };
  } catch (error) {
    return {
      scenario: "redis",
      success: true,
      details: {
        message: error instanceof Error ? error.message : String(error)
      }
    };
  } finally {
    redis.disconnect();
  }
};

const runPaystackScenario = async (): Promise<ScenarioResult> => {
  process.env.PAYSTACK_SECRET_KEY = "fault-paystack-secret";
  process.env.PAYSTACK_API_BASE_URL = "http://127.0.0.1:1";
  process.env.PAYSTACK_REQUEST_TIMEOUT_MS = "1500";

  const { PaystackPaymentProvider } = await import("../src/modules/payments/providers/paystack.provider");
  const provider = new PaystackPaymentProvider();

  try {
    await provider.verifyPaymentReference("fault-reference");

    return {
      scenario: "paystack",
      success: false,
      details: {
        reason: "Paystack verification unexpectedly succeeded."
      }
    };
  } catch (error) {
    return {
      scenario: "paystack",
      success: true,
      details: {
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
};

const runBrevoScenario = async (): Promise<ScenarioResult> => {
  process.env.EMAIL_FROM = "fault@example.com";
  process.env.BREVO_SMTP_HOST = "127.0.0.1";
  process.env.BREVO_SMTP_PORT = "1";
  process.env.BREVO_SMTP_LOGIN = "fault@example.com";
  process.env.BREVO_SMTP_PASSWORD = "fault-password";
  process.env.BREVO_SMTP_CONNECTION_TIMEOUT_MS = "1500";
  process.env.BREVO_SMTP_SOCKET_TIMEOUT_MS = "1500";
  process.env.BREVO_SMTP_GREETING_TIMEOUT_MS = "1500";

  const { resetEmailRuntimeState, sendTransactionalEmail } = await import("../src/config/email");
  resetEmailRuntimeState();

  try {
    await sendTransactionalEmail({
      notificationId: "fault-notification",
      notificationType: "FAULT_INJECTION",
      recipientEmail: "recipient@example.com",
      subject: "Fault injection",
      html: "<p>Fault injection</p>",
      text: "Fault injection"
    });

    return {
      scenario: "brevo",
      success: false,
      details: {
        reason: "Brevo delivery unexpectedly succeeded."
      }
    };
  } catch (error) {
    return {
      scenario: "brevo",
      success: true,
      details: {
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
};

const runScenario = async (scenarioName: string): Promise<ScenarioResult> => {
  switch (scenarioName) {
    case "postgres":
      return runPostgresScenario();
    case "redis":
      return runRedisScenario();
    case "paystack":
      return runPaystackScenario();
    case "brevo":
      return runBrevoScenario();
    default:
      throw new Error(`Unsupported scenario "${scenarioName}".`);
  }
};

const spawnScenario = async (scenarioName: string) => {
  const { spawnSync } = await import("node:child_process");

  const child = spawnSync(process.execPath, ["--import", "tsx", "scripts/fault-injection.ts", scenarioName, "--child"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8"
  });

  const stdout = child.stdout?.trim();
  const parsed =
    stdout && stdout.startsWith("{") ? (JSON.parse(stdout) as ScenarioResult) : null;

  return {
    exitCode: child.status ?? 1,
    stdout,
    stderr: child.stderr?.trim() || null,
    result: parsed
  };
};

const main = async () => {
  if (scenario !== "all" && isChildProcess) {
    const result = await runScenario(scenario);
    console.log(JSON.stringify(result));
    process.exit(result.success ? 0 : 1);
  }

  if (scenario !== "all") {
    const result = await runScenario(scenario);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  }

  const scenarios = ["postgres", "redis", "paystack", "brevo"];
  const results = [];

  for (const scenarioName of scenarios) {
    const child = await spawnScenario(scenarioName);

    results.push({
      scenario: scenarioName,
      exitCode: child.exitCode,
      result: child.result,
      stderr: child.stderr
    });
  }

  const success = results.every((result) => result.exitCode === 0 && result.result?.success);

  console.log(
    JSON.stringify(
      {
        success,
        results
      },
      null,
      2
    )
  );

  process.exit(success ? 0 : 1);
};

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
