import { describe, expect, it } from "vitest";
import { isHvpQuery } from "../../src/hvp/hvpQuery";
import { isSurfaceLabQuery } from "../../src/surface-lab/surfaceLabQuery";

describe("HVP T01 hestiaPrototype query gate", () => {
  it("accepts exactly one hestiaPrototype=1 value", () => {
    expect(isHvpQuery(new URLSearchParams("hestiaPrototype=1"))).toBe(true);
    expect(isHvpQuery(new URLSearchParams(""))).toBe(false);
    expect(isHvpQuery(new URLSearchParams("hestiaPrototype=0"))).toBe(false);
    expect(isHvpQuery(new URLSearchParams("hestiaPrototype=1&hestiaPrototype=1"))).toBe(false);
    expect(isHvpQuery("?hestiaPrototype=1")).toBe(true);
  });
});

describe("HVP T02 Surface Lab precedence is unchanged", () => {
  it("keeps the Surface Lab check byte-identical and resolves combined queries to Surface Lab", () => {
    const combined = new URLSearchParams("surfaceLab=1&hestiaPrototype=1");
    expect(isSurfaceLabQuery(combined)).toBe(true);
    expect(isHvpQuery(combined)).toBe(true);
  });
});
