import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const modulePath = "/src/planetary-environment/index.ts";
const evidenceDir = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDir, "browser-planetary-environment-core-v1-summary.json");
const markdownPath = path.join(evidenceDir, "browser-planetary-environment-core-v1.md");

interface BrowserRun {
  readonly modulePath: string;
  readonly fixtureIds: readonly string[];
  readonly sampleSignatures: readonly string[];
  readonly sampleBytes: string;
  readonly samples: readonly {
    readonly profileId: string;
    readonly modelState: string;
    readonly pressureClass: string;
    readonly thermalClass: string;
    readonly breathability: string;
    readonly hazardIds: readonly string[];
    readonly signature: string;
  }[];
}

interface Evidence {
  readonly schemaVersion: "browser-planetary-environment-core-v1";
  readonly route: "/";
  readonly testBridgeAbsent: true;
  readonly dynamicImport: typeof modulePath;
  readonly fixtureCount: 6;
  readonly deterministicRepeat: {
    readonly identicalSampleBytes: true;
    readonly identicalSignatures: true;
    readonly sampleSignatures: readonly string[];
  };
  readonly samples: BrowserRun["samples"];
  readonly browserHealth: {
    readonly consoleErrors: 0;
    readonly pageErrors: 0;
    readonly failedRequests: 0;
    readonly httpErrors: 0;
  };
  readonly scope: readonly string[];
  readonly status: "PASS";
}

const markdownFor = (evidence: Evidence): string => `# Browser Planetary Environment Core v1 Evidence

- Route: \`${evidence.route}\`
- TestBridge absent: \`${evidence.testBridgeAbsent}\`
- Dynamic import: \`${evidence.dynamicImport}\`
- Fixtures: \`${evidence.fixtureCount}\`
- Duplicate sample bytes identical: \`${evidence.deterministicRepeat.identicalSampleBytes}\`
- Duplicate signatures identical: \`${evidence.deterministicRepeat.identicalSignatures}\`
- Browser health console/page/request/HTTP errors: \`${evidence.browserHealth.consoleErrors}/${evidence.browserHealth.pageErrors}/${evidence.browserHealth.failedRequests}/${evidence.browserHealth.httpErrors}\`
- Screenshots: not captured; this is a pure non-visual core slice.

## Samples

${evidence.samples.map((sample) => `- \`${sample.profileId}\`: \`${sample.modelState}\`, \`${sample.pressureClass}\`, \`${sample.thermalClass}\`, \`${sample.breathability}\`, hazards \`${sample.hazardIds.join(",") || "none"}\`, signature \`${sample.signature}\``).join("\n")}

## Scope

${evidence.scope.map((entry) => `- ${entry}`).join("\n")}
`;

test("normal route proves six deterministic planetary environment fixtures", async ({ page }) => {
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

  const repeated = await page.evaluate(async (requestedModulePath): Promise<{ readonly first: BrowserRun; readonly second: BrowserRun }> => {
    const environment = await import(/* @vite-ignore */ requestedModulePath);
    const run = (): BrowserRun => {
      const profiles = environment.createRequiredEnvironmentFixtures();
      const inputs = environment.createRequiredEnvironmentSampleInputs();
      const fullSamples = profiles.map((profile: unknown, index: number) => environment.computeEnvironmentSample(profile, inputs[index]));
      const samples = fullSamples.map((sample: any) => ({
        profileId: sample.profileId,
        modelState: sample.modelState,
        pressureClass: sample.pressureClass,
        thermalClass: sample.thermalClass,
        breathability: sample.breathability,
        hazardIds: sample.hazards.map((hazard: any) => hazard.hazardId),
        signature: sample.signature
      }));
      return {
        modulePath: requestedModulePath,
        fixtureIds: profiles.map((profile: any) => profile.profileId),
        sampleSignatures: fullSamples.map((sample: any) => sample.signature),
        sampleBytes: environment.canonicalEnvironmentJson(fullSamples),
        samples
      };
    };
    return { first: run(), second: run() };
  }, modulePath);

  expect(repeated.first.modulePath).toBe(modulePath);
  expect(repeated.first.fixtureIds).toHaveLength(6);
  expect(new Set(repeated.first.fixtureIds).size).toBe(6);
  expect(repeated.first.sampleBytes).toBe(repeated.second.sampleBytes);
  expect(repeated.first.sampleSignatures).toEqual(repeated.second.sampleSignatures);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(httpErrors).toEqual([]);

  const evidence: Evidence = {
    schemaVersion: "browser-planetary-environment-core-v1",
    route: "/",
    testBridgeAbsent: true,
    dynamicImport: modulePath,
    fixtureCount: 6,
    deterministicRepeat: {
      identicalSampleBytes: true,
      identicalSignatures: true,
      sampleSignatures: repeated.first.sampleSignatures
    },
    samples: repeated.first.samples,
    browserHealth: { consoleErrors: 0, pageErrors: 0, failedRequests: 0, httpErrors: 0 },
    scope: [
      "Pure TypeScript environment profiles, validation, analytic sampling, typed hazards, canonical bytes, and signatures.",
      "Normal route only with TestBridge absent and no UI interaction or screenshot dependency.",
      "No suit, surface, world generation, voxel, flight, celestial, spatial, renderer, Three.js, or runtime authority."
    ],
    status: "PASS"
  };
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, markdownFor(evidence), "utf8");
});
