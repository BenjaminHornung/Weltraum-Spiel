import { describe, expect, it } from "vitest";
import {
  MAX_PLANET_TILE_LEVEL,
  PLANET_FACES,
  PLANET_TILE_EDGES,
  planetTileId,
  planetTileNeighbor,
  planetTileNeighbors,
  tilesPerPlanetFace,
  type PlanetFace,
  type PlanetTileEdge,
  type PlanetTileKey
} from "../../src/planet";

type AlongEdgeOrientation = "preserved" | "reversed";

interface DirectedSeamExpectation {
  readonly destinationFace: PlanetFace;
  readonly destinationEdge: PlanetTileEdge;
  readonly orientation: AlongEdgeOrientation;
}

const DIRECTED_SEAMS: Readonly<Record<PlanetFace, Readonly<Record<PlanetTileEdge, DirectedSeamExpectation>>>> = {
  "+X": {
    "u-": { destinationFace: "+Z", destinationEdge: "u+", orientation: "preserved" },
    "u+": { destinationFace: "-Z", destinationEdge: "u-", orientation: "preserved" },
    "v-": { destinationFace: "-Y", destinationEdge: "u+", orientation: "reversed" },
    "v+": { destinationFace: "+Y", destinationEdge: "u+", orientation: "preserved" }
  },
  "-X": {
    "u-": { destinationFace: "-Z", destinationEdge: "u+", orientation: "preserved" },
    "u+": { destinationFace: "+Z", destinationEdge: "u-", orientation: "preserved" },
    "v-": { destinationFace: "-Y", destinationEdge: "u-", orientation: "preserved" },
    "v+": { destinationFace: "+Y", destinationEdge: "u-", orientation: "reversed" }
  },
  "+Y": {
    "u-": { destinationFace: "-X", destinationEdge: "v+", orientation: "reversed" },
    "u+": { destinationFace: "+X", destinationEdge: "v+", orientation: "preserved" },
    "v-": { destinationFace: "+Z", destinationEdge: "v+", orientation: "preserved" },
    "v+": { destinationFace: "-Z", destinationEdge: "v+", orientation: "reversed" }
  },
  "-Y": {
    "u-": { destinationFace: "-X", destinationEdge: "v-", orientation: "preserved" },
    "u+": { destinationFace: "+X", destinationEdge: "v-", orientation: "reversed" },
    "v-": { destinationFace: "-Z", destinationEdge: "v-", orientation: "reversed" },
    "v+": { destinationFace: "+Z", destinationEdge: "v-", orientation: "preserved" }
  },
  "+Z": {
    "u-": { destinationFace: "-X", destinationEdge: "u+", orientation: "preserved" },
    "u+": { destinationFace: "+X", destinationEdge: "u-", orientation: "preserved" },
    "v-": { destinationFace: "-Y", destinationEdge: "v+", orientation: "preserved" },
    "v+": { destinationFace: "+Y", destinationEdge: "v-", orientation: "preserved" }
  },
  "-Z": {
    "u-": { destinationFace: "+X", destinationEdge: "u+", orientation: "preserved" },
    "u+": { destinationFace: "-X", destinationEdge: "u-", orientation: "preserved" },
    "v-": { destinationFace: "-Y", destinationEdge: "v-", orientation: "reversed" },
    "v+": { destinationFace: "+Y", destinationEdge: "v+", orientation: "reversed" }
  }
};

const boundaryKey = (face: PlanetFace, edge: PlanetTileEdge, level: number, along: number): PlanetTileKey => {
  const count = 2 ** level;
  switch (edge) {
    case "u-": return { bodyId: "hestia", face, level, x: 0, y: along };
    case "u+": return { bodyId: "hestia", face, level, x: count - 1, y: along };
    case "v-": return { bodyId: "hestia", face, level, x: along, y: 0 };
    case "v+": return { bodyId: "hestia", face, level, x: along, y: count - 1 };
  }
};

