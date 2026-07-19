import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type SchedulerDomain = typeof import("../../src/simulation-scheduler/index");

const evidenceDir = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDir, "browser-simulation-scheduler-core-v1-summary.json");
const markdownPath = path.join(evidenceDir, "browser-simulation-scheduler-core-v1.md");
const focusedCommand =
  "npx playwright test --config tests/e2e/configs/simulation-scheduler-core.playwright.config.ts --workers=1 --retries=0";

interface BrowserHealth {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
  readonly httpErrors: string[];
}

interface ScenarioResult {
  readonly canonicalBytes: string;
  readonly signature: string;
  readonly requestOrder: readonly string[];
  readonly blocked: readonly string[];
  readonly totalCostUnits: number;
  readonly nextWakeTick: number | null;
}

const installBrowserHealthCollectors = async (page: Page): Promise<BrowserHealth> => {
  const health: BrowserHealth = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") health.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => health.pageErrors.push(error.message));
  page.on("requestfailed", (request) => health.requestFailures.push(
    `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`
  ));
  page.on("response", (response) => {
    if (!response.ok()) health.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  await page.addInitScript(() => {
    const target = window as Window & { __schedulerUnhandledRejections?: string[] };
    target.__schedulerUnhandledRejections = [];
    window.addEventListener("unhandledrejection", (event) => {
      target.__schedulerUnhandledRejections!.push(String(event.reason));
    });
  });
  return health;
};

const readTestBridge = (page: Page): Promise<{ readonly ownProperty: boolean; readonly inWindow: boolean }> =>
  page.evaluate(() => ({
    ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
    inWindow: "TestBridge" in window
  }));

test("normal route proves deterministic simulation scheduling twice", async ({ page }) => {
  const browserHealth = await installBrowserHealthCollectors(page);
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");

  const testBridgeBefore = await readTestBridge(page);
  expect(testBridgeBefore).toEqual({ ownProperty: false, inWindow: false });

  const repeated = await page.evaluate<{ readonly first: ScenarioResult; readonly second: ScenarioResult }>(async () => {
    const schedulerPath = "/src/simulation-scheduler/index.ts";
    const scheduler = (await import(/* @vite-ignore */ schedulerPath)) as SchedulerDomain;

    const run = (): ScenarioResult => {
      const snapshot = scheduler.createSimulationSchedulerFixtureSnapshot(100);
      const plan = scheduler.planSimulationScheduler(snapshot);
      return {
        canonicalBytes: plan.canonicalBytes,
        signature: plan.signature,
        requestOrder: plan.requests.map((request) => `${request.jobId}@${request.scheduledTick}#${request.sequence}`),
        blocked: plan.blocked.map((entry) => `${entry.jobId}:${entry.reason}`),
        totalCostUnits: plan.totalCostUnits,
        nextWakeTick: plan.nextWakeTick
      };
    };

    return { first: run(), second: run() };
  });

  expect(repeated.second.canonicalBytes).toBe(repeated.first.canonicalBytes);
  expect(repeated.second.signature).toBe(repeated.first.signature);
  expect(repeated.second).toEqual(repeated.first);
  expect(repeated.first.totalCostUnits).toBe(12);
  expect(repeated.first.nextWakeTick).toBe(100);
  expect(repeated.first.requestOrder).toEqual([
    "simulation-job:mission-deadline-check.0@90#0",
    "simulation-job:mission-deadline-check.0@100#1",
    "simulation-job:cargo-transfer.0@60#0",
    "simulation-job:cargo-transfer.0@80#1",
    "simulation-job:drone-survey.0@50#0"
  ]);
  expect(repeated.first.blocked).toEqual([
    "simulation-job:destroyed.0:Destroyed",
    "simulation-job:dormant-outpost.0:Dormant",
    "simulation-job:needs-player-attention.0:NeedsPlayerAttention"
  ]);

  const testBridgeAfter = await readTestBridge(page);
  const unhandledRejections = await page.evaluate(() =>
    (window as Window & { __schedulerUnhandledRejections?: string[] }).__schedulerUnhandledRejections ?? []
  );
  expect(testBridgeAfter).toEqual({ ownProperty: false, inWindow: false });
  expect(browserHealth).toEqual({ consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] });
  expect(unhandledRejections).toEqual([]);

  const evidence = {
    schemaVersion: "browser-simulation-scheduler-core-v1",
    status: "PASS",
    generator: "apps/weltraum-browser/tests/e2e/simulation-scheduler-core.spec.ts",
    normalRoute: { path: "/", testBridgeBefore, testBridgeAfter },
    modules: ["/src/simulation-scheduler/index.ts"],
    browserHealth: {
      consoleErrors: browserHealth.consoleErrors.length,
      pageErrors: browserHealth.pageErrors.length,
      requestFailures: browserHealth.requestFailures.length,
      httpErrors: browserHealth.httpErrors.length,
      unhandledRejections: unhandledRejections.length
    },
    deterministicRepeat: {
      canonicalBytesIdentical: true,
      signatureIdentical: true,
      signature: repeated.first.signature
    },
    plan: {
      requestOrder: repeated.first.requestOrder,
      blocked: repeated.first.blocked,
      totalCostUnits: repeated.first.totalCostUnits,
      nextWakeTick: repeated.first.nextWakeTick,
      canonicalBytes: repeated.first.canonicalBytes
    },
    verification: { command: focusedCommand, observedResult: "pass" }
  } as const;

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(
    markdownPath,
    `# Browser Simulation Scheduler Core V1 Evidence\n\n` +
      `- Status: **PASS**\n` +
      `- Route: \`/\` without TestBridge\n` +
      `- Imported module: \`/src/simulation-scheduler/index.ts\` only\n` +
      `- Canonical repeat: **byte-identical**\n` +
      `- Signature repeat: **${repeated.first.signature}**\n` +
      `- Selected executions: ${repeated.first.requestOrder.length}\n` +
      `- Total cost: ${repeated.first.totalCostUnits} / 12\n` +
      `- Blocked fixtures: ${repeated.first.blocked.length}\n` +
      `- Browser health (console/page/request/HTTP): 0/0/0/0\n` +
      `- Unhandled rejections: 0\n` +
      `- Focused command: \`${focusedCommand}\`\n`,
    "utf8"
  );
});
