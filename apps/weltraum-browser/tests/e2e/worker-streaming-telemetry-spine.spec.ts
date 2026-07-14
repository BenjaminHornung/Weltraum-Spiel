import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ciTimeout } from "./support/ciTiming";
import type { ContentProvider } from "../../src/streaming";

type WorkerDomain = typeof import("../../src/workers/index");
type StreamingDomain = typeof import("../../src/streaming/index");
type PerformanceDomain = typeof import("../../src/diagnostics/performance/index");

const evidenceDir = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDir, "browser-worker-streaming-telemetry-spine-v1-summary.json");
const markdownPath = path.join(evidenceDir, "browser-worker-streaming-telemetry-spine-v1.md");
const focusedCommand = "npm run test:e2e -- tests/e2e/worker-streaming-telemetry-spine.spec.ts";

interface BrowserFailures {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
  readonly httpErrors: string[];
}

interface TestBridgeState { readonly ownProperty: boolean; readonly inWindow: boolean }

interface ScenarioResult {
  readonly canonicalJson: string;
  readonly semantic: {
    readonly transfers: readonly { readonly bytes: number; readonly detached: true; readonly hash: string; readonly first: number; readonly last: number }[];
    readonly queuedCancellation: "CancelledBeforeStart";
    readonly runningCancellation: "CancelledDuringExecution";
    readonly staleDecision: "RejectedStalePlanningEpoch";
    readonly replacementEpochDelta: number;
    readonly cache: {
      readonly providerCalls: number;
      readonly deduplicated: boolean;
      readonly hitSource: "Cache";
      readonly pinnedSurvived: boolean;
      readonly releasedEntryEvicted: boolean;
      readonly canonical: unknown;
    };
    readonly telemetry: unknown;
  };
  readonly elapsedMs: number;
}

