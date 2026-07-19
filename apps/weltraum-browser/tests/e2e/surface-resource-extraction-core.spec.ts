import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const modulePath = "/src/surface-extraction/index.ts";
const evidenceDir = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDir, "browser-surface-resource-extraction-core-v1-summary.json");
const markdownPath = path.join(evidenceDir, "browser-surface-resource-extraction-core-v1.md");

interface BrowserScenario {
  readonly schema: string;
  readonly schemaVersion: number;
  readonly scan: {
    readonly nodeId: string;
    readonly confidence: number;
    readonly resourceId: string;
    readonly estimatedQuantity: number;
    readonly signature: string;
  };
  readonly preparationState: string;
  readonly startedState: string;
  readonly pulses: readonly {
    readonly pulseIndex: number;
    readonly status: string;
    readonly extractedQuantity: number;
    readonly nodeRevision: number;
    readonly sessionRevision: number;
    readonly targetRevision: number;
    readonly pulseSignature: string;
    readonly eventIntentCount: number;
    readonly missionIntentCount: number;
  }[];
  readonly final: {
    readonly nodeRevision: number;
    readonly depletionState: string;
    readonly remainingQuantity: number;
    readonly sessionRevision: number;
    readonly sessionState: string;
    readonly pulseSequence: number;
    readonly targetRevision: number;
    readonly targetQuantity: number;
    readonly targetSignature: string;
    readonly eventIntentCount: number;
    readonly missionIntentCount: number;
  };
  readonly signature: string;
  readonly canonicalJson: string;
}

interface Evidence {
  readonly schemaVersion: "browser-surface-resource-extraction-core-v1";
  readonly route: "/";
  readonly testBridgeAbsent: true;
  readonly dynamicImport: typeof modulePath;
  readonly flow: "scan -> prepare -> begin -> pulse 1 -> pulse 2 -> pulse 3 -> transfer -> depletion";
  readonly deterministicRepeat: {
    readonly byteIdentical: true;
    readonly signatureIdentical: true;
    readonly canonicalByteLength: number;
    readonly signature: string;
  };
  readonly scan: BrowserScenario["scan"];
  readonly pulses: BrowserScenario["pulses"];
  readonly final: BrowserScenario["final"];
  readonly browserHealth: {
    readonly consoleErrors: 0;
    readonly pageErrors: 0;
    readonly failedRequests: 0;
    readonly httpErrors: 0;
  };
  readonly scope: readonly string[];
  readonly status: "PASS";
}

const markdownFor = (evidence: Evidence): string => `# Browser Surface Resource Extraction Core v1 Evidence

- Route: \`${evidence.route}\`
- TestBridge absent: \`${evidence.testBridgeAbsent}\`
- Dynamic import: \`${evidence.dynamicImport}\`
- Flow: \`${evidence.flow}\`
- Duplicate canonical bytes identical: \`${evidence.deterministicRepeat.byteIdentical}\`
- Duplicate signatures identical: \`${evidence.deterministicRepeat.signatureIdentical}\`
- Canonical byte length: \`${evidence.deterministicRepeat.canonicalByteLength}\`
- Scenario signature: \`${evidence.deterministicRepeat.signature}\`
- Browser health console/page/request/HTTP errors: \`${evidence.browserHealth.consoleErrors}/${evidence.browserHealth.pageErrors}/${evidence.browserHealth.failedRequests}/${evidence.browserHealth.httpErrors}\`
- Screenshots: not captured; this is a pure non-visual domain slice.

## Result

- Scan: node \`${evidence.scan.nodeId}\`, resource \`${evidence.scan.resourceId}\`, confidence \`${evidence.scan.confidence}\`.
- Pulses: ${evidence.pulses.map((pulse) => `#${pulse.pulseIndex}=\`${pulse.extractedQuantity}\``).join(", ")}.
- Final: session \`${evidence.final.sessionState}\`, node \`${evidence.final.depletionState}\`, remaining \`${evidence.final.remainingQuantity}\`, drone quantity \`${evidence.final.targetQuantity}\`.
- Intents: \`${evidence.final.eventIntentCount}\` event and \`${evidence.final.missionIntentCount}\` mission intents.

## Scope

${evidence.scope.map((entry) => `- ${entry}`).join("\n")}
`;

test("normal route proves the deterministic three-pulse resource extraction flow twice", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const httpErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));
  page.on("response", (response) => { if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`); });

  await page.goto("/");
  expect(new URL(page.url()).pathname).toBe("/");
  const testBridgeAbsent = await page.evaluate(() => !Object.hasOwn(window, "TestBridge") && !("TestBridge" in window));
  expect(testBridgeAbsent).toBe(true);

  const repeated = await page.evaluate(async (requestedModulePath): Promise<{ readonly first: BrowserScenario; readonly second: BrowserScenario }> => {
    const extraction = await import(/* @vite-ignore */ requestedModulePath);
    return {
      first: extraction.runSurfaceExtractionBrowserScenario(),
      second: extraction.runSurfaceExtractionBrowserScenario()
    };
  }, modulePath);

  expect(repeated.first.canonicalJson).toBe(repeated.second.canonicalJson);
  expect(repeated.first.signature).toBe(repeated.second.signature);
  expect(repeated.first.preparationState).toBe("Prepared");
  expect(repeated.first.startedState).toBe("Active");
  expect(repeated.first.pulses).toHaveLength(3);
  expect(repeated.first.pulses.map((pulse) => pulse.status)).toEqual(["Applied", "Applied", "Applied"]);
  expect(repeated.first.pulses.map((pulse) => pulse.extractedQuantity)).toEqual([1, 1, 1]);
  expect(repeated.first.final).toMatchObject({
    depletionState: "Depleted",
    remainingQuantity: 0,
    sessionState: "Completed",
    pulseSequence: 3,
    targetQuantity: 3
  });
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(httpErrors).toEqual([]);

  const evidence: Evidence = {
    schemaVersion: "browser-surface-resource-extraction-core-v1",
    route: "/",
    testBridgeAbsent: true,
    dynamicImport: modulePath,
    flow: "scan -> prepare -> begin -> pulse 1 -> pulse 2 -> pulse 3 -> transfer -> depletion",
    deterministicRepeat: {
      byteIdentical: true,
      signatureIdentical: true,
      canonicalByteLength: new TextEncoder().encode(repeated.first.canonicalJson).length,
      signature: repeated.first.signature
    },
    scan: repeated.first.scan,
    pulses: repeated.first.pulses,
    final: repeated.first.final,
    browserHealth: { consoleErrors: 0, pageErrors: 0, failedRequests: 0, httpErrors: 0 },
    scope: [
      "Pure TypeScript scan, preparation, session state, deterministic pulse, Resource Core transfer, depletion, and intent projection.",
      "Normal route only with TestBridge absent and a single dynamic import from the surface-extraction public barrel.",
      "No UI, renderer objects, physics simulation, DOM authority, global randomness, Date authority, Three.js, or second cargo engine."
    ],
    status: "PASS"
  };
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, markdownFor(evidence), "utf8");
});
