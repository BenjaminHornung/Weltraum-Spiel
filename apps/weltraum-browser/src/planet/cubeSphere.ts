import { cross, dot, vec3, type Vec3 } from "../core/vector";
import {
  PLANET_FACES,
  PlanetTopologyError,
  type PlanetFace,
  type PlanetFaceBasis,
  type PlanetFaceUv
} from "./types";

const frozenVec3 = (x: number, y: number, z: number): Vec3 => Object.freeze(vec3(x, y, z));

export const PLANET_FACE_BASES: Readonly<Record<PlanetFace, PlanetFaceBasis>> = Object.freeze({
  "+X": Object.freeze({ face: "+X", ordinal: 0, normal: frozenVec3(1, 0, 0), uAxis: frozenVec3(0, 0, -1), vAxis: frozenVec3(0, 1, 0) }),
  "-X": Object.freeze({ face: "-X", ordinal: 1, normal: frozenVec3(-1, 0, 0), uAxis: frozenVec3(0, 0, 1), vAxis: frozenVec3(0, 1, 0) }),
  "+Y": Object.freeze({ face: "+Y", ordinal: 2, normal: frozenVec3(0, 1, 0), uAxis: frozenVec3(1, 0, 0), vAxis: frozenVec3(0, 0, -1) }),
  "-Y": Object.freeze({ face: "-Y", ordinal: 3, normal: frozenVec3(0, -1, 0), uAxis: frozenVec3(1, 0, 0), vAxis: frozenVec3(0, 0, 1) }),
  "+Z": Object.freeze({ face: "+Z", ordinal: 4, normal: frozenVec3(0, 0, 1), uAxis: frozenVec3(1, 0, 0), vAxis: frozenVec3(0, 1, 0) }),
  "-Z": Object.freeze({ face: "-Z", ordinal: 5, normal: frozenVec3(0, 0, -1), uAxis: frozenVec3(-1, 0, 0), vAxis: frozenVec3(0, 1, 0) })
});

const isPlanetFace = (value: unknown): value is PlanetFace =>
  typeof value === "string" && PLANET_FACES.includes(value as PlanetFace);

const assertFiniteDirection = (direction: Vec3): void => {
  if (
    direction === null ||
    typeof direction !== "object" ||
    !Number.isFinite(direction.x) ||
    !Number.isFinite(direction.y) ||
    !Number.isFinite(direction.z)
  ) {
    throw new PlanetTopologyError("INVALID_DIRECTION", "Direction components must be finite numbers.");
  }

  if (direction.x === 0 && direction.y === 0 && direction.z === 0) {
    throw new PlanetTopologyError("INVALID_DIRECTION", "Direction must have a non-zero length.");
  }
};

const normalizeDirection = (direction: Vec3): Vec3 => {
  assertFiniteDirection(direction);
  const length = Math.hypot(direction.x, direction.y, direction.z);
  const result = vec3(direction.x / length, direction.y / length, direction.z / length);
  if (!Number.isFinite(result.x) || !Number.isFinite(result.y) || !Number.isFinite(result.z)) {
    throw new PlanetTopologyError("INVALID_DIRECTION", "Direction normalization produced a non-finite result.");
  }
  return Object.freeze(result);
};

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

export const getPlanetFaceBasis = (face: PlanetFace): PlanetFaceBasis => {
  if (!isPlanetFace(face)) {
    throw new PlanetTopologyError("INVALID_FACE", `Unknown planet face: ${String(face)}.`);
  }
  return PLANET_FACE_BASES[face];
};

export const planetFaceUvToDirection = (faceUv: PlanetFaceUv): Vec3 => {
  if (faceUv === null || typeof faceUv !== "object") {
    throw new PlanetTopologyError("INVALID_FACE_UV", "Face/UV input is required.");
  }
  const basis = getPlanetFaceBasis(faceUv.face);
  if (
    !Number.isFinite(faceUv.u) ||
    !Number.isFinite(faceUv.v) ||
    faceUv.u < 0 ||
    faceUv.u > 1 ||
    faceUv.v < 0 ||
    faceUv.v > 1
  ) {
    throw new PlanetTopologyError("INVALID_FACE_UV", "Face coordinates u and v must be finite values in [0, 1].");
  }

  const s = 2 * faceUv.u - 1;
  const t = 2 * faceUv.v - 1;
  return normalizeDirection(vec3(
    basis.normal.x + s * basis.uAxis.x + t * basis.vAxis.x,
    basis.normal.y + s * basis.uAxis.y + t * basis.vAxis.y,
    basis.normal.z + s * basis.uAxis.z + t * basis.vAxis.z
  ));
};

export const directionToPlanetFaceUv = (direction: Vec3): PlanetFaceUv => {
  assertFiniteDirection(direction);
  const absX = Math.abs(direction.x);
  const absY = Math.abs(direction.y);
  const absZ = Math.abs(direction.z);

  let face: PlanetFace;
  if (absX >= absY && absX >= absZ) {
    face = direction.x >= 0 ? "+X" : "-X";
  } else if (absY >= absZ) {
    face = direction.y >= 0 ? "+Y" : "-Y";
  } else {
    face = direction.z >= 0 ? "+Z" : "-Z";
  }

  const basis = PLANET_FACE_BASES[face];
  const denominator = dot(direction, basis.normal);
  const s = dot(direction, basis.uAxis) / denominator;
  const t = dot(direction, basis.vAxis) / denominator;
  const u = clampUnit((s + 1) / 2);
  const v = clampUnit((t + 1) / 2);
  if (!Number.isFinite(u) || !Number.isFinite(v)) {
    throw new PlanetTopologyError("INVALID_DIRECTION", "Direction projection produced non-finite face coordinates.");
  }

  return Object.freeze({ face, u, v });
};

export const planetFaceBasisHasOutwardWinding = (face: PlanetFace): boolean => {
  const basis = getPlanetFaceBasis(face);
  return dot(cross(basis.uAxis, basis.vAxis), basis.normal) > 0;
};
