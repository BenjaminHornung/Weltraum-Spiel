import {describe, expect, it, vi} from "vitest";
import * as fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {isHvpCutHealthFresh, planHvpCutRtSeries, readHvpBodyHoldForCommand, readHvpCutMarkers, summarizeHvpCuts,
  summarizeHvpCutRtSessions, createHvpCutRtEvidenceDirectory, describeHvpCutRtFailure, inventoryHvpCutRtFiles,
  persistHvpCutRtReport, projectHvpCutRtGpuInfo, type HvpCutRtFailureStage, type HvpCutRtAttemptRecord, type HvpCutSample, type HvpCutRawEntry} from "../performance/hvpCutRtReport";

vi.mock("node:fs/promises", async importOriginal => ({...await importOriginal<typeof fs>()}));

describe("CDP metadata publication privacy", () => {
  const canaries = ["SYNTH_COMMANDLINE_CANARY", "SYNTH_PROFILE_PATH_CANARY", "SYNTH_URL_TOKEN_CANARY", "SYNTH_ERROR_TEXT_CANARY"];
  const device = {vendorId: 32902, deviceId: 1, vendorString: "Intel", deviceString: "Intel Arc Pro 140T",
    driverVendor: "Intel", driverVersion: "32.0.101.8360"};
  const systemInfo = () => ({commandLine: canaries[0], profilePath: `C:/synthetic/${canaries[1]}`,
    gpu: {devices: [{...device, nested: {url: `https://synthetic.invalid/?token=${canaries[2]}`}}],
      auxAttributes: {profilePath: canaries[1], error: {message: canaries[3]}}, featureStatus: {url: canaries[2]}},
    nestedPayload: {commandLine: canaries[0], error: {message: canaries[3], stack: canaries[3]}}});

  it("publishes only the GPU identity and driver fields used by reference-device admission", () => {
    const info = systemInfo(), before = JSON.stringify(info), projected = projectHvpCutRtGpuInfo(info);
    expect(projected).toEqual({gpu: {devices: [device]}});
    for (const canary of canaries) { expect(JSON.stringify(projected)).not.toContain(canary); }
    expect(JSON.stringify(info)).toBe(before);
  });

  it("keeps nested metadata and error canaries out of files and fallback test attachments", async () => {
    const app = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
    const root = path.resolve("C:/IFI_SourceCode/Utils/npm-tmp/opencode/hvp-privacy-synthetic");
    vi.spyOn(fs, "realpath").mockImplementation((async file => path.resolve(file as string)) as typeof fs.realpath);
    vi.spyOn(fs, "lstat").mockImplementation((async () => ({isDirectory: () => true, isSymbolicLink: () => false})) as unknown as typeof fs.lstat);
    const writes: string[] = [], attachments: Buffer[] = [];
    const write = vi.spyOn(fs, "writeFile").mockImplementation(async (_file, body) => { writes.push(String(body)); });
    try {
      const report = () => ({artifactFailures: [] as string[], process: {version: "Chrome/141.0.0.0", gpu: projectHvpCutRtGpuInfo(systemInfo())},
        failure: describeHvpCutRtFailure("attempt", new Error(canaries[3], {cause: {url: canaries[2], profile: canaries[1]}}))});
      await persistHvpCutRtReport(root, app, report(), async body => { attachments.push(body); });
      write.mockRejectedValueOnce(Object.assign(new Error(canaries[3], {cause: systemInfo()}), {code: "ENOSPC"}));
      const fallback = report();
      await persistHvpCutRtReport(root, app, fallback, async body => { attachments.push(body); });
      expect(writes).toHaveLength(1); expect(attachments).toHaveLength(1);
      expect(fallback.artifactFailures).toEqual(["artifact: Error [ENOSPC]"]);
      for (const body of [...writes, ...attachments.map(value => value.toString())]) {
        const published = JSON.parse(body);
        expect(published.process).toEqual({version: "Chrome/141.0.0.0", gpu: {gpu: {devices: [device]}}});
        expect(published.failure).toBe("attempt: Error");
        for (const canary of canaries) { expect(body).not.toContain(canary); }
      }
    } finally { vi.restoreAllMocks(); }
  });

  it("keeps metadata projection failures text-free while retaining known failure codes", () => {
    const failure = Object.assign(new Error(canaries[3], {cause: {profilePath: canaries[1], commandLine: canaries[0]}}), {code: "EIO"});
    const info = {gpu: {get devices(): typeof device[] { throw failure; }}};
    let observed: unknown;
    try { projectHvpCutRtGpuInfo(info); } catch (error) { observed = error; }
    expect(observed).toBe(failure);
    expect(describeHvpCutRtFailure("attempt", observed)).toBe("attempt: Error [EIO]");
    for (const canary of canaries) { expect(describeHvpCutRtFailure("attempt", observed)).not.toContain(canary); }
  });
});

