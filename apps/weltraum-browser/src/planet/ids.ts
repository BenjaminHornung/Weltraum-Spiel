import { assertPlanetBodyId, createPlanetTileKey } from "./tileAddress";
import { PLANET_FACES, PlanetTopologyError, type PlanetFace, type PlanetTileId, type PlanetTileKey } from "./types";

export const escapePlanetBodyId = (bodyId: string): string => {
  assertPlanetBodyId(bodyId);
  try {
    return encodeURIComponent(bodyId);
  } catch {
    throw new PlanetTopologyError("INVALID_BODY_ID", "Planet bodyId must contain valid Unicode text.");
  }
};

export const unescapePlanetBodyId = (escapedBodyId: string): string => {
  try {
    const bodyId = decodeURIComponent(escapedBodyId);
    if (bodyId.length === 0 || escapePlanetBodyId(bodyId) !== escapedBodyId) {
      throw new Error("Non-canonical body ID escaping.");
    }
    return bodyId;
  } catch {
    throw new PlanetTopologyError("INVALID_TILE_ID", "Planet tile ID contains an invalid escaped body ID.");
  }
};

export const planetTileId = (key: PlanetTileKey): PlanetTileId => {
  const canonicalKey = createPlanetTileKey(key);
  return `planet-tile:v1:${escapePlanetBodyId(canonicalKey.bodyId)}:${canonicalKey.face}:${canonicalKey.level}:${canonicalKey.x}:${canonicalKey.y}`;
};

export const parsePlanetTileId = (id: string): PlanetTileKey => {
  if (typeof id !== "string") {
    throw new PlanetTopologyError("INVALID_TILE_ID", "Planet tile ID must be a string.");
  }
  const parts = id.split(":");
  if (parts.length !== 7 || parts[0] !== "planet-tile" || parts[1] !== "v1") {
    throw new PlanetTopologyError("INVALID_TILE_ID", "Planet tile ID must use the planet-tile:v1 format.");
  }

  const face = parts[3] as PlanetFace;
  if (!PLANET_FACES.includes(face)) {
    throw new PlanetTopologyError("INVALID_TILE_ID", "Planet tile ID contains an invalid face.");
  }

  try {
    const key = createPlanetTileKey({
      bodyId: unescapePlanetBodyId(parts[2]),
      face,
      level: Number(parts[4]),
      x: Number(parts[5]),
      y: Number(parts[6])
    });
    if (planetTileId(key) !== id) {
      throw new Error("Non-canonical planet tile ID.");
    }
    return key;
  } catch (error) {
    if (error instanceof PlanetTopologyError && error.code === "INVALID_TILE_ID") {
      throw error;
    }
    throw new PlanetTopologyError("INVALID_TILE_ID", "Planet tile ID contains invalid or non-canonical coordinates.");
  }
};
