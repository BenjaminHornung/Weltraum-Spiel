import type { FactoryAssetProjection } from "./factoryAssets";
import { deepFreezeMetadata } from "../../presentation";
export interface MachineReadView {
  readonly projection: FactoryAssetProjection; readonly status: string; readonly confirmedWorkMs: number;
  readonly presentPartIds: readonly string[]; readonly damageRevision: number;
}
export interface MachinePose {
  readonly status: string; readonly phase: string; readonly paused: boolean;
  readonly partPoses: readonly Readonly<{ partId: string; translationM: readonly number[] }>[];
}
const states = new Set(["UNPLACED", "CONSTRUCTING", "IDLE", "WAIT_INPUT", "WAIT_POWER", "WAIT_OUTPUT", "WAIT_WASTE", "RUNNING", "STOPPING", "BLOCKED", "FAULT", "DECONSTRUCTING"]);
const labels = ["infeed", "clamp", "work", "return", "outfeed", "complete"];

/** Render time is deliberately unable to advance confirmed work or create lots. */
export const sampleMachinePose = (read: MachineReadView, presentationTime: number): MachinePose => {
  if (!Number.isFinite(presentationTime) || presentationTime < 0 || !Number.isSafeInteger(read.confirmedWorkMs) || read.confirmedWorkMs < 0
    || !Number.isSafeInteger(read.damageRevision) || read.damageRevision < 0) throw new Error("Invalid machine presentation sample");
  const present = new Set(read.presentPartIds);
  if (present.size !== read.presentPartIds.length || [...present].some(id => !read.projection.parts.some(part => part.partId === id))) throw new Error("Invalid machine part read view");
  const profile = read.projection.source.phaseMotionProfile;
  const timing = profile?.phaseEndsMs;
  const work = Math.min(read.confirmedWorkMs, timing?.[4] ?? 0);
  const phase = timing ? timing.findIndex(end => work < end) : -1;
  let toolOffset = 0;
  if (timing && work >= timing[1]! && work <= timing[2]!) {
    const progress = (work - timing[1]!) / (timing[2]! - timing[1]!);
    toolOffset = read.projection.definitionRef.sourceId === "B06" ? -0.25 + 0.5 * progress : -0.5 * Math.sin(Math.PI * progress * profile!.toolCycles) ** 2;
  } else if (timing && work >= timing[0]! && work < timing[1]! && read.projection.definitionRef.sourceId === "B06") {
    toolOffset = -0.25 * (work - timing[0]!) / (timing[1]! - timing[0]!);
  } else if (timing && work > timing[2]! && work < timing[3]! && read.projection.definitionRef.sourceId === "B06") {
    toolOffset = 0.25 * (1 - (work - timing[2]!) / (timing[3]! - timing[2]!));
  }
  const status = states.has(read.status) ? read.status : "UNKNOWN";
  const partPoses = read.projection.parts.filter(part => present.has(part.partId)).map(part => {
    const channel = profile?.channels.find(value => value.partId === part.partId);
    const segment = channel?.segments.find(value => work >= value.startMs && work <= value.endMs);
    const offset = segment ? segment.fromM + (segment.toM - segment.fromM) * (work - segment.startMs) / (segment.endMs - segment.startMs) : 0;
    return { partId: part.partId, translationM: channel ? channel.axis.map(value => value * offset)
      : part.role === "tool" ? (read.projection.definitionRef.sourceId === "B06" ? [0, 0, toolOffset] : [0, toolOffset, 0]) : [0, 0, 0] };
  });
  return deepFreezeMetadata({ status, phase: timing ? labels[phase < 0 ? 5 : phase]! : "idle", paused: status !== "RUNNING", partPoses });
};
