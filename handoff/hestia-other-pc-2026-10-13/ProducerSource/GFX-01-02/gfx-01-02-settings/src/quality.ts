export type TargetFps = 30 | 60 | 90 | 120;

export interface DesiredQuality {
  readonly enabled: boolean;
  readonly minRenderScale: number;
  readonly maxRenderScale: number;
  readonly minDevicePixelRatio: number;
  readonly maxDevicePixelRatio: number;
  readonly targetFps: TargetFps;
}

export interface CurrentQuality {
  readonly renderScale: number;
  readonly maxDevicePixelRatio: number;
}

export interface QualityMetrics {
  readonly sequence: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly sampleCount: number;
  readonly frameP50Ms: number;
  readonly frameP95Ms: number;
  readonly cpuP95Ms: number | null;
  readonly gpuP95Ms: number | null;
  readonly visible: boolean;
  readonly warmed: boolean;
  readonly valid: boolean;
  readonly referenceFrozen: boolean;
  readonly maxRenderScale: number;
  readonly maxDevicePixelRatio: number;
  readonly capabilityRevision: number;
}

export interface QualityControllerState {
  readonly slowWindows: number;
  readonly reserveWindows: number;
  readonly cooldownUntilMs: number;
  readonly lastWindowSequence: number | null;
  readonly lastWindowStartMs: number | null;
  readonly lastWindowEndMs: number | null;
  readonly policyBinding: string;
}

export type QualityAction =
  | "hold"
  | "clamp"
  | "reduce-render-scale"
  | "reduce-device-pixel-ratio"
  | "increase-device-pixel-ratio"
  | "increase-render-scale";

export interface QualityDecision {
  readonly quality: CurrentQuality;
  readonly state: QualityControllerState;
  readonly action: QualityAction;
  readonly reason: string;
}

export const INITIAL_QUALITY_CONTROLLER_STATE: QualityControllerState = Object.freeze({
  slowWindows: 0,
  reserveWindows: 0,
  cooldownUntilMs: 0,
  lastWindowSequence: null,
  lastWindowStartMs: null,
  lastWindowEndMs: null,
  policyBinding: ""
});

const MIN_SAMPLE_COUNT = 30;
const MAX_SAMPLE_COUNT = 300;
const MIN_WINDOW_DURATION_MS = 400;
const MAX_WINDOW_GAP_MS = 2_000;
const DOWNSCALE_WINDOW_COUNT = 3;
const UPSCALE_WINDOW_COUNT = 8;
const COOLDOWN_MS = 2_000;

const isFinitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;
const isIntegerAtLeast = (value: number, minimum: number): boolean =>
  Number.isInteger(value) && value >= minimum;

const assertDesired = (desired: DesiredQuality): void => {
  if (typeof desired.enabled !== "boolean" ||
      !isFinitePositive(desired.minRenderScale) ||
      !isFinitePositive(desired.maxRenderScale) ||
      desired.minRenderScale > desired.maxRenderScale ||
      !isFinitePositive(desired.minDevicePixelRatio) ||
      !isFinitePositive(desired.maxDevicePixelRatio) ||
      desired.minDevicePixelRatio > desired.maxDevicePixelRatio ||
      !([30, 60, 90, 120] as number[]).includes(desired.targetFps)) {
    throw new RangeError("Desired quality limits must be finite, positive, ordered, and use a supported target FPS.");
  }
};

const assertCurrent = (current: CurrentQuality): void => {
  if (!isFinitePositive(current.renderScale) || !isFinitePositive(current.maxDevicePixelRatio)) {
    throw new RangeError("Current render scale and device pixel ratio must be finite and positive.");
  }
};

const assertState = (state: QualityControllerState): void => {
  if (!isIntegerAtLeast(state.slowWindows, 0) ||
      !isIntegerAtLeast(state.reserveWindows, 0) ||
      !Number.isFinite(state.cooldownUntilMs) ||
      state.cooldownUntilMs < 0 ||
      (state.lastWindowSequence !== null && !isIntegerAtLeast(state.lastWindowSequence, 1)) ||
      (state.lastWindowStartMs !== null && !Number.isFinite(state.lastWindowStartMs)) ||
      (state.lastWindowEndMs !== null && !Number.isFinite(state.lastWindowEndMs)) ||
      typeof state.policyBinding !== "string") {
    throw new RangeError("Quality controller state is invalid.");
  }
};

const metricsIdentityIsValid = (metrics: QualityMetrics): boolean =>
  isIntegerAtLeast(metrics.sequence, 1) &&
  Number.isFinite(metrics.startMs) &&
  Number.isFinite(metrics.endMs) &&
  metrics.startMs >= 0 &&
  metrics.endMs > metrics.startMs;

