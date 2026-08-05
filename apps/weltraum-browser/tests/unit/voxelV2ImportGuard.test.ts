import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = fileURLToPath(new URL("../../src/voxel-v2", import.meta.url));
const forbiddenTestBridgeAssignment = /TestBridge\s*(?:=|\[)/i;

const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return sourceFiles(path);
  return entry.isFile() && path.endsWith(".ts") ? [path] : [];
});

describe("Voxel V2 import boundary", () => {
  it("keeps legacy voxel/surface/worker dependencies out of V2 and Three inside render-three", () => {
    expect(forbiddenTestBridgeAssignment.test("window.TestBridge = value")).toBe(true);
    expect(forbiddenTestBridgeAssignment.test("(window as any).TestBridge = value")).toBe(true);
    const forbidden = [
      /surface-play/i,
      /surface-lab/i,
      /voxel\/adaptive/i,
      /voxel\/structural/i,
      /src\/workers/i,
      /WorkerPool/,
      /SurfaceNets/i,
      /MarchingCubes/i,
      /DualContouring/i,
      forbiddenTestBridgeAssignment
    ];
    const violations: string[] = [];
    for (const file of sourceFiles(sourceRoot)) {
      const source = readFileSync(file, "utf8");
      for (const pattern of forbidden) if (pattern.test(source)) violations.push(`${file}: ${pattern}`);
      if (!file.includes(join("voxel-v2", "render-three")) && /from\s+["']three["']/i.test(source)) {
        violations.push(`${file}: Three.js import outside render-three`);
      }
    }
    expect(violations).toEqual([]);
  });
});
