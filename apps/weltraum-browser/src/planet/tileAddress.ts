import type { Vec3 } from "../core/vector";
import { directionToPlanetFaceUv, planetFaceUvToDirection } from "./cubeSphere";
import {
  PlanetTopologyError,
  type PlanetFace,
  type PlanetFaceUv,
  type PlanetTileFaceUvBounds,
  type PlanetTileKey
} from "./types";

// Level 51 is the highest supported center-direction-address round-trip under
// Number normalization/reprojection; level 52 can consume the final 0.5 tile-unit margin.
export const MAX_PLANET_TILE_LEVEL = 51;

export const assertPlanetBodyId = (bodyId: string): void => {
  if (typeof bodyId !== "string" || bodyId.length === 0) {
    throw new PlanetTopologyError("INVALID_BODY_ID", "Planet bodyId must be a non-empty string.");
  }

  for (let index = 0; index < bodyId.length; index += 1) {
    const codeUnit = bodyId.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = bodyId.charCodeAt(index + 1);
      if (index + 1 >= bodyId.length || nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) {
        throw new PlanetTopologyError("INVALID_BODY_ID", "Planet bodyId must contain valid Unicode text.");
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new PlanetTopologyError("INVALID_BODY_ID", "Planet bodyId must contain valid Unicode text.");
    }
  }
};

export const tilesPerPlanetFace = (level: number): number => {
  if (!Number.isSafeInteger(level) || level < 0 || level > MAX_PLANET_TILE_LEVEL) {
    throw new PlanetTopologyError(
      "INVALID_LEVEL",
      `Planet tile level must be a safe integer in [0, ${MAX_PLANET_TILE_LEVEL}].`
    );
  }
  return 2 ** level;
};

export const assertPlanetTileKey = (key: PlanetTileKey): void => {
  if (key === null || typeof key !== "object") {
    throw new PlanetTopologyError("INVALID_TILE_COORDINATE", "Planet tile key is required.");
  }
  assertPlanetBodyId(key.bodyId);
  const count = tilesPerPlanetFace(key.level);
  planetFaceUvToDirection({ face: key.face, u: 0.5, v: 0.5 });
  if (
    !Number.isSafeInteger(key.x) ||
    !Number.isSafeInteger(key.y) ||
    key.x < 0 ||
    key.y < 0 ||
    key.x >= count ||
    key.y >= count
  ) {
    throw new PlanetTopologyError(
      "INVALID_TILE_COORDINATE",
      `Planet tile x and y must be safe integers in [0, ${count}).`
    );
  }
};

export const createPlanetTileKey = (key: PlanetTileKey): PlanetTileKey => {
  assertPlanetTileKey(key);
  return Object.freeze({ bodyId: key.bodyId, face: key.face, level: key.level, x: key.x, y: key.y });
};

export const planetTileFaceUvBounds = (key: PlanetTileKey): PlanetTileFaceUvBounds => {
  assertPlanetTileKey(key);
  const count = tilesPerPlanetFace(key.level);
  return Object.freeze({
    minU: key.x / count,
    maxU: (key.x + 1) / count,
    minV: key.y / count,
    maxV: (key.y + 1) / count
  });
};

export const planetTileCenterFaceUv = (key: PlanetTileKey): PlanetFaceUv => {
  assertPlanetTileKey(key);
  const count = tilesPerPlanetFace(key.level);
  return Object.freeze({ face: key.face, u: (key.x + 0.5) / count, v: (key.y + 0.5) / count });
};

export const planetTileCenterDirection = (key: PlanetTileKey): Vec3 =>
  planetFaceUvToDirection(planetTileCenterFaceUv(key));

export const planetTileAtDirection = (bodyId: string, level: number, direction: Vec3): PlanetTileKey => {
  assertPlanetBodyId(bodyId);
  const count = tilesPerPlanetFace(level);
  const faceUv = directionToPlanetFaceUv(direction);
  return createPlanetTileKey({
    bodyId,
    face: faceUv.face,
    level,
    x: Math.min(count - 1, Math.floor(faceUv.u * count)),
    y: Math.min(count - 1, Math.floor(faceUv.v * count))
  });
};

export const planetTileAtFaceUv = (bodyId: string, level: number, faceUv: PlanetFaceUv): PlanetTileKey => {
  planetFaceUvToDirection(faceUv);
  const count = tilesPerPlanetFace(level);
  assertPlanetBodyId(bodyId);
  return createPlanetTileKey({
    bodyId,
    face: faceUv.face as PlanetFace,
    level,
    x: Math.min(count - 1, Math.floor(faceUv.u * count)),
    y: Math.min(count - 1, Math.floor(faceUv.v * count))
  });
};