const policyBinding = (desired: DesiredQuality, metrics: QualityMetrics): string => JSON.stringify([
  desired.enabled,
  desired.minRenderScale,
  desired.maxRenderScale,
  desired.minDevicePixelRatio,
  desired.maxDevicePixelRatio,
  desired.targetFps,
  metrics.capabilityRevision,
  metrics.maxRenderScale,
  metrics.maxDevicePixelRatio
]);

const validCapabilities = (metrics: QualityMetrics): boolean =>
  isFinitePositive(metrics.maxRenderScale) &&
  isFinitePositive(metrics.maxDevicePixelRatio) &&
  isIntegerAtLeast(metrics.capabilityRevision, 0);

const roundHundredth = (value: number): number => Math.round(value * 100) / 100;

const makeDecision = (
  quality: CurrentQuality,
  state: QualityControllerState,
  reason: string,
  action: QualityAction = "hold"
): QualityDecision => Object.freeze({
  quality: Object.freeze({ ...quality }),
  state: Object.freeze({ ...state }),
  action,
  reason
});

export function decideQuality(
  metrics: QualityMetrics,
  desired: DesiredQuality,
  current: CurrentQuality,
  controllerState: QualityControllerState
): QualityDecision {
  assertDesired(desired);
  assertCurrent(current);
  assertState(controllerState);

  let state: QualityControllerState = { ...controllerState };
  if (!metricsIdentityIsValid(metrics)) {
    return makeDecision(current, { ...state, slowWindows: 0, reserveWindows: 0 }, "invalid-window");
  }

  const repeatedOrOutOfOrder =
    (state.lastWindowSequence !== null && metrics.sequence <= state.lastWindowSequence) ||
    (state.lastWindowEndMs !== null && metrics.startMs < state.lastWindowEndMs);
  if (repeatedOrOutOfOrder) {
    return makeDecision(current, { ...state, slowWindows: 0, reserveWindows: 0 }, "repeated-or-out-of-order-window");
  }

  if (!validCapabilities(metrics)) {
    state = {
      ...state,
      slowWindows: 0,
      reserveWindows: 0,
      lastWindowSequence: metrics.sequence,
      lastWindowStartMs: metrics.startMs,
      lastWindowEndMs: metrics.endMs
    };
    return makeDecision(current, state, "invalid-capability");
  }

  const binding = policyBinding(desired, metrics);
  const bindingChanged = state.policyBinding !== binding;
  const sequenceGap = state.lastWindowSequence !== null && metrics.sequence !== state.lastWindowSequence + 1;
  const timeGap = state.lastWindowEndMs !== null && metrics.startMs - state.lastWindowEndMs > MAX_WINDOW_GAP_MS;
  if (bindingChanged || sequenceGap || timeGap) {
    state = { ...state, slowWindows: 0, reserveWindows: 0, policyBinding: binding };
  }

  const maxScale = desired.enabled ? Math.min(desired.maxRenderScale, metrics.maxRenderScale) : metrics.maxRenderScale;
  const maxDpr = desired.enabled ? Math.min(desired.maxDevicePixelRatio, metrics.maxDevicePixelRatio) : metrics.maxDevicePixelRatio;
  const minScale = desired.enabled ? Math.min(desired.minRenderScale, maxScale) : Math.min(current.renderScale, maxScale);
  const minDpr = desired.enabled ? Math.min(desired.minDevicePixelRatio, maxDpr) : Math.min(current.maxDevicePixelRatio, maxDpr);
  const clamped: CurrentQuality = {
    renderScale: Math.max(minScale, Math.min(current.renderScale, maxScale)),
    maxDevicePixelRatio: Math.max(minDpr, Math.min(current.maxDevicePixelRatio, maxDpr))
  };
  const wasClamped = clamped.renderScale !== current.renderScale ||
    clamped.maxDevicePixelRatio !== current.maxDevicePixelRatio;
  const capabilityClamp = current.renderScale > metrics.maxRenderScale ||
    current.maxDevicePixelRatio > metrics.maxDevicePixelRatio;

  if (metrics.referenceFrozen) {
    state = {
      ...state,
      slowWindows: 0,
      reserveWindows: 0,
      policyBinding: binding,
      lastWindowSequence: metrics.sequence,
      lastWindowStartMs: metrics.startMs,
      lastWindowEndMs: metrics.endMs
    };
    const exceedsCapability = current.renderScale > metrics.maxRenderScale ||
      current.maxDevicePixelRatio > metrics.maxDevicePixelRatio;
    return makeDecision(current, state, exceedsCapability ? "reference-frozen-reprofile-required" : "reference-frozen");
  }

  state = {
    ...state,
    policyBinding: binding,
    lastWindowSequence: metrics.sequence,
    lastWindowStartMs: metrics.startMs,
    lastWindowEndMs: metrics.endMs
  };

  if (wasClamped) {
    state = { ...state, slowWindows: 0, reserveWindows: 0 };
    return makeDecision(clamped, state, capabilityClamp ? "capability-clamp" : "manual-clamp", "clamp");
  }

  if (!desired.enabled) {
    return makeDecision(current, { ...state, slowWindows: 0, reserveWindows: 0 }, "adaptive-disabled");
  }

  if (metrics.valid !== true) {
    return makeDecision(current, { ...state, slowWindows: 0, reserveWindows: 0 }, "invalid-window");
  }
  if (metrics.visible !== true || metrics.warmed !== true) {
    return makeDecision(current, { ...state, slowWindows: 0, reserveWindows: 0 }, "ineligible-window");
  }
  if (!Number.isInteger(metrics.sampleCount) ||
      metrics.sampleCount < MIN_SAMPLE_COUNT ||
      metrics.sampleCount > MAX_SAMPLE_COUNT ||
      !isFinitePositive(metrics.frameP50Ms) ||
      !isFinitePositive(metrics.frameP95Ms) ||
      metrics.endMs - metrics.startMs < MIN_WINDOW_DURATION_MS) {
    return makeDecision(current, { ...state, slowWindows: 0, reserveWindows: 0 }, "ineligible-window");
  }
  if (!isFinitePositive(metrics.cpuP95Ms ?? Number.NaN) ||
      !isFinitePositive(metrics.gpuP95Ms ?? Number.NaN)) {
    return makeDecision(current, { ...state, slowWindows: 0, reserveWindows: 0 }, "missing-sensor");
  }

  if (metrics.startMs < state.cooldownUntilMs) {
    return makeDecision(current, { ...state, slowWindows: 0, reserveWindows: 0 }, "cooldown");
  }

  const budgetMs = 1_000 / desired.targetFps;
  const overloaded = metrics.frameP95Ms > budgetMs * 1.1;
  const cpuMs = metrics.cpuP95Ms!;
  const gpuMs = metrics.gpuP95Ms!;
  if (cpuMs >= budgetMs * 0.85 || (overloaded && cpuMs >= gpuMs)) {
    return makeDecision(current, { ...state, slowWindows: 0, reserveWindows: 0 }, "cpu-bound");
  }

  if (overloaded && gpuMs > budgetMs * 0.85) {
    const slowWindows = (sequenceGap || timeGap || bindingChanged) ? 1 : state.slowWindows + 1;
    if (slowWindows < DOWNSCALE_WINDOW_COUNT) {
      return makeDecision(current, { ...state, slowWindows, reserveWindows: 0 }, "gpu-pressure-hysteresis");
    }
    let nextQuality: CurrentQuality = current;
    let action: QualityAction = "hold";
    if (current.renderScale > minScale) {
      nextQuality = { ...current, renderScale: Math.max(minScale, roundHundredth(current.renderScale - 0.1)) };
      action = "reduce-render-scale";
    } else if (current.maxDevicePixelRatio > minDpr) {
      nextQuality = {
        ...current,
        maxDevicePixelRatio: Math.max(minDpr, roundHundredth(current.maxDevicePixelRatio - 0.25))
      };
      action = "reduce-device-pixel-ratio";
    }
    if (action === "hold") {
      return makeDecision(current, { ...state, slowWindows: 0, reserveWindows: 0 }, "quality-at-minimum");
    }
    return makeDecision(nextQuality, {
      ...state,
      slowWindows: 0,
      reserveWindows: 0,
      cooldownUntilMs: metrics.endMs + COOLDOWN_MS
    }, "sustained-gpu-pressure", action);
  }

  const reserved = metrics.frameP95Ms < budgetMs * 0.75 &&
    cpuMs < budgetMs * 0.75 &&
    gpuMs < budgetMs * 0.75;
  if (reserved) {
    const reserveWindows = (sequenceGap || timeGap || bindingChanged) ? 1 : state.reserveWindows + 1;
    if (reserveWindows < UPSCALE_WINDOW_COUNT) {
      return makeDecision(current, { ...state, slowWindows: 0, reserveWindows }, "reserve-hysteresis");
    }
    let nextQuality: CurrentQuality = current;
    let action: QualityAction = "hold";
    if (current.maxDevicePixelRatio < maxDpr) {
      nextQuality = {
        ...current,
        maxDevicePixelRatio: Math.min(maxDpr, roundHundredth(current.maxDevicePixelRatio + 0.25))
      };
      action = "increase-device-pixel-ratio";
    } else if (current.renderScale < maxScale) {
      nextQuality = { ...current, renderScale: Math.min(maxScale, roundHundredth(current.renderScale + 0.1)) };
      action = "increase-render-scale";
    }
    if (action === "hold") {
      return makeDecision(current, { ...state, slowWindows: 0, reserveWindows: 0 }, "quality-at-maximum");
    }
    return makeDecision(nextQuality, {
      ...state,
      slowWindows: 0,
      reserveWindows: 0,
      cooldownUntilMs: metrics.endMs + COOLDOWN_MS
    }, "sustained-reserve", action);
  }

  return makeDecision(current, { ...state, slowWindows: 0, reserveWindows: 0 }, "within-hysteresis-band");
}