const sample = (overrides: Partial<HvpCutSample> = {}): HvpCutSample => ({
  commandId: "cut-1", scenario: "quarry", temperature: "cold", outcome: "Applied",
  inputMs: 10, appliedMs: 20, firstCommittedRenderSubmitMs: 30, holdMs: 5,
  sourceGenerationBefore: 0, sourceGenerationAfter: 1, reason: "Terrain and collision committed", ...overrides
});

it("uses the runner's exact diagnostic, qualification and formal session plans without acceptance shortcuts", () => {
  const ids = ["quarry-box", "quarry-sphere", "rock-arm", "body-box-moving", "body-box-sleeping", "body-sphere-moving", "body-sphere-sleeping"];
  const populations = ids.flatMap(id => [`${id}/cold`, `${id}/warm`]);
  for (const [value, sessions, attempts, perPopulation, schedule] of [
    [undefined, 14, 14, 1, [1]], ["diagnostic", 14, 14, 1, [1]],
    ["qualification", 14, 42, 3, [3]], ["measurement", 42, 1400, 100, [34, 33, 33]]
  ] as const) {
    const plan = planHvpCutRtSeries(value);
    expect(plan.sessions).toHaveLength(sessions);
    expect(plan.schedule).toEqual(schedule);
    expect(plan.sessions.reduce((count, session) => count + session.attempts, 0)).toBe(attempts);
    const counts = new Map<string, number>();
    for (const session of plan.sessions) {
      const key = `${session.variant.id}/${session.temperature}`;
      counts.set(key, (counts.get(key) ?? 0) + session.attempts);
      expect(Object.isFrozen(session) && Object.isFrozen(session.variant)).toBe(true);
    }
    expect([...counts.keys()]).toEqual(populations);
    expect([...counts.values()]).toEqual(Array(14).fill(perPopulation));
    expect(plan.doNotUseForAcceptance).toBe(value !== "measurement");
    expect(summarizeHvpCutRtSessions(plan, []).acceptance).toBe("NOT_ASSESSED");
  }
  expect(() => planHvpCutRtSeries("unknown")).toThrow("Unknown cut series classification");
  expect(() => planHvpCutRtSeries("")).toThrow("Unknown cut series classification");
});

