import { dot, vec3 } from "../core/vector";
import { directionToPlanetFaceUv, getPlanetFaceBasis } from "./cubeSphere";
import { createPlanetTileKey, tilesPerPlanetFace } from "./tileAddress";
import {
  PLANET_TILE_EDGES,
  PlanetTopologyError,
  type PlanetTileEdge,
  type PlanetTileKey,
  type PlanetTileNeighborMap
} from "./types";

const EDGE_OFFSET: Readonly<Record<PlanetTileEdge, readonly [number, number]>> = Object.freeze({
  "u-": Object.freeze([-1, 0] as const),
  "u+": Object.freeze([1, 0] as const),
  "v-": Object.freeze([0, -1] as const),
  "v+": Object.freeze([0, 1] as const)
});

const isPlanetTileEdge = (edge: unknown): edge is PlanetTileEdge =>
  typeof edge === "string" && PLANET_TILE_EDGES.includes(edge as PlanetTileEdge);

const virtualCellAxis = (coordinate: number, offset: number, count: number): number =>
  (coordinate + offset - count / 2 + 0.5) * (2 / count);

export const planetTileNeighbor = (key: PlanetTileKey, edge: PlanetTileEdge): PlanetTileKey => {
  const tile = createPlanetTileKey(key);
  if (!isPlanetTileEdge(edge)) {
    throw new PlanetTopologyError("INVALID_TILE_EDGE", `Unknown planet tile edge: ${String(edge)}.`);
  }

  const count = tilesPerPlanetFace(tile.level);
  const [offsetX, offsetY] = EDGE_OFFSET[edge];
  const adjacentX = tile.x + offsetX;
  const adjacentY = tile.y + offsetY;
  if (adjacentX >= 0 && adjacentX < count && adjacentY >= 0 && adjacentY < count) {
    return createPlanetTileKey({ ...tile, x: adjacentX, y: adjacentY });
  }

  // Center around zero before scaling so the one-cell step beyond a level-52
  // edge remains distinguishable from the face boundary.
  const s = virtualCellAxis(tile.x, offsetX, count);
  const t = virtualCellAxis(tile.y, offsetY, count);
  const basis = getPlanetFaceBasis(tile.face);
  const virtualDirection = vec3(
    basis.normal.x + s * basis.uAxis.x + t * basis.vAxis.x,
    basis.normal.y + s * basis.uAxis.y + t * basis.vAxis.y,
    basis.normal.z + s * basis.uAxis.z + t * basis.vAxis.z
  );
  const targetFace = directionToPlanetFaceUv(virtualDirection).face;
  const targetBasis = getPlanetFaceBasis(targetFace);
  const along = offsetX === 0 ? tile.x : tile.y;
  const sourceTangent = offsetX === 0 ? basis.uAxis : basis.vAxis;
  const sourceNormalOnTargetU = dot(basis.normal, targetBasis.uAxis);
  const sourceNormalOnTargetV = dot(basis.normal, targetBasis.vAxis);

  let targetX: number;
  let targetY: number;
  if (Math.abs(sourceNormalOnTargetU) === 1) {
    const tangentAlignment = dot(sourceTangent, targetBasis.vAxis);
    if (Math.abs(tangentAlignment) !== 1) {
      throw new PlanetTopologyError("INVALID_TILE_EDGE", "Planet face bases have an invalid edge alignment.");
    }
    targetX = sourceNormalOnTargetU > 0 ? count - 1 : 0;
    targetY = tangentAlignment > 0 ? along : count - 1 - along;
  } else if (Math.abs(sourceNormalOnTargetV) === 1) {
    const tangentAlignment = dot(sourceTangent, targetBasis.uAxis);
    if (Math.abs(tangentAlignment) !== 1) {
      throw new PlanetTopologyError("INVALID_TILE_EDGE", "Planet face bases have an invalid edge alignment.");
    }
    targetX = tangentAlignment > 0 ? along : count - 1 - along;
    targetY = sourceNormalOnTargetV > 0 ? count - 1 : 0;
  } else {
    throw new PlanetTopologyError("INVALID_TILE_EDGE", "Planet face bases have an invalid shared edge.");
  }

  return createPlanetTileKey({ bodyId: tile.bodyId, face: targetFace, level: tile.level, x: targetX, y: targetY });
};

export const planetTileNeighbors = (key: PlanetTileKey): PlanetTileNeighborMap =>
  Object.freeze({
    "u-": planetTileNeighbor(key, "u-"),
    "u+": planetTileNeighbor(key, "u+"),
    "v-": planetTileNeighbor(key, "v-"),
    "v+": planetTileNeighbor(key, "v+")
  });
