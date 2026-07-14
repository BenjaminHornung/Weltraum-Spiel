import { describe, expect, it } from "vitest";
import { UniverseTimeError, createUniverseClock } from "../../src/persistence";
import { createRuntimeUniverseClock } from "../../src/spatial";

describe("RuntimeUniverseClock", () => {
  it("advances only through explicit commands with the persistence 120 Hz semantics", () => {
    const clock = createRuntimeUniverseClock(createUniverseClock(12));
    const initial = clock.snapshot();

    expect(initial).toEqual({ tick: 12, epochSeconds: 0.1 });
    expect(clock.snapshot()).toEqual(initial);

    expect(clock.advance({ kind: "AdvanceTicks", deltaTicks: 108 })).toEqual({
      tick: 120,
      epochSeconds: 1
    });
    expect(clock.advance({ kind: "AdvanceSeconds", deltaSeconds: 0.5, roundingMode: "exact" })).toEqual({
      tick: 180,
      epochSeconds: 1.5
    });
  });

  it("uses deterministic explicit rounding and produces the same final snapshot for the same command sequence", () => {
    const run = () => {
      const clock = createRuntimeUniverseClock();
      clock.advance({ kind: "AdvanceSeconds", deltaSeconds: 1 / 121, roundingMode: "floor" });
      clock.advance({ kind: "AdvanceSeconds", deltaSeconds: 1 / 121, roundingMode: "ceil" });
      clock.advance({ kind: "AdvanceSeconds", deltaSeconds: 1 / 240, roundingMode: "nearest" });
      clock.advance({ kind: "AdvanceTicks", deltaTicks: 119 });
      return clock.snapshot();
    };

    expect(run()).toEqual({ tick: 121, epochSeconds: 121 / 120 });
    expect(run()).toEqual(run());
  });

  it("returns immutable snapshots that do not alias caller input", () => {
    const input = { ...createUniverseClock(60) };
    const clock = createRuntimeUniverseClock(input);
    const snapshot = clock.snapshot();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot).not.toBe(input);
    expect(Reflect.set(snapshot, "tick", 999)).toBe(false);
    input.tick = 0 as typeof input.tick;
    expect(clock.snapshot()).toEqual({ tick: 60, epochSeconds: 0.5 });
  });

  it("fails closed for inexact seconds, invalid commands, and safe-integer overflow", () => {
    const exactClock = createRuntimeUniverseClock();
    expect(() =>
      exactClock.advance({ kind: "AdvanceSeconds", deltaSeconds: 1 / 121, roundingMode: "exact" })
    ).toThrowError(UniverseTimeError);

    const maximum = createRuntimeUniverseClock(createUniverseClock(Number.MAX_SAFE_INTEGER));
    expect(() => maximum.advance({ kind: "AdvanceTicks", deltaTicks: 1 })).toThrowError(
      expect.objectContaining({ code: "TIME_OVERFLOW" })
    );

    expect(() => exactClock.advance(null as never)).toThrow(TypeError);
    expect(() => exactClock.advance({ kind: "Unknown" } as never)).toThrow(TypeError);
  });
});