it("retains all fourteen populations, unstarted/preflight attempts and warmups without pooling body motion", () => {
  const plan = planHvpCutRtSeries("qualification");
  const result = (overrides: Partial<HvpCutSample> = {}) => ({sample: sample(overrides), problems: [], raw: {entries: [], dropped: 0}});
  const records: HvpCutRtAttemptRecord[] = [
    {attempt: 1, status: "completed", result: result(), warmup: result({appliedMs: 1000, firstCommittedRenderSubmitMs: 1010}), problems: []},
    {attempt: 2, status: "failed", result: null, warmup: null, problems: ["precondition failed"]},
    {attempt: 3, status: "not-run", result: null, warmup: null, problems: []}
  ];
  const reports = [{variantId: "quarry-box", temperature: "cold", session: 1, failure: null, records},
    {variantId: "body-box-moving", temperature: "cold", session: 1, failure: "preflight failed",
      records: records.map(record => ({...record, status: "not-run" as const, result: null, warmup: null}))},
    {variantId: "body-box-sleeping", temperature: "cold", session: 1, failure: null,
      records: records.map(record => ({...record, status: "completed" as const,
        result: result({scenario: "body-box", appliedMs: 110, firstCommittedRenderSubmitMs: 120}), warmup: null}))}
  ] as const;
  const before = JSON.stringify(reports);
  const report = summarizeHvpCutRtSessions(plan, reports);
  expect(report).toMatchObject({acceptance: "NOT_ASSESSED", doNotUseForAcceptance: true, plannedSessions: 14, plannedAttempts: 42});
  expect(report.populations).toHaveLength(14);
  expect(report.populations[0]).toMatchObject({plannedAttempts: 3, completed: 1, failed: 1, notRun: 1,
    missingSamples: 2, warmups: 1, preconditionFailures: 1, observedDrops: 0,
    summary: {inputToAppliedMs: {count: 1, p95: 10}}});
  expect(report.populations[1]).toMatchObject({reportedSessions: 0, missingSessions: 1, notRun: 3, observedDrops: null,
    summary: {inputToAppliedMs: null, inputToCommittedRenderMs: null, holdMs: null}});
  expect(report.populations[6]).toMatchObject({notRun: 3, failures: ["preflight failed"], summary: {inputToAppliedMs: null}});
  expect(report.populations[8]).toMatchObject({completed: 3, summary: {inputToAppliedMs: {count: 3, p95: 100}}});
  expect(JSON.stringify(reports)).toBe(before);
  expect(() => summarizeHvpCutRtSessions(plan, [reports[0], reports[0]])).toThrow(/exact planned session/);
  expect(() => summarizeHvpCutRtSessions(plan, [{...reports[0], session: 2}])).toThrow(/exact planned session/);
  expect(() => summarizeHvpCutRtSessions(plan, [{...reports[0], records: records.slice(0, 1)}])).toThrow(/exact planned session/);
  expect(() => summarizeHvpCutRtSessions(plan, [{...reports[0], records: [{...records[0]!, attempt: 2}, ...records.slice(1)]}])).toThrow(/attempt record/);
  expect(() => summarizeHvpCutRtSessions(plan, [{...reports[0], variantId: "body-box-moving"}])).toThrow(/different planned population/);
});

describe("P07 command-bound marker extraction", () => {
  const entry = (phase: string, start: number, duration: number, commandId = "cut-1"): HvpCutRawEntry => ({
    name: `hvp.${phase}`, start, duration, detail: {data: {commandId}}
  });
  const entries = () => [entry("cutInputMs", 10, 0), entry("cutInputToAppliedMs", 10, 20),
    entry("cutFirstCommittedRenderSubmitMs", 10, 25)];

  it("uses the real input marker and terminal/render endpoints without mutating raw data", () => {
    const raw = Object.freeze(entries().map(value => Object.freeze(value)));
    const before = JSON.stringify(raw);
    expect(readHvpCutMarkers(raw, "cut-1", false)).toMatchObject({inputMs: 10, outcome: "Applied",
      appliedMs: 30, firstCommittedRenderSubmitMs: 35, problems: []});
    expect(JSON.stringify(raw)).toBe(before);
  });

  it("keeps a timed-out command's exact input but invents no terminal or render time", () => {
    expect(readHvpCutMarkers([entry("cutInputMs", 0, 0)], "cut-1", false)).toMatchObject({inputMs: 0,
      outcome: null, appliedMs: null, firstCommittedRenderSubmitMs: null, problems: []});
  });

  it("separates body/terrain namespaces and unrelated command IDs", () => {
    const raw = [...entries(), entry("cutBodyInputMs", 100, 0), entry("cutBodyInputToAppliedMs", 100, 5),
      entry("cutBodyFirstCommittedRenderSubmitMs", 100, 8), entry("cutBodyInputMs", 200, 0, "other")];
    expect(readHvpCutMarkers(raw, "cut-1", true)).toMatchObject({inputMs: 100, outcome: "Applied",
      appliedMs: 105, firstCommittedRenderSubmitMs: 108, problems: []});
  });

  it.each(["NoOp", "Rejected", "RecoveryHold"] as const)("does not turn %s into success timing", outcome => {
    expect(readHvpCutMarkers([entry("cutInputMs", 10, 0), entry(`cutInputTo${outcome}Ms`, 10, 5)], "cut-1", false))
      .toMatchObject({inputMs: 10, outcome, appliedMs: null, firstCommittedRenderSubmitMs: null, problems: []});
  });

  it.each([0, 1, 2])("rejects duplicate marker %i rather than choosing a convenient copy", index => {
    const raw = entries(); raw.push({...raw[index]!});
    expect(readHvpCutMarkers(raw, "cut-1", false).problems.length).toBeGreaterThan(0);
  });

  it.each([
    [entry("cutInputToAppliedMs", 10, 20)],
    [entry("cutInputMs", 10, 1)],
    [entry("cutInputMs", 10, 0), entry("cutInputToAppliedMs", 11, 20)],
    [entry("cutInputMs", 10, 0), entry("cutInputToAppliedMs", 10, NaN)],
    [entry("cutInputMs", 10, 0), entry("cutFirstCommittedRenderSubmitMs", 10, 30)],
    [entry("cutInputMs", 10, 0), entry("cutInputToAppliedMs", 10, 20), entry("cutFirstCommittedRenderSubmitMs", 10, 19)],
    [entry("cutInputMs", 10, 0), entry("cutInputToRejectedMs", 10, 20), entry("cutFirstCommittedRenderSubmitMs", 10, 21)]
  ])("reports missing, invalid or contradictory marker evidence %#", (...raw) => {
    expect(readHvpCutMarkers(raw, "cut-1", false).problems.length).toBeGreaterThan(0);
  });
});

