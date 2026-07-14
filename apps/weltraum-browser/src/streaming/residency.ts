export const RESIDENCY_STATES = Object.freeze([
  "NotRequested",
  "Queued",
  "Loading",
  "Ready",
  "Failed",
  "Evicted",
  "Cancelled"
] as const);

export type ResidencyState = (typeof RESIDENCY_STATES)[number];

const transitions = Object.freeze({
  NotRequested: Object.freeze(["Queued"]),
  Queued: Object.freeze(["Loading", "Cancelled", "Failed"]),
  Loading: Object.freeze(["Ready", "Cancelled", "Failed"]),
  Ready: Object.freeze(["Evicted", "Queued"]),
  Failed: Object.freeze(["Queued"]),
  Evicted: Object.freeze(["Queued"]),
  Cancelled: Object.freeze(["Queued"])
} satisfies Readonly<Record<ResidencyState, readonly ResidencyState[]>>);

export class ResidencyTransitionError extends Error {
  public constructor(
    public readonly from: ResidencyState,
    public readonly to: ResidencyState
  ) {
    super(`Invalid residency transition: ${from} -> ${to}.`);
    this.name = "ResidencyTransitionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const isResidencyState = (value: unknown): value is ResidencyState =>
  typeof value === "string" && (RESIDENCY_STATES as readonly string[]).includes(value);

export const canTransitionResidency = (from: ResidencyState, to: ResidencyState): boolean =>
  (transitions[from] as readonly ResidencyState[]).includes(to);

export const transitionResidency = (from: ResidencyState, to: ResidencyState): ResidencyState => {
  if (!canTransitionResidency(from, to)) {
    throw new ResidencyTransitionError(from, to);
  }
  return to;
};

export const getAllowedResidencyTransitions = (from: ResidencyState): readonly ResidencyState[] => transitions[from];
