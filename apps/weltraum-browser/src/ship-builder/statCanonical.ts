import { canonicalJsonHash } from "./canonicalJson";
import type {
  ShipAnalysisPolicy,
  ShipAnalysisPolicyPayload,
  ShipStatPreview,
  ShipStatPreviewPayload
} from "./types";
import {
  assertAllowedObjectFields,
  dataError,
  dataPath,
  deepFreeze,
  readFiniteNumber,
  readPlainObject,
  readString
} from "./validation";

const hasOwn = (value: Readonly<Record<string, unknown>>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const optionalNumber = (
  object: Readonly<Record<string, unknown>>,
  key: string,
  defaultValue: number,
  minimum: number,
  maximum?: number
): number =>
  hasOwn(object, key)
    ? readFiniteNumber(object[key], dataPath("", key), {
        minimum,
        ...(maximum !== undefined ? { maximum } : {})
      })
    : defaultValue;

const optionalNullableNumber = (
  object: Readonly<Record<string, unknown>>,
  key: string,
  minimum: number,
  maximum?: number
): number | null => {
  if (!hasOwn(object, key) || object[key] === null) {
    return null;
  }
  return readFiniteNumber(object[key], dataPath("", key), {
    minimum,
    ...(maximum !== undefined ? { maximum } : {})
  });
};

const validateVersionAndSignature = (
  object: Readonly<Record<string, unknown>>,
  versionKey: "previewVersion" | "policyVersion"
): void => {
  if (hasOwn(object, versionKey)) {
    const version = readFiniteNumber(object[versionKey], dataPath("", versionKey));
    if (version !== 1) {
      throw dataError("UnsupportedVersion", dataPath("", versionKey), "Unsupported stat-analysis contract version.");
    }
  }
  if (hasOwn(object, "signature")) {
    readString(object.signature, "/signature");
  }
};

export const createShipStatPreview = (input: unknown = {}): ShipStatPreview => {
  const object = readPlainObject(input, "");
  assertAllowedObjectFields(object, "", [
    "previewVersion",
    "fuelFillFraction",
    "cargoPreviewMassKg",
    "cargoPreviewVolumeM3",
    "signature"
  ]);
  validateVersionAndSignature(object, "previewVersion");
  const payload: ShipStatPreviewPayload = {
    previewVersion: 1,
    fuelFillFraction: optionalNumber(object, "fuelFillFraction", 1, 0, 1),
    cargoPreviewMassKg: optionalNumber(object, "cargoPreviewMassKg", 0, 0),
    cargoPreviewVolumeM3: optionalNumber(object, "cargoPreviewVolumeM3", 0, 0)
  };
  return deepFreeze({ ...payload, signature: canonicalJsonHash(payload) }) as ShipStatPreview;
};

export const createShipAnalysisPolicy = (input: unknown = {}): ShipAnalysisPolicy => {
  const object = readPlainObject(input, "");
  assertAllowedObjectFields(object, "", [
    "policyVersion",
    "thrustOffsetWarningMeters",
    "weakBrakingRatio",
    "hardOverlapRatio",
    "lowAccelerationMps2",
    "minimumRcsSymmetryRatio",
    "signature"
  ]);
  validateVersionAndSignature(object, "policyVersion");
  const payload: ShipAnalysisPolicyPayload = {
    policyVersion: 1,
    thrustOffsetWarningMeters: optionalNumber(object, "thrustOffsetWarningMeters", 0.35, 0),
    weakBrakingRatio: optionalNumber(object, "weakBrakingRatio", 0.25, 0, 1),
    hardOverlapRatio: optionalNumber(object, "hardOverlapRatio", 0.75, 0, 1),
    lowAccelerationMps2: optionalNullableNumber(object, "lowAccelerationMps2", 0),
    minimumRcsSymmetryRatio: optionalNullableNumber(object, "minimumRcsSymmetryRatio", 0, 1)
  };
  return deepFreeze({ ...payload, signature: canonicalJsonHash(payload) }) as ShipAnalysisPolicy;
};