it("binds a finite completed body hold only to its actual command and excludes manual or stale clocks",()=>{
  const matching={lastBodyCommandId:"moving-cut-1",lastBodyHoldMs:37.5,lastBodyManualPause:false};
  expect(readHvpBodyHoldForCommand(matching,"moving-cut-1")).toBe(37.5);
  expect(readHvpBodyHoldForCommand({...matching,lastBodyHoldMs:0},"moving-cut-1")).toBe(0);
  expect(readHvpBodyHoldForCommand(matching,"moving-cut-2")).toBeNull();
  expect(readHvpBodyHoldForCommand({...matching,lastBodyManualPause:true},"moving-cut-1")).toBeNull();
  expect(readHvpBodyHoldForCommand({...matching,lastBodyManualPause:undefined},"moving-cut-1")).toBeNull();
  expect(readHvpBodyHoldForCommand({...matching,lastBodyHoldMs:undefined},"moving-cut-1")).toBeNull();
  expect(readHvpBodyHoldForCommand({...matching,lastBodyHoldMs:NaN},"moving-cut-1")).toBeNull();
  expect(readHvpBodyHoldForCommand({...matching,lastBodyHoldMs:-1},"moving-cut-1")).toBeNull();
  expect(readHvpBodyHoldForCommand(null,"moving-cut-1")).toBeNull();
});
it("requires health published after the actual endpoint and refuses missing or failed sink data",()=>{
  const fresh={publishedOrigin:1000,publishedAt:30,timingSinkFailures:0};
  expect(isHvpCutHealthFresh(fresh,1000,30)).toBe(true);
  expect(isHvpCutHealthFresh({...fresh,publishedAt:29},1000,30)).toBe(false);
  expect(isHvpCutHealthFresh({...fresh,publishedOrigin:1001},1000,30)).toBe(false);
  expect(isHvpCutHealthFresh({...fresh,timingSinkFailures:1},1000,30)).toBe(false);
  expect(isHvpCutHealthFresh({...fresh,timingSinkFailures:null},1000,30)).toBe(false);
  expect(isHvpCutHealthFresh({...fresh,timingSinkFailures:undefined},1000,30)).toBe(false);
  expect(isHvpCutHealthFresh({...fresh,publishedAt:NaN},1000,30)).toBe(false);
  expect(isHvpCutHealthFresh(fresh,1000,Infinity)).toBe(false);
  expect(isHvpCutHealthFresh(null,1000,30)).toBe(false);
});
const quarry = (rows: readonly HvpCutSample[]) => summarizeHvpCuts(rows).groups[0]!;

