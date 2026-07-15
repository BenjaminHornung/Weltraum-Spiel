import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_PLANET_TILE_LEVEL,
  PLANET_FACES,
  PlanetTopologyError,
  canonicalPlanetTileKeys,
  comparePlanetTileKeys,
  createPlanetTileKey,
  parsePlanetTileId,
  planetTileAtDirection,
  planetTileCenterDirection,
  planetTileChildren,
  planetTileId,
  planetTileParent,
  planetTileSiblings,
  tilesPerPlanetFace,
  type PlanetTileKey
} from "../../src/planet";

const SAFE_PLANET_TILE_LEVEL = 51;

describe("canonical planet tile identity and addressing", () => {
  it("validates body, level, and level-relative coordinates", () => {
    expect(createPlanetTileKey({ bodyId: "planet.hestia", face: "+X", level: 0, x: 0, y: 0 })).toEqual({
      bodyId: "planet.hestia", face: "+X", level: 0, x: 0, y: 0
    });
    const invalid = [
      { bodyId: "", face: "+X", level: 0, x: 0, y: 0 },
      { bodyId: "hestia", face: "+X", level: -1, x: 0, y: 0 },
      { bodyId: "hestia", face: "+X", level: 1.5, x: 0, y: 0 },
      { bodyId: "hestia", face: "+X", level: 1, x: 2, y: 0 },
      { bodyId: "hestia", face: "+X", level: 1, x: 0, y: -1 },
      { bodyId: "hestia", face: "+X", level: 1, x: 0.25, y: 0 }
    ] as PlanetTileKey[];
    for (const key of invalid) expect(() => createPlanetTileKey(key)).toThrowError(PlanetTopologyError);
  });

  it("accepts the exact numeric address domain and rejects levels or coordinates outside it", () => {
    expect(MAX_PLANET_TILE_LEVEL).toBe(SAFE_PLANET_TILE_LEVEL);
    const count = tilesPerPlanetFace(MAX_PLANET_TILE_LEVEL);
    const maximum = createPlanetTileKey({
      bodyId: "hestia",
      face: "+X",
      level: MAX_PLANET_TILE_LEVEL,
      x: count - 1,
      y: count - 1
    });

    expect(planetTileId(maximum)).toBe(
      `planet-tile:v1:hestia:+X:${MAX_PLANET_TILE_LEVEL}:${count - 1}:${count - 1}`
    );
    expect(Object.values(planetTileCenterDirection(maximum)).every(Number.isFinite)).toBe(true);
    expect(() => tilesPerPlanetFace(MAX_PLANET_TILE_LEVEL + 1)).toThrowError(PlanetTopologyError);
    expect(() => tilesPerPlanetFace(Number.MAX_SAFE_INTEGER + 1)).toThrowError(PlanetTopologyError);
    expect(() => createPlanetTileKey({ ...maximum, x: Number.MAX_SAFE_INTEGER + 1 })).toThrowError(PlanetTopologyError);
    expect(() => createPlanetTileKey({ ...maximum, y: Number.MAX_SAFE_INTEGER + 1 })).toThrowError(PlanetTopologyError);
    expect(() => createPlanetTileKey({ bodyId: "hestia", face: "+X", level: MAX_PLANET_TILE_LEVEL + 1, x: 0, y: 0 })).toThrowError(PlanetTopologyError);
  });

  it("creates a stable escaped and reversible v1 ID", () => {
    const key = createPlanetTileKey({ bodyId: "planet:hestia/α", face: "-Z", level: 3, x: 4, y: 7 });
    const id = planetTileId(key);
    expect(id).toBe("planet-tile:v1:planet%3Ahestia%2F%CE%B1:-Z:3:4:7");
    expect(parsePlanetTileId(id)).toEqual(key);
    expect(() => parsePlanetTileId("planet-tile:v1:hestia:+X:01:0:0")).toThrowError(PlanetTopologyError);
  });

  it("keeps valid Unicode reversible and rejects malformed surrogate body IDs during key validation", () => {
    const unicode = createPlanetTileKey({ bodyId: "planet:🚀/%", face: "+Z", level: 1, x: 1, y: 0 });
    expect(parsePlanetTileId(planetTileId(unicode))).toEqual(unicode);

    for (const bodyId of ["planet.\ud800", "planet.\udc00", "planet.\ud800x"]) {
      expect(() => createPlanetTileKey({ bodyId, face: "+X", level: 0, x: 0, y: 0 })).toThrowError(PlanetTopologyError);
      expect(() => planetTileId({ bodyId, face: "+X", level: 0, x: 0, y: 0 })).toThrowError(PlanetTopologyError);
    }
  });

  it("keeps readiness, cache, renderer, and floating-origin data outside identity", () => {
    const base = { bodyId: "planet.hestia", face: "+Y", level: 2, x: 1, y: 3 } as const;
    const decorated = {
      ...base,
      readiness: "render-ready",
      cacheRevision: 99,
      rendererObjectId: "mesh-7",
      floatingOrigin: { x: 1e9, y: -2e9, z: 3e9 }
    };
    expect(planetTileId(decorated)).toBe(planetTileId(base));
    expect(createPlanetTileKey(decorated)).toEqual(base);
  });

  it("orders by body, face ordinal, level, X, then Y independent of insertion order", () => {
    const keys: PlanetTileKey[] = [
      { bodyId: "b", face: "+X", level: 0, x: 0, y: 0 },
      { bodyId: "a", face: "-X", level: 0, x: 0, y: 0 },
      { bodyId: "a", face: "+X", level: 2, x: 1, y: 0 },
      { bodyId: "a", face: "+X", level: 1, x: 1, y: 1 },
      { bodyId: "a", face: "+X", level: 1, x: 0, y: 1 },
      { bodyId: "a", face: "+X", level: 1, x: 0, y: 0 }
    ];
    const expected = canonicalPlanetTileKeys(keys);
    expect(canonicalPlanetTileKeys([...keys].reverse())).toEqual(expected);
    expect(expected.map(planetTileId)).toEqual([
      "planet-tile:v1:a:+X:1:0:0",
      "planet-tile:v1:a:+X:1:0:1",
      "planet-tile:v1:a:+X:1:1:1",
      "planet-tile:v1:a:+X:2:1:0",
      "planet-tile:v1:a:-X:0:0:0",
      "planet-tile:v1:b:+X:0:0:0"
    ]);
    expect(comparePlanetTileKeys(expected[0], expected[1])).toBeLessThan(0);
  });

  it("round-trips every fixture tile through its center direction", () => {
    for (let level = 0; level <= 4; level += 1) {
      const count = 2 ** level;
      for (const face of PLANET_FACES) {
        for (let x = 0; x < count; x += 1) {
          for (let y = 0; y < count; y += 1) {
            const key = createPlanetTileKey({ bodyId: "hestia", face, level, x, y });
            expect(planetTileAtDirection(key.bodyId, level, planetTileCenterDirection(key))).toEqual(key);
          }
        }
      }
    }
  });

  it("round-trips bounded near-maximum centers on every planet face", () => {
    const level = MAX_PLANET_TILE_LEVEL;
    const count = tilesPerPlanetFace(level);
    const coordinates = [0, 1, 2, 3, count / 2 - 1, count / 2, count - 4, count - 3, count - 2, count - 1];

    for (const face of PLANET_FACES) {
      for (const x of coordinates) {
        for (const y of coordinates) {
          const key = createPlanetTileKey({ bodyId: "hestia", face, level, x, y });
          expect(planetTileAtDirection(key.bodyId, level, planetTileCenterDirection(key))).toEqual(key);
        }
      }
    }
  });
});

