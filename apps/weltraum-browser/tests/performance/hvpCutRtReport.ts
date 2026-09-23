import {nearestRank} from "../e2e/hvp-performance-evidence";

export interface HvpCutSample {
  readonly commandId: string;
  readonly scenario: "quarry" | "rock-arm" | "body-box" | "body-sphere";
  readonly temperature: "cold" | "warm";
  readonly outcome: "Applied" | "NoOp" | "Rejected" | "RecoveryHold" | "Timeout";
  readonly inputMs: number;
  readonly appliedMs: number | null;
  readonly firstCommittedRenderSubmitMs: number | null;
  readonly holdMs: number | null;
  readonly sourceGenerationBefore: number;
  readonly sourceGenerationAfter: number | null;
  readonly reason: string;
}

const scenarios = ["quarry", "rock-arm", "body-box", "body-sphere"] as const;
const temperatures = ["cold", "warm"] as const;
const outcomeCounts = () => ({Applied: 0, NoOp: 0, Rejected: 0, RecoveryHold: 0, Timeout: 0});
const finite = (value: number) => Number.isFinite(value) && value >= 0;
const generation = (value: number) => Number.isSafeInteger(value) && value >= 0;
const summary = (values: readonly number[]) => values.length === 0 ? null : {
  count: values.length, p50: nearestRank(values, .5), p95: nearestRank(values, .95),
  p99: nearestRank(values, .99), max: values.reduce((max, value) => Math.max(max, value), 0)
};

export interface HvpCutRawEntry {
  readonly name: string;
  readonly start: number;
  readonly duration: number;
  readonly detail: {readonly data?: Readonly<Record<string, unknown>>} | null;
}

/** One already-scoped document/attempt. Missing input is not replaced by the automation clock. */
export function readHvpCutMarkers(entries: readonly HvpCutRawEntry[], commandId: string, body: boolean) {
  const prefix = body ? "hvp.cutBody" : "hvp.cut";
  const statuses = ["Applied", "NoOp", "Rejected", "RecoveryHold"] as const;
  const problems: string[] = [];
  const matching = entries.filter(entry => entry.detail?.data?.commandId === commandId);
  const one = (values: readonly HvpCutRawEntry[], label: string) => {
    if (values.length > 1) { problems.push(`Duplicate ${label} marker`); }
    const value = values.length === 1 ? values[0] : undefined;
    if (value && (!finite(value.start) || !finite(value.duration) || !Number.isFinite(value.start + value.duration))) {
      problems.push(`Invalid ${label} timing`); return undefined;
    }
    return value;
  };
  const input = one(matching.filter(entry => entry.name === `${prefix}InputMs`), "input");
  const terminal = one(matching.filter(entry => statuses.some(status => entry.name === `${prefix}InputTo${status}Ms`)), "terminal");
  const render = one(matching.filter(entry => entry.name === `${prefix}FirstCommittedRenderSubmitMs`), "render");
  if (!input) { problems.push("Missing exact input marker"); }
  else if (input.duration !== 0) { problems.push("Input marker is not an instant"); }
  const outcome = terminal ? statuses.find(status => terminal.name === `${prefix}InputTo${status}Ms`)! : null;
  if (terminal && terminal.start !== input?.start) { problems.push("Terminal belongs to a different input time"); }
  if (render && (outcome !== "Applied" || render.start !== input?.start
    || render.start + render.duration < terminal!.start + terminal!.duration)) {
    problems.push("Render is not after this Applied input");
  }
  return {inputMs: input?.start ?? null, outcome,
    appliedMs: outcome === "Applied" ? terminal!.start + terminal!.duration : null,
    firstCommittedRenderSubmitMs: outcome === "Applied" && render ? render.start + render.duration : null,
    renderBinding: render?.detail?.data ?? null, problems};
}