describe("P07 descriptive cut report", () => {
  it("uses nearest rank for all quantiles without sorting or rewriting input", () => {
    const rows = Object.freeze(Array.from({length: 100}, (_, index) => Object.freeze(sample({
      commandId: `cut-${index}`, appliedMs: 110 - index, firstCommittedRenderSubmitMs: 120 - index
    }))));
    const before = JSON.stringify(rows);
    const report = quarry(rows);
    expect(report.inputToAppliedMs).toEqual({count: 100, p50: 50, p95: 95, p99: 99, max: 100});
    expect(report.inputToCommittedRenderMs).toEqual({count: 100, p50: 60, p95: 105, p99: 109, max: 110});
    expect(report.appliedToCommittedRenderMs).toEqual({count:100,p50:10,p95:10,p99:10,max:10});
    expect(report.completeApplied).toBe(100);
    expect(JSON.stringify(rows)).toBe(before);
    expect(summarizeHvpCuts(rows).acceptance).toBe("NOT_ASSESSED");
  });

  it("reports the maximum as nearest-rank p95 for fifteen samples", () => {
    expect(quarry(Array.from({length: 15}, (_, i) => sample({appliedMs: 11 + i, firstCommittedRenderSubmitMs: 30})))
      .inputToAppliedMs).toEqual({count: 15, p50: 8, p95: 15, p99: 15, max: 15});
  });

  it("keeps all eight scenario/temperature populations separate, including empty groups", () => {
    const report = summarizeHvpCuts([
      sample(), sample({temperature: "warm", appliedMs: 110, firstCommittedRenderSubmitMs: 120}),
      sample({scenario: "rock-arm", appliedMs: 210, firstCommittedRenderSubmitMs: 220}),
      sample({scenario: "body-box", sourceGenerationBefore: 1}),
      sample({scenario: "body-sphere", temperature: "warm", sourceGenerationBefore: 1})
    ]);
    expect(report.attempts).toBe(5);
    expect(report.groups).toHaveLength(8);
    expect(report.groups.map(g => g.attempts)).toEqual([1, 1, 1, 0, 1, 0, 0, 1]);
    expect(report.groups.slice(0, 3).map(g => g.inputToAppliedMs?.p95)).toEqual([10, 100, 200]);
    expect(report.groups[3]!.inputToAppliedMs).toBeNull();
    expect(report.groups[4]!.completeApplied).toBe(1); // Body cuts preserve the real terrain generation.
    expect(report.invalid).toEqual([]);
  });

  it("retains incomplete Applied and Timeout attempts instead of converting missing times to zero", () => {
    const report = summarizeHvpCuts([
      sample({appliedMs: null, firstCommittedRenderSubmitMs: null, holdMs: null, sourceGenerationAfter: null}),
      sample({outcome: "Timeout", appliedMs: null, firstCommittedRenderSubmitMs: null, holdMs: null, sourceGenerationAfter: null}),
      sample({inputMs: 0, appliedMs: 0, firstCommittedRenderSubmitMs: 0, holdMs: 0})
    ]);
    expect(report.attempts).toBe(3);
    expect(report.outcomes).toEqual({Applied: 2, NoOp: 0, Rejected: 0, RecoveryHold: 0, Timeout: 1});
    expect(report.groups[0]).toMatchObject({attempts: 3, completeApplied: 1, incompleteApplied: 1,
      missing: {applied: 1, committedRender: 1, sourceGenerationAfter: 1, hold: 2},
      inputToAppliedMs: {count: 1, p95: 0}, inputToCommittedRenderMs: {count: 1, p95: 0}, holdMs: {count: 1, p95: 0}});
    expect(report.acceptance).toBe("NOT_ASSESSED");
  });

  it("does not invent an Applied-to-render interval without both real endpoints",()=>{
    const report=quarry([sample({appliedMs:null,firstCommittedRenderSubmitMs:35}),
      sample({outcome:"Timeout",appliedMs:null,firstCommittedRenderSubmitMs:null,sourceGenerationAfter:null,holdMs:null})]);
    expect(report.appliedToCommittedRenderMs).toBeNull();
  });

  it("counts every terminal outcome and reports known hold durations without inventing success timings", () => {
    const report = quarry(["NoOp", "Rejected", "RecoveryHold"].map(outcome => sample({
      outcome: outcome as HvpCutSample["outcome"], appliedMs: null, firstCommittedRenderSubmitMs: null,
      holdMs: outcome === "NoOp" ? null : 40, sourceGenerationAfter: null
    })));
    expect(report.outcomes).toEqual({Applied: 0, NoOp: 1, Rejected: 1, RecoveryHold: 1, Timeout: 0});
    expect(report.inputToAppliedMs).toBeNull();
    expect(report.inputToCommittedRenderMs).toBeNull();
    expect(report.holdMs).toMatchObject({count: 2, p95: 40});
  });

  it.each([
    {inputMs: -1}, {inputMs: NaN}, {appliedMs: Infinity}, {appliedMs: 9},
    {firstCommittedRenderSubmitMs: -1}, {firstCommittedRenderSubmitMs: 19},
    {holdMs: -1}, {holdMs: NaN}, {sourceGenerationBefore: -1},
    {sourceGenerationAfter: 1.5}, {sourceGenerationAfter: Number.MAX_SAFE_INTEGER + 1},
    {outcome: "Rejected", appliedMs: 20}, {commandId: ""}, {reason: undefined}
  ])("reports invalid measurement %j rather than clamping or silently accepting it", invalid => {
    const report = summarizeHvpCuts([sample(invalid as Partial<HvpCutSample>)]);
    expect(report.attempts).toBe(1);
    expect(report.invalid).toHaveLength(1);
    expect(report.invalid[0]).toMatchObject({index: 0});
    expect(report.groups[0]!.invalidCount).toBe(1);
    expect(report.groups[0]!.inputToAppliedMs).toBeNull();
    expect(report.groups[0]!.holdMs).toBeNull();
  });

  it("counts unclassifiable and unknown-outcome records without assigning them to a valid population", () => {
    const rows = [null, sample({scenario: "unknown" as HvpCutSample["scenario"]}),
      sample({temperature: "hot" as HvpCutSample["temperature"]}),
      sample({outcome: "success" as HvpCutSample["outcome"]})] as HvpCutSample[];
    const report = summarizeHvpCuts(rows);
    expect(report.attempts).toBe(4);
    expect(report.invalid).toHaveLength(4);
    expect(report.unclassifiedAttempts).toBe(3);
    expect(report.unknownOutcomes).toBe(2);
    expect(report.outcomes.Applied).toBe(2);
    expect(report.groups[0]).toMatchObject({attempts: 1, invalidCount: 1});
  });

  it("does not deduplicate recurring command IDs from separately bound runtimes", () => {
    const report = quarry([sample(), sample()]);
    expect(report.attempts).toBe(2);
    expect(report.inputToAppliedMs?.count).toBe(2);
  });

  it("returns empty populations as missing rather than zero-millisecond successes", () => {
    const report = summarizeHvpCuts([]);
    expect(report.attempts).toBe(0);
    expect(report.invalid).toEqual([]);
    for (const group of report.groups) {
      expect(group).toMatchObject({attempts: 0, completeApplied: 0, inputToAppliedMs: null,
        inputToCommittedRenderMs: null, holdMs: null});
    }
  });
});

