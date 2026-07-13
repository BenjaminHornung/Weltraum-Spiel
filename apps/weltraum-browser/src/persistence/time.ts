import type { PersistenceBrand } from "./ids";

export const UNIVERSE_TICKS_PER_SECOND = 120;

export type SimulationTick = PersistenceBrand<number, "SimulationTick">;
export type EpochSeconds = PersistenceBrand<number, "EpochSeconds">;
export type TimeRoundingMode = "exact" | "floor" | "ceil" | "nearest";

export interface UniverseTime {
  readonly tick: SimulationTick;
  readonly epochSeconds: EpochSeconds;
}

export interface MissionTime {
  readonly tick: SimulationTick;
}

export type UniverseTimeErrorCode =
  | "INVALID_TICK"
  | "INVALID_SECONDS"
  | "INVALID_ROUNDING_MODE"
  | "INEXACT_SECONDS"
  | "TIME_OVERFLOW"
  | "INCONSISTENT_UNIVERSE_TIME";

export class UniverseTimeError extends Error {
  public readonly code: UniverseTimeErrorCode;
  public readonly path: string;

  public constructor(code: UniverseTimeErrorCode, path: string, message: string) {
    super(message);
    this.name = "UniverseTimeError";
    this.code = code;
    this.path = path;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const createSimulationTick = (value: unknown, path = "/tick"): SimulationTick => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new UniverseTimeError("INVALID_TICK", path, "Simulation tick must be a nonnegative safe integer.");
  }
  return (Object.is(value, -0) ? 0 : value) as SimulationTick;
};

export const convertTicksToSeconds = (tick: number): EpochSeconds => {
  const parsedTick = createSimulationTick(tick);
  const seconds = parsedTick / UNIVERSE_TICKS_PER_SECOND;
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new UniverseTimeError("TIME_OVERFLOW", "/tick", "Simulation tick cannot be represented as Universe seconds.");
  }
  return seconds as EpochSeconds;
};

const assertSeconds = (seconds: unknown): number => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    throw new UniverseTimeError("INVALID_SECONDS", "/seconds", "Seconds must be finite and nonnegative.");
  }
  return Object.is(seconds, -0) ? 0 : seconds;
};

export const convertSecondsToTicks = (seconds: number, roundingMode: TimeRoundingMode): SimulationTick => {
  const parsedSeconds = assertSeconds(seconds);
  const unrounded = parsedSeconds * UNIVERSE_TICKS_PER_SECOND;
  if (!Number.isFinite(unrounded) || unrounded > Number.MAX_SAFE_INTEGER) {
    throw new UniverseTimeError("TIME_OVERFLOW", "/seconds", "Seconds exceed the safe Universe tick range.");
  }

  let rounded: number;
  switch (roundingMode) {
    case "exact":
      if (!Number.isSafeInteger(unrounded)) {
        throw new UniverseTimeError("INEXACT_SECONDS", "/seconds", "Seconds do not map to an exact Universe tick.");
      }
      rounded = unrounded;
      break;
    case "floor":
      rounded = Math.floor(unrounded);
      break;
    case "ceil":
      rounded = Math.ceil(unrounded);
      break;
    case "nearest":
      rounded = Math.floor(unrounded + 0.5);
      break;
    default:
      throw new UniverseTimeError("INVALID_ROUNDING_MODE", "/roundingMode", "Universe time rounding mode is invalid.");
  }

  return createSimulationTick(rounded);
};

export const createUniverseClock = (initialTick: number = 0): UniverseTime => {
  const tick = createSimulationTick(initialTick);
  return Object.freeze({ tick, epochSeconds: convertTicksToSeconds(tick) });
};

export const createMissionTime = (initialTick: number = 0): MissionTime =>
  Object.freeze({ tick: createSimulationTick(initialTick) });

export const validateUniverseTime = (value: UniverseTime, path = ""): UniverseTime => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new UniverseTimeError("INCONSISTENT_UNIVERSE_TIME", path, "Universe time must be an object.");
  }
  const tick = createSimulationTick(value.tick, `${path}/tick`);
  const expectedSeconds = convertTicksToSeconds(tick);
  if (
    typeof value.epochSeconds !== "number" ||
    !Number.isFinite(value.epochSeconds) ||
    value.epochSeconds < 0 ||
    !Object.is(value.epochSeconds, expectedSeconds)
  ) {
    throw new UniverseTimeError(
      "INCONSISTENT_UNIVERSE_TIME",
      `${path}/epochSeconds`,
      "Universe epoch seconds must be derived exactly from the simulation tick."
    );
  }
  return Object.freeze({ tick, epochSeconds: expectedSeconds });
};

export const advanceUniverseTicks = (clock: UniverseTime, deltaTicks: number): UniverseTime => {
  const source = validateUniverseTime(clock);
  const delta = createSimulationTick(deltaTicks, "/deltaTicks");
  if (delta > Number.MAX_SAFE_INTEGER - source.tick) {
    throw new UniverseTimeError("TIME_OVERFLOW", "/deltaTicks", "Universe tick advance exceeds MAX_SAFE_INTEGER.");
  }
  return createUniverseClock(source.tick + delta);
};

export const advanceUniverseSeconds = (
  clock: UniverseTime,
  deltaSeconds: number,
  roundingMode: TimeRoundingMode
): UniverseTime => advanceUniverseTicks(clock, convertSecondsToTicks(deltaSeconds, roundingMode));

export const advanceMissionTicks = (missionTime: MissionTime, deltaTicks: number): MissionTime => {
  const sourceTick = createSimulationTick(missionTime.tick, "/tick");
  const delta = createSimulationTick(deltaTicks, "/deltaTicks");
  if (delta > Number.MAX_SAFE_INTEGER - sourceTick) {
    throw new UniverseTimeError("TIME_OVERFLOW", "/deltaTicks", "Mission tick advance exceeds MAX_SAFE_INTEGER.");
  }
  return createMissionTime(sourceTick + delta);
};
