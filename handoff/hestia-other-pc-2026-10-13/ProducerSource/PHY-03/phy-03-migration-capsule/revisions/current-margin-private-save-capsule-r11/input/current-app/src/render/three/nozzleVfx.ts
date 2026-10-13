import type { Quaternion } from "../../core/types";
import { cross, dot, magnitude, normalize, vec3, type Vec3 } from "../../core/vector";

export interface NozzleSelectionCandidate {
  readonly id: string;
  readonly localPosition: Vec3;
  /** Body-local force direction. Exhaust points in the opposite direction. */
  readonly localForceDirection: Vec3;
}

export interface RcsNozzleSelectionInput {
  /** Current owner orientation, never the presentation-smoothed render pose. */
  readonly ownerOrientation: Quaternion;
  /** Applied RCS translation in the owner world/local-physics frame. */
  readonly rcsTranslationAccelerationWorld: Vec3;
  /** Applied rotation/SAS acceleration, already in the owner body-local frame. */
  readonly angularAccelerationBody: Vec3;
  readonly rcsTranslationActive: boolean;
  readonly rcsRotationActive: boolean;
  readonly sasCorrectionActive: boolean;
}

export interface RcsNozzleCompatibilitySnapshot {
  readonly id: string;
  readonly translationScore: number;
  readonly torqueScore: number;
  readonly translationCompatible: boolean;
  readonly torqueCompatible: boolean;
  readonly visible: boolean;
}

export interface RcsNozzleSelectionSnapshot {
  readonly bodyLocalRcsTranslationAcceleration: Vec3;
  readonly bodyLocalAngularAcceleration: Vec3;
  readonly compatibility: readonly RcsNozzleCompatibilitySnapshot[];
}

const selectionEpsilon = 1e-6;

const normalizeQuaternion = (orientation: Quaternion): Quaternion => {
  const length = Math.hypot(orientation.x, orientation.y, orientation.z, orientation.w);
  if (!Number.isFinite(length) || length <= selectionEpsilon) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }
  return {
    x: orientation.x / length,
    y: orientation.y / length,
    z: orientation.z / length,
    w: orientation.w / length
  };
};

const multiplyQuaternionRaw = (a: Quaternion, b: Quaternion): Quaternion => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
});

const rotateVector = (orientation: Quaternion, vector: Vec3): Vec3 => {
  const normalized = normalizeQuaternion(orientation);
  const vectorQuaternion: Quaternion = { x: vector.x, y: vector.y, z: vector.z, w: 0 };
  const inverse = { x: -normalized.x, y: -normalized.y, z: -normalized.z, w: normalized.w };
  const rotated = multiplyQuaternionRaw(multiplyQuaternionRaw(normalized, vectorQuaternion), inverse);
  return vec3(rotated.x, rotated.y, rotated.z);
};

export const worldVectorToBody = (worldVector: Vec3, ownerOrientation: Quaternion): Vec3 => {
  const normalized = normalizeQuaternion(ownerOrientation);
  return rotateVector({ x: -normalized.x, y: -normalized.y, z: -normalized.z, w: normalized.w }, worldVector);
};

export const selectCompatibleRcsNozzles = (
  nozzles: readonly NozzleSelectionCandidate[],
  input: RcsNozzleSelectionInput
): RcsNozzleSelectionSnapshot => {
  const bodyTranslation = worldVectorToBody(input.rcsTranslationAccelerationWorld, input.ownerOrientation);
  const translationDirection = normalize(bodyTranslation);
  const angularDirection = normalize(input.angularAccelerationBody);
  const translationActive = input.rcsTranslationActive && magnitude(bodyTranslation) > selectionEpsilon;
  const torqueActive = (input.rcsRotationActive || input.sasCorrectionActive) && magnitude(input.angularAccelerationBody) > selectionEpsilon;

  return {
    bodyLocalRcsTranslationAcceleration: bodyTranslation,
    bodyLocalAngularAcceleration: input.angularAccelerationBody,
    compatibility: nozzles.map((nozzle) => {
      const forceDirection = normalize(nozzle.localForceDirection);
      const torque = cross(nozzle.localPosition, forceDirection);
      const translationScore = translationActive ? dot(forceDirection, translationDirection) : 0;
      const torqueScore = torqueActive && magnitude(torque) > selectionEpsilon ? dot(normalize(torque), angularDirection) : 0;
      const translationCompatible = translationActive && translationScore > selectionEpsilon;
      const torqueCompatible = torqueActive && torqueScore > selectionEpsilon;
      return {
        id: nozzle.id,
        translationScore,
        torqueScore,
        translationCompatible,
        torqueCompatible,
        visible: translationCompatible || torqueCompatible
      };
    })
  };
};
