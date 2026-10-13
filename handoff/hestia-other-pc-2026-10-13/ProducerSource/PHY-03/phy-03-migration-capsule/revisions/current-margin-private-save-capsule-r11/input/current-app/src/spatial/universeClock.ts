import {
  advanceUniverseSeconds,
  advanceUniverseTicks,
  createUniverseClock,
  validateUniverseTime,
  type TimeRoundingMode,
  type UniverseTime
} from "../persistence/time";

export interface UniverseClockSnapshot extends UniverseTime {}

export interface AdvanceUniverseTicksCommand {
  readonly kind: "AdvanceTicks";
  readonly deltaTicks: number;
}

export interface AdvanceUniverseSecondsCommand {
  readonly kind: "AdvanceSeconds";
  readonly deltaSeconds: number;
  readonly roundingMode: TimeRoundingMode;
}

export type AdvanceUniverseTimeCommand = AdvanceUniverseTicksCommand | AdvanceUniverseSecondsCommand;

export interface RuntimeUniverseClock {
  readonly snapshot: () => UniverseClockSnapshot;
  readonly advance: (command: AdvanceUniverseTimeCommand) => UniverseClockSnapshot;
}

const snapshotOf = (time: UniverseTime): UniverseClockSnapshot => {
  const validated = validateUniverseTime(time);
  return Object.freeze({ tick: validated.tick, epochSeconds: validated.epochSeconds });
};

export const createRuntimeUniverseClock = (initialTime: UniverseTime | number = 0): RuntimeUniverseClock => {
  let current = typeof initialTime === "number" ? createUniverseClock(initialTime) : validateUniverseTime(initialTime);
  return Object.freeze({
    snapshot: (): UniverseClockSnapshot => snapshotOf(current),
    advance: (command: AdvanceUniverseTimeCommand): UniverseClockSnapshot => {
      if (command === null || typeof command !== "object" || Array.isArray(command)) {
        throw new TypeError("Universe clock command must be an object.");
      }
      switch (command.kind) {
        case "AdvanceTicks":
          current = advanceUniverseTicks(current, command.deltaTicks);
          break;
        case "AdvanceSeconds":
          current = advanceUniverseSeconds(current, command.deltaSeconds, command.roundingMode);
          break;
        default:
          throw new TypeError("Universe clock command kind is unsupported.");
      }
      return snapshotOf(current);
    }
  });
};
