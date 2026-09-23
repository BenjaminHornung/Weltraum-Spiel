import {describe, expect, it} from "vitest";
import {readHvpCutMarkers, summarizeHvpCuts, type HvpCutSample, type HvpCutRawEntry} from "../performance/hvpCutRtReport";

const sample = (overrides: Partial<HvpCutSample> = {}): HvpCutSample => ({
  commandId: "cut-1", scenario: "quarry", temperature: "cold", outcome: "Applied",
  inputMs: 10, appliedMs: 20, firstCommittedRenderSubmitMs: 30, holdMs: 5,
  sourceGenerationBefore: 0, sourceGenerationAfter: 1, reason: "Terrain and collision committed", ...overrides
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