/** Descriptive only: runtime/source binding, planned attempts and device eligibility belong to the runner. */
export function summarizeHvpCuts(samples: readonly HvpCutSample[]) {
  if (!Array.isArray(samples)) {
    throw new Error("Cut samples must be an array");
  }
  const groups = scenarios.flatMap(scenario => temperatures.map(temperature => ({
    scenario, temperature, attempts: 0, outcomes: outcomeCounts(), invalidCount: 0,
    completeApplied: 0, incompleteApplied: 0,
    missing: {applied: 0, committedRender: 0, sourceGenerationAfter: 0, hold: 0},
    applied: [] as number[], render: [] as number[], hold: [] as number[]
  })));
  const outcomes = outcomeCounts();
  const invalid: {index: number; commandId: string | null; reasons: string[]}[] = [];
  let unknownOutcomes = 0, unclassifiedAttempts = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const row: HvpCutSample | undefined = samples[index];
    if (row === null || typeof row !== "object") {
      invalid.push({index, commandId: null, reasons: ["Invalid sample record"]});
      unknownOutcomes += 1;
      unclassifiedAttempts += 1;
      continue;
    }
    const group = groups.find(g => g.scenario === row.scenario && g.temperature === row.temperature);
    if (group) {
      group.attempts += 1;
    } else {
      unclassifiedAttempts += 1;
    }
    const reasons: string[] = [];
    if (!group) {
      reasons.push("Unknown scenario or temperature");
    }
    if (Object.hasOwn(outcomes, row.outcome)) {
      outcomes[row.outcome] += 1;
      if (group) {
        group.outcomes[row.outcome] += 1;
      }
    } else {
      unknownOutcomes += 1;
      reasons.push("Unknown outcome");
    }
    if (typeof row.commandId !== "string" || row.commandId.length === 0 || row.commandId.length > 128
      || typeof row.reason !== "string") {
      reasons.push("Invalid command identity or reason");
    }
    if (!finite(row.inputMs) || (row.appliedMs !== null && !finite(row.appliedMs))
      || (row.firstCommittedRenderSubmitMs !== null && !finite(row.firstCommittedRenderSubmitMs))
      || (row.holdMs !== null && !finite(row.holdMs))) {
      reasons.push("Invalid timing measurement");
    }
    if (finite(row.inputMs) && ((row.appliedMs !== null && finite(row.appliedMs) && row.appliedMs < row.inputMs)
      || (row.firstCommittedRenderSubmitMs !== null && finite(row.firstCommittedRenderSubmitMs)
        && row.firstCommittedRenderSubmitMs < (row.appliedMs ?? row.inputMs)))) {
      reasons.push("Reversed input/Applied/render timeline");
    }
    if (!generation(row.sourceGenerationBefore)
      || (row.sourceGenerationAfter !== null && (!generation(row.sourceGenerationAfter)
        || row.sourceGenerationAfter < row.sourceGenerationBefore))) {
      reasons.push("Invalid source generation");
    }
    if (row.outcome !== "Applied" && (row.appliedMs !== null || row.firstCommittedRenderSubmitMs !== null)) {
      reasons.push("Non-Applied outcome has success timestamps");
    }
    if (reasons.length > 0 || group === undefined) {
      invalid.push({index, commandId: typeof row.commandId === "string" ? row.commandId : null, reasons});
      if (group) {
        group.invalidCount += 1;
      }
      continue;
    }
    if (row.holdMs === null) {
      group.missing.hold += 1;
    } else {
      group.hold.push(row.holdMs);
    }
    if (row.outcome !== "Applied") {
      continue;
    }
    if (row.appliedMs === null) {
      group.missing.applied += 1;
    } else {
      group.applied.push(row.appliedMs - row.inputMs);
    }
    if (row.firstCommittedRenderSubmitMs === null) {
      group.missing.committedRender += 1;
    } else {
      group.render.push(row.firstCommittedRenderSubmitMs - row.inputMs);
    }
    if (row.sourceGenerationAfter === null) {
      group.missing.sourceGenerationAfter += 1;
    }
    if (row.appliedMs === null || row.firstCommittedRenderSubmitMs === null || row.sourceGenerationAfter === null) {
      group.incompleteApplied += 1;
    } else {
      group.completeApplied += 1;
    }
  }
  return {
    acceptance: "NOT_ASSESSED" as const, attempts: samples.length, outcomes, unknownOutcomes, unclassifiedAttempts, invalid,
    groups: groups.map(({applied, render, hold, ...group}) => ({...group,
      inputToAppliedMs: summary(applied), inputToCommittedRenderMs: summary(render), holdMs: summary(hold)}))
  };
}