describe("planet tile quadtree", () => {
  it("returns parent, ordered children, and canonical siblings for every source quadrant", () => {
    const parent = createPlanetTileKey({ bodyId: "hestia", face: "+Z", level: 2, x: 1, y: 2 });
    const children = planetTileChildren(parent);
    expect(children.map(({ x, y }) => [x, y])).toEqual([[2, 4], [3, 4], [2, 5], [3, 5]]);
    for (const child of children) expect(planetTileParent(child)).toEqual(parent);
    const canonicalChildren = [children[0], children[2], children[1], children[3]];
    for (const child of children) {
      expect(planetTileSiblings(child)).toEqual(canonicalChildren.filter((candidate) => candidate !== child));
    }
    expect(planetTileParent({ bodyId: "hestia", face: "+X", level: 0, x: 0, y: 0 })).toBeNull();
    expect(planetTileSiblings({ bodyId: "hestia", face: "+X", level: 0, x: 0, y: 0 })).toEqual([]);
  });

  it("rejects children beyond the maximum address level before coordinate arithmetic", () => {
    const count = tilesPerPlanetFace(MAX_PLANET_TILE_LEVEL);
    const maximum = createPlanetTileKey({
      bodyId: "hestia",
      face: "-Z",
      level: MAX_PLANET_TILE_LEVEL,
      x: count - 1,
      y: count - 1
    });
    expect(() => planetTileChildren(maximum)).toThrowError(PlanetTopologyError);
  });
});

describe("planet core boundary", () => {
  it("contains no Three.js, presentation, render, or random imports", () => {
    const directory = fileURLToPath(new URL("../../src/planet/", import.meta.url));
    const files = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && entry.name !== "planetPresentationAdapter.ts")
      .map((entry) => join(directory, entry.name));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      const imports = [
        ...source.matchAll(/\bimport\s+(?:(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["'])/g),
        ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)
      ].map((match) => match[1]);
      for (const dependency of imports) {
        expect(dependency, file).not.toMatch(/(?:three|presentation|render)/i);
      }
      expect(source, file).not.toContain("Math.random");
    }
  });
});