describe("same-level planet tile neighbors", () => {
  it("uses direct index arithmetic for interior neighbors", () => {
    const key = { bodyId: "hestia", face: "+X", level: 3, x: 3, y: 4 } as const;
    expect(planetTileNeighbors(key)).toEqual({
      "u-": { ...key, x: 2 },
      "u+": { ...key, x: 4 },
      "v-": { ...key, y: 3 },
      "v+": { ...key, y: 5 }
    });
  });

  it("maps all 24 directed face edges through virtual-cell center projection", () => {
    for (const face of PLANET_FACES) {
      for (const edge of PLANET_TILE_EDGES) {
        const neighbor = planetTileNeighbor(boundaryKey(face, edge, 3, 3), edge);
        expect(neighbor.face, `${face} ${edge}`).toBe(DIRECTED_SEAMS[face][edge].destinationFace);
        expect(neighbor.level).toBe(3);
        expect(neighbor.bodyId).toBe("hestia");
        expect(neighbor.x).toBeGreaterThanOrEqual(0);
        expect(neighbor.y).toBeGreaterThanOrEqual(0);
        expect(neighbor.x).toBeLessThan(8);
        expect(neighbor.y).toBeLessThan(8);
      }
    }
  });

  it("pins exact coordinates and orientation for all 24 directed face seams", () => {
    const level = 4;
    const count = tilesPerPlanetFace(level);
    const nonCornerAlongCoordinates = [1, 5, 10, 14] as const;

    for (const sourceFace of PLANET_FACES) {
      for (const sourceEdge of PLANET_TILE_EDGES) {
        const seam = DIRECTED_SEAMS[sourceFace][sourceEdge];
        for (const along of nonCornerAlongCoordinates) {
          const expectedAlong = seam.orientation === "preserved" ? along : count - 1 - along;
          const source = boundaryKey(sourceFace, sourceEdge, level, along);
          const expected = boundaryKey(seam.destinationFace, seam.destinationEdge, level, expectedAlong);

          expect(
            planetTileNeighbor(source, sourceEdge),
            `${sourceFace} ${sourceEdge} -> ${seam.destinationFace} ${seam.destinationEdge} ${seam.orientation} at ${along}`
          ).toEqual(expected);
        }
      }
    }
  });

  it("is reciprocal for every boundary cell, including corners, at fixture levels", () => {
    for (let level = 0; level <= 5; level += 1) {
      const count = 2 ** level;
      for (const face of PLANET_FACES) {
        for (const edge of PLANET_TILE_EDGES) {
          for (let along = 0; along < count; along += 1) {
            const source = boundaryKey(face, edge, level, along);
            const neighbor = planetTileNeighbor(source, edge);
            const reciprocalIds = Object.values(planetTileNeighbors(neighbor)).map(planetTileId);
            expect(reciprocalIds, `${face} ${edge} level=${level} along=${along}`).toContain(planetTileId(source));
          }
        }
      }
    }
  });

  it("returns the same neighbor identities independent of query order", () => {
    const key = { bodyId: "hestia", face: "-Z", level: 4, x: 0, y: 15 } as const;
    const forward = PLANET_TILE_EDGES.map((edge) => planetTileId(planetTileNeighbor(key, edge)));
    const reversed = [...PLANET_TILE_EDGES].reverse().map((edge) => [edge, planetTileId(planetTileNeighbor(key, edge))] as const);
    expect(Object.fromEntries(reversed)).toEqual(Object.fromEntries(PLANET_TILE_EDGES.map((edge, index) => [edge, forward[index]])));
  });

  it("pins rotated cross-face coordinates", () => {
    const fixtures = [
      [{ bodyId: "hestia", face: "+X", level: 3, x: 2, y: 7 }, "v+", { face: "+Y", x: 7, y: 2 }],
      [{ bodyId: "hestia", face: "+X", level: 3, x: 2, y: 0 }, "v-", { face: "-Y", x: 7, y: 5 }],
      [{ bodyId: "hestia", face: "+Y", level: 3, x: 5, y: 0 }, "v-", { face: "+Z", x: 5, y: 7 }],
      [{ bodyId: "hestia", face: "+Y", level: 3, x: 0, y: 1 }, "u-", { face: "-X", x: 6, y: 7 }]
    ] as const;

    for (const [source, edge, expected] of fixtures) {
      expect(planetTileNeighbor(source, edge)).toEqual({ ...source, ...expected });
    }
  });

  it("keeps maximum-level topology distinct, non-self, and reciprocal", () => {
    const count = tilesPerPlanetFace(MAX_PLANET_TILE_LEVEL);
    const sources: readonly PlanetTileKey[] = [
      { bodyId: "hestia", face: "+X", level: MAX_PLANET_TILE_LEVEL, x: count - 1, y: 0 },
      { bodyId: "hestia", face: "+Y", level: MAX_PLANET_TILE_LEVEL, x: 0, y: count - 1 },
      { bodyId: "hestia", face: "-Z", level: MAX_PLANET_TILE_LEVEL, x: count - 1, y: count - 1 }
    ];

    for (const source of sources) {
      const sourceId = planetTileId(source);
      const neighbors = Object.values(planetTileNeighbors(source));
      const neighborIds = neighbors.map(planetTileId);
      expect(neighborIds).not.toContain(sourceId);
      expect(new Set(neighborIds).size).toBe(4);
      for (const neighbor of neighbors) {
        expect(Object.values(planetTileNeighbors(neighbor)).map(planetTileId)).toContain(sourceId);
      }
    }
  });
});
