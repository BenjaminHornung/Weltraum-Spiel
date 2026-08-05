import { describe, expect, it } from "vitest";
import {
  isVoxelV2Query,
  parseVoxelV2View,
  voxelV2DiagnosticsEnabled
} from "../../src/voxel-v2/query";

describe("Voxel V2 query boundary", () => {
  it("enables V2 only for one exact value", () => {
    expect(isVoxelV2Query("voxelV2=1")).toBe(true);
    expect(isVoxelV2Query("voxelV2=1&surfaceLab=1")).toBe(true);
    for (const query of ["", "voxelV2=0", "voxelV2=", "voxelV2=1&voxelV2=1", "voxelV2=1&voxelV2=0"]) {
      expect(isVoxelV2Query(query)).toBe(false);
    }
  });

  it("keeps diagnostics explicit and parses only supported presentation views", () => {
    expect(voxelV2DiagnosticsEnabled("voxelV2Diagnostics=1")).toBe(true);
    expect(voxelV2DiagnosticsEnabled("voxelV2Diagnostics=1&voxelV2Diagnostics=1")).toBe(false);
    expect(parseVoxelV2View("")).toBe("player");
    expect(parseVoxelV2View("voxelV2View=coast")).toBe("coast");
    expect(parseVoxelV2View("voxelV2View=river")).toBe("river");
    expect(() => parseVoxelV2View("voxelV2View=unknown")).toThrow("Invalid V2 presentation view");
    expect(() => parseVoxelV2View("voxelV2View=coast&voxelV2View=river")).toThrow("Invalid V2 presentation view");
  });
});
