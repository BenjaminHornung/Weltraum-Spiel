import { describe, expect, it } from "vitest";
import {
  MAX_STABLE_ID_LENGTH,
  STABLE_ID_PREFIXES,
  StableIdError,
  UniverseTimeError,
  advanceUniverseSeconds,
  advanceUniverseTicks,
  convertSecondsToTicks,
  convertTicksToSeconds,
  createMissionTime,
  createStableFixtureId,
  createStableFixtureIdFactory,
  createUniverseClock,
  getStableIdClassification,
  isStableId,
  validateUniverseTime,
  type StableIdKind
} from "../../src/persistence";

describe("persistence Universe Time", () => {
  it("starts at the frozen game epoch and advances on the exact 120 Hz grid", () => {
    const first = createUniverseClock();
    const second = createUniverseClock();
    const missionTime = createMissionTime(7);
    const oneSecond = advanceUniverseTicks(first, 120);
    const fourTicks = advanceUniverseTicks(first, 4);

    expect(first).toEqual({ tick: 0, epochSeconds: 0 });
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(oneSecond).toEqual({ tick: 120, epochSeconds: 1 });
    expect(fourTicks.epochSeconds).toBe(4 / 120);
    expect(first.tick).toBe(0);
    expect(missionTime.tick).toBe(7);
  });

  it("uses explicit exact/floor/ceil/nearest rounding with half-ticks upward", () => {
    expect(convertSecondsToTicks(1, "exact")).toBe(120);
    expect(convertSecondsToTicks(1.25 / 120, "floor")).toBe(1);
    expect(convertSecondsToTicks(1.25 / 120, "ceil")).toBe(2);
    expect(convertSecondsToTicks(1.5 / 120, "nearest")).toBe(2);
    expect(convertTicksToSeconds(4)).toBe(4 / 120);
    expect(advanceUniverseSeconds(createUniverseClock(), 0.5, "exact")).toEqual({ tick: 60, epochSeconds: 0.5 });
    expect(() => convertSecondsToTicks(1.25 / 120, "exact")).toThrow(UniverseTimeError);
  });

  it("rejects negative, nonfinite, unsafe, inconsistent, and overflowing time", () => {
    for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => createUniverseClock(invalid)).toThrow(UniverseTimeError);
    }
    expect(() => advanceUniverseTicks(createUniverseClock(Number.MAX_SAFE_INTEGER), 1)).toThrowError(
      expect.objectContaining({ code: "TIME_OVERFLOW" })
    );
    expect(() => validateUniverseTime({ tick: 120 as never, epochSeconds: 2 as never })).toThrowError(
      expect.objectContaining({ code: "INCONSISTENT_UNIVERSE_TIME" })
    );
    expect(() => convertSecondsToTicks(Number.POSITIVE_INFINITY, "floor")).toThrow(UniverseTimeError);
  });
});

describe("persistence stable identities", () => {
  const kinds = Object.keys(STABLE_ID_PREFIXES) as StableIdKind[];

  it("validates every fixed prefix and definition-versus-instance classification", () => {
    for (const kind of kinds) {
      const id = createStableFixtureId(kind, "fixture", 0);
      expect(isStableId(kind, id)).toBe(true);
      expect(id.startsWith(STABLE_ID_PREFIXES[kind])).toBe(true);
      expect(getStableIdClassification(kind)).toBe(kind === "ship-variant" ? "Definition" : "Instance");
      expect(isStableId(kind, `${STABLE_ID_PREFIXES[kind]}Upper`)).toBe(false);
      expect(isStableId(kind, STABLE_ID_PREFIXES[kind])).toBe(false);
      expect(isStableId(kind, `${STABLE_ID_PREFIXES[kind]}with space`)).toBe(false);
      expect(isStableId(kind, `${STABLE_ID_PREFIXES[kind]}ä`)).toBe(false);
      expect(isStableId(kind, "wrong:fixture")).toBe(false);
    }
    expect(isStableId("save", `save:${"a".repeat(MAX_STABLE_ID_LENGTH)}`)).toBe(false);
  });

  it("derives repeatable fixture IDs only from explicit normalized inputs", () => {
    expect(createStableFixtureId("ship", "alpha", 3)).toBe(createStableFixtureId("ship", "alpha", 3));
    expect(() => createStableFixtureId("ship", "Alpha", 0)).toThrow(StableIdError);
    expect(() => createStableFixtureId("ship", "alpha", -1)).toThrow(StableIdError);

    const first = createStableFixtureIdFactory("drone", "survey", 5);
    const second = createStableFixtureIdFactory("drone", "survey", 5);
    expect([first.next(), first.next()]).toEqual([second.next(), second.next()]);
    expect(first.at(10)).toBe("drone:survey.15");
  });
});
