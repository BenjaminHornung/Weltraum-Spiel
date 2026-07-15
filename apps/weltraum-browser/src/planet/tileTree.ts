import { canonicalPlanetTileKeys } from "./canonical";
import { MAX_PLANET_TILE_LEVEL, createPlanetTileKey } from "./tileAddress";
import { PlanetTopologyError, type PlanetTileKey } from "./types";

export const planetTileParent = (key: PlanetTileKey): PlanetTileKey | null => {
  const tile = createPlanetTileKey(key);
  if (tile.level === 0) {
    return null;
  }
  return createPlanetTileKey({
    bodyId: tile.bodyId,
    face: tile.face,
    level: tile.level - 1,
    x: Math.floor(tile.x / 2),
    y: Math.floor(tile.y / 2)
  });
};

export const planetTileChildren = (key: PlanetTileKey): readonly PlanetTileKey[] => {
  const tile = createPlanetTileKey(key);
  if (tile.level === MAX_PLANET_TILE_LEVEL) {
    throw new PlanetTopologyError(
      "INVALID_LEVEL",
      `Planet tiles at maximum level ${MAX_PLANET_TILE_LEVEL} cannot have children.`
    );
  }
  const childLevel = tile.level + 1;
  const baseX = tile.x * 2;
  const baseY = tile.y * 2;
  return Object.freeze([
    createPlanetTileKey({ bodyId: tile.bodyId, face: tile.face, level: childLevel, x: baseX, y: baseY }),
    createPlanetTileKey({ bodyId: tile.bodyId, face: tile.face, level: childLevel, x: baseX + 1, y: baseY }),
    createPlanetTileKey({ bodyId: tile.bodyId, face: tile.face, level: childLevel, x: baseX, y: baseY + 1 }),
    createPlanetTileKey({ bodyId: tile.bodyId, face: tile.face, level: childLevel, x: baseX + 1, y: baseY + 1 })
  ]);
};

export const planetTileSiblings = (key: PlanetTileKey): readonly PlanetTileKey[] => {
  const tile = createPlanetTileKey(key);
  const parent = planetTileParent(tile);
  if (parent === null) {
    return Object.freeze([]);
  }
  return canonicalPlanetTileKeys(
    planetTileChildren(parent).filter((candidate) => candidate.x !== tile.x || candidate.y !== tile.y)
  );
};
