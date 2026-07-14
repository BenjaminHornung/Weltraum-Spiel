import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");

const typescriptFiles = (directory: string): readonly string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? typescriptFiles(path) : entry.name.endsWith(".ts") ? [path] : [];
});

describe("render backend architecture boundary", () => {
  it("keeps every public presentation module free of Three.js imports and types", () => {
    const files = typescriptFiles(join(sourceRoot, "presentation"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, relative(sourceRoot, file)).not.toMatch(/from\s+["']three["']/);
      expect(source, relative(sourceRoot, file)).not.toMatch(/\bTHREE\./);
      expect(source, relative(sourceRoot, file)).not.toMatch(/\b(?:BufferGeometry|WebGLRenderer|Object3D|MeshBasicMaterial|MeshLambertMaterial)\b/);
    }
  });

  it("keeps the Three adapter dependent only on presentation contracts and Three.js", () => {
    const forbiddenDomains = [
      "world", "flight", "navigation", "runtime", "spatial", "physics-space", "workers", "streaming", "persistence"
    ];
    const files = typescriptFiles(join(sourceRoot, "render", "three", "backend"));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const domain of forbiddenDomains) {
        expect(source, `${relative(sourceRoot, file)} imports ${domain}`).not.toMatch(new RegExp(`from\\s+["'][^"']*\\/${domain}(?:\\/|["'])`));
      }
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
      for (const dependency of imports) {
        expect(
          dependency === "three" || dependency.startsWith("../../../presentation") || dependency.startsWith("./"),
          `${relative(sourceRoot, file)} has unexpected dependency ${dependency}`
        ).toBe(true);
      }
    }
  });

  it("does not wire the backend into the product entry point", () => {
    const main = readFileSync(join(sourceRoot, "main.ts"), "utf8");
    expect(main).not.toContain("render/three/backend");
    expect(main).not.toContain("ThreeRenderBackend");
    expect(main).not.toContain("createDeterministicRenderHarness");
  });
});