describe("P07 owning artifact and privacy boundaries", () => {
  const app = fileURLToPath(new URL("../..", import.meta.url));
  const root = "C:/IFI_SourceCode/Utils/opencode-migration/tmp/opencode/runner-contract-controlled";
  const evidence = () => {
    const series = planHvpCutRtSeries("qualification"), first = series.sessions[0]!;
    const records: HvpCutRtAttemptRecord[] = Array.from({length: first.attempts}, (_, index) =>
      ({attempt: index + 1, status: "not-run", result: null, warmup: null, problems: []}));
    return {series, records, failure: null as string | null, artifactFailures: [] as string[]};
  };

  it.each(["outside-source", "inside-app", "ancestor-junction"] as const)("rejects %s before any redirected write and attaches every planned record", async kind => {
    const mkdir = vi.spyOn(fs, "mkdir").mockResolvedValue(undefined);
    vi.spyOn(fs, "readdir").mockResolvedValue([]);
    const write = vi.spyOn(fs, "writeFile").mockResolvedValue(undefined);
    vi.spyOn(fs, "realpath").mockImplementation((async file => {
      const resolved = path.resolve(file as string);
      if (resolved === path.resolve(root)) {
        return kind === "inside-app" ? path.resolve(app, "evidence") : kind === "outside-source" ? "C:/FAKE_OUTSIDE_IFI" : resolved;
      }
      return resolved;
    }) as typeof fs.realpath);
    vi.spyOn(fs, "lstat").mockImplementation((async file => ({isDirectory: () => true,
      isSymbolicLink: () => kind === "ancestor-junction" && path.resolve(file as string) === path.dirname(path.resolve(root))})) as typeof fs.lstat);
    try {
      const report = evidence(), bodies: Buffer[] = []; let directory: string | undefined;
      try { directory = await createHvpCutRtEvidenceDirectory(root, app, "quarry-box-cold-1"); }
      catch (error) { report.failure = describeHvpCutRtFailure("preflight", error); }
      await persistHvpCutRtReport(directory, app, report, async body => { bodies.push(body); });
      expect(directory).toBeUndefined(); expect(mkdir).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
      expect(bodies).toHaveLength(1);
      const attached = JSON.parse(bodies[0]!.toString());
      expect(attached.failure).toContain("preflight"); expect(attached.records).toEqual(report.records);
      expect(attached.records.every((record: HvpCutRtAttemptRecord) => record.status === "not-run")).toBe(true);
      const summary = summarizeHvpCutRtSessions(report.series, []);
      expect(summary.plannedAttempts).toBe(42); expect(summary.populations).toHaveLength(14);
    } finally { vi.restoreAllMocks(); }
  });

  it.each(["first-write", "final-write"] as const)("retains first operation failure, warmups and raw markers after %s failure", async mode => {
    const report = evidence(), original = Object.assign(new Error("FAKE_OPERATION_TOKEN"), {code: "EACCES"});
    const write = vi.spyOn(fs, "writeFile").mockRejectedValue(Object.assign(new Error("FAKE_STORAGE_TOKEN"), {code: "ENOSPC"}));
    vi.spyOn(fs, "realpath").mockImplementation((async file => path.resolve(file as string)) as typeof fs.realpath);
    vi.spyOn(fs, "lstat").mockImplementation((async () => ({isDirectory: () => true, isSymbolicLink: () => false})) as unknown as typeof fs.lstat);
    const bodies: Buffer[] = [];
    try {
      if (mode === "first-write") {
        write.mockRejectedValueOnce(original);
        try { await fs.writeFile(path.join(root, "declared-plan.json"), "{}", {flag: "wx"}); }
        catch (error) { report.failure = describeHvpCutRtFailure("preflight", error); }
      } else {
        report.failure = describeHvpCutRtFailure("attempt", original);
        const raw = {entries: [{name: "hvp.cutInputMs", start: 10, duration: 0, detail: {data: {commandId: "cut-1"}}}], dropped: 0};
        report.records[0] = {attempt: 1, status: "failed", result: {sample: sample(), problems: [report.failure], raw},
          warmup: {sample: sample({appliedMs: 80, firstCommittedRenderSubmitMs: 90}), problems: [], raw}, problems: [report.failure]};
      }
      const firstFailure = report.failure, before = JSON.stringify(report.records);
      await persistHvpCutRtReport(root, app, report, async body => { bodies.push(body); });
      expect(bodies).toHaveLength(1);
      const attached = JSON.parse(bodies[0]!.toString());
      expect(attached.failure).toBe(firstFailure); expect(attached.artifactFailures).toHaveLength(1);
      expect(attached.artifactFailures[0]).toContain("ENOSPC"); expect(JSON.stringify(attached.records)).toBe(before);
      expect(attached.records).toHaveLength(3); expect(attached.records[2].status).toBe("not-run");
      if (mode === "final-write") { expect(attached.records[0].warmup.sample.appliedMs).toBe(80); expect(attached.records[0].result.raw.entries).toHaveLength(1); }
      expect(write.mock.calls.every(call => (call[2] as {flag: string}).flag === "wx")).toBe(true);
    } finally { vi.restoreAllMocks(); }
  });

  it("projects synthetic launch, page, console, nested-cut and cleanup failures without leaking text to file or attachment", async () => {
    const stages: HvpCutRtFailureStage[] = ["browser-launch", "page-error", "console-error", "cut", "page-cleanup", "browser-cleanup", "final-inventory"];
    const text = "FAKE_COMMAND --user-data-dir=C:/FAKE_PRIVATE_PROFILE --token=FAKE_TOKEN_9";
    const original = Object.assign(new Error(text), {code: "EACCES"});
    const problems = stages.map(stage => describeHvpCutRtFailure(stage, original));
    const bodies: string[] = [], report = {...evidence(), problems};
    vi.spyOn(fs, "writeFile").mockImplementation(async (_file, data) => { bodies.push(String(data)); });
    vi.spyOn(fs, "realpath").mockImplementation((async file => path.resolve(file as string)) as typeof fs.realpath);
    vi.spyOn(fs, "lstat").mockImplementation((async () => ({isDirectory: () => true, isSymbolicLink: () => false})) as unknown as typeof fs.lstat);
    try {
      await persistHvpCutRtReport(root, app, report, async body => { bodies.push(body.toString()); });
      await persistHvpCutRtReport(undefined, app, report, async body => { bodies.push(body.toString()); });
      expect(bodies).toHaveLength(2);
      for (const body of bodies) {
        for (const sentinel of ["FAKE_COMMAND", "FAKE_PRIVATE_PROFILE", "FAKE_TOKEN_9"]) { expect(body).not.toContain(sentinel); }
        for (const stage of stages) { expect(body).toContain(stage); }
        expect(body).toContain("EACCES");
      }
      expect(original.message).toBe(text);
      const hostile = Object.assign(new Error(text), {name: "FAKE_PRIVATE_PROFILE", code: "FAKE_TOKEN_9"});
      expect(describeHvpCutRtFailure("cut", hostile)).toBe("cut: Error");
    } finally { vi.restoreAllMocks(); }
  });

  it("creates one exclusive safe directory and emits relative inventories with unchanged actual hashes", async () => {
    const fixture = await fs.mkdtemp("C:/IFI_SourceCode/Utils/opencode-migration/tmp/opencode/hvp-runner-contract-fixture-");
    console.info("RUNNER_CONTRACT_SAFE_ADDITIVE_FIXTURE", fixture);
    const directory = await createHvpCutRtEvidenceDirectory(fixture, app, "quarry-box-cold-1");
    await fs.mkdir(path.join(directory, "src")); await fs.mkdir(path.join(directory, "dist"));
    await fs.writeFile(path.join(directory, "src", "source.txt"), "abc", {flag: "wx"});
    await fs.writeFile(path.join(directory, "dist", "build.txt"), "abc", {flag: "wx"});
    const hash = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    expect(await inventoryHvpCutRtFiles(path.join(directory, "src"), directory)).toEqual([{path: "src/source.txt", sha256: hash}]);
    expect(await inventoryHvpCutRtFiles(path.join(directory, "dist"), directory)).toEqual([{path: "dist/build.txt", sha256: hash}]);
    await expect(createHvpCutRtEvidenceDirectory(fixture, app, "quarry-box-cold-1")).rejects.toThrow();
    await fs.writeFile(path.join(directory, "report.json"), "previous-artifact", {flag: "wx"});
    const report = evidence(), bodies: Buffer[] = [];
    await persistHvpCutRtReport(directory, app, report, async body => { bodies.push(body); });
    expect(await fs.readFile(path.join(directory, "report.json"), "utf8")).toBe("previous-artifact");
    expect(report.artifactFailures).toEqual(["artifact: Error [EEXIST]"]); expect(bodies).toHaveLength(1);
  });

  it("rechecks a created directory before final persistence and falls back without redirected writes", async () => {
    vi.spyOn(fs, "mkdir").mockResolvedValue(undefined);
    vi.spyOn(fs, "lstat").mockImplementation((async () => ({isDirectory: () => true, isSymbolicLink: () => false})) as unknown as typeof fs.lstat);
    const resolve = vi.spyOn(fs, "realpath").mockImplementation((async file => path.resolve(file as string)) as typeof fs.realpath);
    const write = vi.spyOn(fs, "writeFile").mockResolvedValue(undefined);
    try {
      const directory = await createHvpCutRtEvidenceDirectory(root, app, "quarry-box-cold-1");
      resolve.mockImplementation((async file => path.resolve(file as string) === path.resolve(directory) ? "C:/FAKE_REDIRECTED_AFTER_PREFLIGHT" : path.resolve(file as string)) as typeof fs.realpath);
      const report = evidence(), bodies: Buffer[] = [];
      await persistHvpCutRtReport(directory, app, report, async body => { bodies.push(body); });
      expect(write).not.toHaveBeenCalled(); expect(bodies).toHaveLength(1);
      expect(JSON.parse(bodies[0]!.toString()).records).toEqual(report.records);
      expect(report.artifactFailures).toEqual(["artifact: Error"]);
    } finally { vi.restoreAllMocks(); }
  });
});
