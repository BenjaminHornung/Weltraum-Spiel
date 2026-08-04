import { describe, expect, it } from "vitest";
import { isSurfacePlayQuery } from "../../src/surface-play/surfacePlayQuery";

describe("Surface Play query gate", () => {
  it("accepts exactly one surfacePlay=1 value", () => {
    expect(isSurfacePlayQuery("?surfacePlay=1")).toBe(true);
    expect(isSurfacePlayQuery(new URLSearchParams("surfacePlay=1"))).toBe(true);
  });

  it.each([
    "",
    "?surfacePlay=0",
    "?surfacePlay=true",
    "?surfacePlay=1&surfacePlay=1",
    "?surfacePlay=1&surfacePlay=0"
  ])("rejects %s", (search) => {
    expect(isSurfacePlayQuery(search)).toBe(false);
  });
});
