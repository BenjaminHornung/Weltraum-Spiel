import { createPlanetTileKey } from "./tileAddress";
import { PLANET_FACES, PlanetTopologyError, type PlanetFace, type PlanetTileKey } from "./types";

const FACE_ORDINAL: Readonly<Record<PlanetFace, number>> = Object.freeze(
  Object.fromEntries(PLANET_FACES.map((face, ordinal) => [face, ordinal])) as Record<PlanetFace, number>
);

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const compareNumber = (left: number, right: number): number => (left < right ? -1 : left > right ? 1 : 0);

export const planetFaceOrdinal = (face: PlanetFace): number => {
  if (!PLANET_FACES.includes(face)) {
    throw new PlanetTopologyError("INVALID_FACE", `Unknown planet face: ${String(face)}.`);
  }
  return FACE_ORDINAL[face];
};

export const comparePlanetTileKeys = (left: PlanetTileKey, right: PlanetTileKey): number => {
  const a = createPlanetTileKey(left);
  const b = createPlanetTileKey(right);
  return (
    compareText(a.bodyId, b.bodyId) ||
    compareNumber(FACE_ORDINAL[a.face], FACE_ORDINAL[b.face]) ||
    compareNumber(a.level, b.level) ||
    compareNumber(a.x, b.x) ||
    compareNumber(a.y, b.y)
  );
};

export const canonicalPlanetTileKeys = (keys: readonly PlanetTileKey[]): readonly PlanetTileKey[] =>
  Object.freeze(keys.map(createPlanetTileKey).sort(comparePlanetTileKeys));