const installBrowserFailureCollectors = (page: Page): BrowserFailures => {
  const failures: BrowserFailures = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") failures.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => failures.pageErrors.push(error.message));
  page.on("requestfailed", (request) => failures.requestFailures.push(
    `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`
  ));
  page.on("response", (response) => {
    if (!response.ok()) failures.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  return failures;
};

const readTestBridgeState = (page: Page): Promise<TestBridgeState> => page.evaluate(() => ({
  ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
  inWindow: "TestBridge" in window
}));

test("normal route proves the real worker streaming telemetry spine twice", async ({ page }) => {
  test.setTimeout(ciTimeout(90_000, 120_000));
  const failures = installBrowserFailureCollectors(page);
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");

  const testBridgeBefore = await readTestBridgeState(page);
  expect(testBridgeBefore).toEqual({ ownProperty: false, inWindow: false });

  const repeated = await page.evaluate<{ readonly first: ScenarioResult; readonly second: ScenarioResult }>(async () => {
    const workersPath = "/src/workers/index.ts";
    const streamingPath = "/src/streaming/index.ts";
    const performancePath = "/src/diagnostics/performance/index.ts";
    const workers = (await import(/* @vite-ignore */ workersPath)) as WorkerDomain;
    const streaming = (await import(/* @vite-ignore */ streamingPath)) as StreamingDomain;
    const diagnostics = (await import(/* @vite-ignore */ performancePath)) as PerformanceDomain;

    const run = async (): Promise<ScenarioResult> => {
      const started = performance.now();
      const telemetry = new diagnostics.PerformanceTelemetry();
      const pool = new workers.WorkerPool({
        workerCount: 1,
        queueCapacity: 16,
        initialPlanningEpoch: workers.planningEpoch(1),
        observe: (event) => {
          switch (event.type) {
            case "Queued": telemetry.observeQueueDepth(event.queueDepth); break;
            case "Dispatched": telemetry.recordInputBytesTransferred(event.inputBytes); break;
            case "OutputTransferred": telemetry.recordOutputBytesTransferred(event.outputBytes); break;
            case "Completed": telemetry.recordJobCompleted(); break;
            case "Cancelled": telemetry.recordJobCancelled(); break;
            case "Failed": telemetry.recordJobFailed(); break;
            case "StaleResultRejected": telemetry.recordStaleResultRejected(); break;
            case "WorkerRestarted": telemetry.recordWorkerRestart(); break;
          }
        }
      });
      await pool.start();
      telemetry.setWorkerState(1, 1);

      const makeRequest = (id: string, bytes: number, plan: number, chunkBytes = 64 * 1024) => ({
        jobId: workers.workerJobId(id),
        jobKind: workers.workerJobKind("TransformBuffer"),
        targetKey: workers.workerTargetKey(`target-${id}`),
        planningEpoch: workers.planningEpoch(plan),
        workerEpoch: workers.workerEpoch(0),
        inputRevision: workers.contentRevision(1),
        algorithmVersion: workers.algorithmVersion(1),
        priority: "Normal" as const,
        deadline: workers.jobDeadline(1),
        estimatedInputBytes: workers.byteCount(bytes),
        estimatedOutputBytes: workers.byteCount(bytes),
        payload: { xorMask: 0x5a, chunkBytes, outputRevision: workers.contentRevision(2) }
      });
      const makeInput = (bytes: number) => {
        const buffer = new ArrayBuffer(bytes);
        const view = new Uint8Array(buffer);
        for (let index = 0; index < view.length; index += 1) view[index] = index & 0xff;
        return {
          buffer,
          bundle: {
            ownership: "SenderToWorker" as const,
            revision: workers.contentRevision(1),
            byteLength: workers.byteCount(bytes),
            buffers: [buffer],
            views: [{ name: "bytes", bufferIndex: 0, kind: "Uint8Array" as const, byteOffset: 0, elementCount: bytes }]
          }
        };
      };

      const transfers: Array<{ bytes: number; detached: true; hash: string; first: number; last: number }> = [];
      for (const bytes of [256 * 1024, 1024 * 1024, 4 * 1024 * 1024]) {
        const input = makeInput(bytes);
        const ticket = pool.enqueue(makeRequest(`size-${bytes}`, bytes, 1), input.bundle);
        if (input.buffer.byteLength !== 0) throw new Error(`Sender buffer ${bytes} was not detached.`);
        const terminal = await ticket.result;
        if (terminal.kind !== "Completed") throw new Error(`Transform ${bytes} did not complete: ${terminal.kind}.`);
        const output = new Uint8Array(terminal.output.buffers[0]);
        if (output[0] !== 0x5a || output[output.length - 1] !== (((bytes - 1) & 0xff) ^ 0x5a)) {
          throw new Error(`Transform ${bytes} returned incorrect bytes.`);
        }
        transfers.push({ bytes, detached: true, hash: terminal.result.contentHash ?? "", first: output[0], last: output.at(-1)! });
      }

      const runningInput = makeInput(4 * 1024 * 1024);
      const running = pool.enqueue(makeRequest("cancel-running", runningInput.buffer.byteLength, 1, 16 * 1024), runningInput.bundle);
      const queuedInput = makeInput(256 * 1024);
      const queued = pool.enqueue(makeRequest("cancel-queued", queuedInput.buffer.byteLength, 1), queuedInput.bundle);
      if (!queued.cancel() || !running.cancel()) throw new Error("Expected both cancellation requests to be accepted.");
      const queuedTerminal = await queued.result;
      const runningTerminal = await running.result;
      if (queuedTerminal.kind !== "Cancelled" || queuedTerminal.reason !== "CancelledBeforeStart") throw new Error("Queued cancellation mismatch.");
      if (runningTerminal.kind !== "Cancelled" || runningTerminal.reason !== "CancelledDuringExecution") throw new Error("Running cancellation mismatch.");

      const staleInput = makeInput(4 * 1024 * 1024);
      const stale = pool.enqueue(makeRequest("stale-planning", staleInput.buffer.byteLength, 1, 64 * 1024), staleInput.bundle);
      pool.setPlanningEpoch(workers.planningEpoch(2));
      const staleTerminal = await stale.result;
      if (staleTerminal.kind !== "Failed" || staleTerminal.integrationDecision?.kind !== "RejectedStalePlanningEpoch") {
        throw new Error("Stale PlanningEpoch result was not rejected.");
      }

      const epochBefore = pool.snapshot().latestWorkerEpoch;
      const epochAfter = await pool.replaceWorker(0);
      if (epochAfter !== epochBefore + 1) throw new Error("Replacement did not advance WorkerEpoch exactly once.");

      let providerCalls = 0;
      let deduplicated = false;
      const cache = new streaming.MemoryContentCache(1024 * 1024, (event) => {
        if (event.kind === "Hit") telemetry.recordCacheHit();
        else if (event.kind === "Miss") telemetry.recordCacheMiss();
        else if (event.kind === "Evicted") telemetry.recordCacheEviction();
      });
      const fixture = streaming.createDeterministicContentProvider({ byteLength: 512 * 1024, chunkBytes: 64 * 1024 });
      const provider: ContentProvider = {
        async load(request) { providerCalls += 1; return fixture.load(request); }
      };
      const loader = new streaming.AsyncContentLoader(cache, provider, {
        observer: (event) => {
          if (event.kind === "Request") telemetry.recordLoaderRequest();
          if (event.kind === "Deduplicated") { telemetry.recordLoaderDeduplication(); deduplicated = true; }
        }
      });
      const contentKey = streaming.createContentKey({
        namespace: "fixture", contentId: "e2e", inputRevision: 1, algorithmVersion: 1, outputRevision: 1
      });
      const [missA, missB] = await Promise.all([loader.load({ key: contentKey }), loader.load({ key: contentKey })]);
      if (missA.kind !== "Loaded" || missB.kind !== "Loaded" || missA.source !== "Provider" || missB.source !== "Provider") {
        throw new Error("Expected deduplicated provider loads.");
      }
      missA.lease.release(); missB.lease.release();
      const hit = await loader.load({ key: contentKey });
      if (hit.kind !== "Loaded" || hit.source !== "Cache") throw new Error("Expected cache hit.");
      hit.lease.release();
      const pin = cache.pin(contentKey);
      if (pin === undefined) throw new Error("Expected content pin.");
      const put = (id: string, bytes: number, fill: number) => {
        const key = streaming.createContentKey({ namespace: "fixture", contentId: id, inputRevision: 1, algorithmVersion: 1, outputRevision: 1 });
        const buffer = new ArrayBuffer(bytes); new Uint8Array(buffer).fill(fill);
        cache.put({ key, buffer, byteLength: bytes, contentHash: streaming.computeContentHash(buffer), layout: "bytes/u8" });
        return key;
      };
      const keyB = put("b", 512 * 1024, 2);
      put("c", 512 * 1024, 3);
      const pinnedSurvived = cache.has(contentKey) && !cache.has(keyB);
      pin.release();
      put("d", 768 * 1024, 4);
      const releasedEntryEvicted = !cache.has(contentKey);
      const cacheSnapshot = cache.snapshot();

      await pool.shutdown();
      telemetry.setWorkerState(1, 0);
      telemetry.setQueueState(0, 0);
      telemetry.setCacheState(cacheSnapshot.entryCount, cacheSnapshot.totalBytes, cacheSnapshot.pinnedEntries);
      const semantic = {
        transfers,
        queuedCancellation: queuedTerminal.reason,
        runningCancellation: runningTerminal.reason,
        staleDecision: staleTerminal.integrationDecision.kind,
        replacementEpochDelta: (epochAfter - epochBefore) as 1,
        cache: {
          providerCalls: providerCalls as 1,
          deduplicated: deduplicated as true,
          hitSource: hit.source,
          pinnedSurvived,
          releasedEntryEvicted,
          canonical: streaming.canonicalizeCacheSnapshot(cacheSnapshot)
        },
        telemetry: diagnostics.canonicalizePerformanceTelemetrySnapshot(telemetry.snapshot())
      };
      return { semantic, canonicalJson: JSON.stringify(semantic), elapsedMs: performance.now() - started };
    };

    return { first: await run(), second: await run() };
  });

  expect(repeated.second.canonicalJson).toBe(repeated.first.canonicalJson);
  expect(repeated.second.semantic).toEqual(repeated.first.semantic);
  expect(repeated.first.semantic.transfers.map((entry) => entry.bytes)).toEqual([256 * 1024, 1024 * 1024, 4 * 1024 * 1024]);
  expect(repeated.first.semantic.transfers.every((entry) => entry.detached && entry.hash.length === 8)).toBe(true);
  expect(repeated.first.semantic).toMatchObject({
    queuedCancellation: "CancelledBeforeStart",
    runningCancellation: "CancelledDuringExecution",
    staleDecision: "RejectedStalePlanningEpoch",
    replacementEpochDelta: 1,
    cache: { providerCalls: 1, deduplicated: true, hitSource: "Cache", pinnedSurvived: true, releasedEntryEvicted: true }
  });
  const testBridgeAfter = await readTestBridgeState(page);
  expect(testBridgeAfter).toEqual({ ownProperty: false, inWindow: false });
  expect(failures).toEqual({ consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] });

  const evidence = {
    schemaVersion: "browser-worker-streaming-telemetry-spine-v1",
    status: "PASS",
    generator: "apps/weltraum-browser/tests/e2e/worker-streaming-telemetry-spine.spec.ts",
    normalRoute: { path: "/", testBridgeBefore, testBridgeAfter },
    modules: ["/src/workers/index.ts", "/src/streaming/index.ts", "/src/diagnostics/performance/index.ts"],
    browserGuards: { consoleErrors: 0, pageErrors: 0, requestFailures: 0, httpErrors: 0 },
    deterministicRepeat: { canonicalIdentical: true },
    diagnostics: { firstElapsedMs: repeated.first.elapsedMs, secondElapsedMs: repeated.second.elapsedMs, performanceGated: false },
    scenario: repeated.first.semantic,
    verification: { command: focusedCommand, observedResult: "pass" }
  } as const;
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, `# Browser Worker Streaming Telemetry Spine V1 Evidence\n\n- Status: **PASS**\n- Route: \`/\` without TestBridge\n- Real module Worker: **verified**\n- Transfer sizes: 256 KiB, 1 MiB, 4 MiB\n- Sender buffers detached: **verified**\n- Queued/running cancellation: **verified**\n- Planning/Worker epoch rejection and replacement: **verified**\n- Cache miss/hit/pinning/release/eviction: **verified**\n- Canonical repeat: **identical**\n- Browser health errors: 0/0/0/0\n- Timing evidence (not gated): ${repeated.first.elapsedMs.toFixed(2)} ms, ${repeated.second.elapsedMs.toFixed(2)} ms\n- Focused command: \`${focusedCommand}\`\n`, "utf8");
});
