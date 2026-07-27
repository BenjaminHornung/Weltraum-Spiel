import { hashAdaptiveCanonical } from "../adaptive";
import {
  OBJECT_PROXY_SCHEMA_VERSION,
  SURFACE_PROXY_SCHEMA_VERSION,
  type ObjectProxyIdentity,
  type ProxyCurrentSourceResult,
  type SurfaceProxyIdentity
} from "./types";
import {
  deepFreeze,
  representationExactKeys,
  representationFail,
  representationId,
  representationNonNegativeSafeInteger,
  representationRecord,
  representationString
} from "./validation";

const adaptiveHashPattern = /^fnv1a64-v1:[0-9a-f]{16}$/;

const adaptiveHash = (value: unknown, path: string): string => {
  if (typeof value !== "string" || !adaptiveHashPattern.test(value)) {
    return representationFail("InvalidIdentity", path, "Expected an Adaptive canonical FNV-1a64 hash.");
  }
  return value;
};

const revision = (value: unknown, path: string): number => representationNonNegativeSafeInteger(value, path);

const validateObjectProxyIdentity = (value: unknown): ObjectProxyIdentity => {
  const record = representationRecord(value, "proxy");
  representationExactKeys(record, [
    "schemaVersion", "objectId", "objectRevision", "structuralContentHash", "damageDigest",
    "bandId", "proxyAlgorithmVersion", "proxyContentHash"
  ], "proxy");
  if (record.schemaVersion !== OBJECT_PROXY_SCHEMA_VERSION) {
    return representationFail("InvalidIdentity", "proxy/schemaVersion", "Unsupported object proxy schema.");
  }
  return {
    schemaVersion: OBJECT_PROXY_SCHEMA_VERSION,
    objectId: representationId(record.objectId, "proxy/objectId"),
    objectRevision: revision(record.objectRevision, "proxy/objectRevision"),
    structuralContentHash: adaptiveHash(record.structuralContentHash, "proxy/structuralContentHash"),
    damageDigest: representationString(record.damageDigest, "proxy/damageDigest"),
    bandId: representationId(record.bandId, "proxy/bandId"),
    proxyAlgorithmVersion: representationString(record.proxyAlgorithmVersion, "proxy/proxyAlgorithmVersion"),
    proxyContentHash: adaptiveHash(record.proxyContentHash, "proxy/proxyContentHash")
  };
};

const validateSurfaceProxyIdentity = (value: unknown): SurfaceProxyIdentity => {
  const record = representationRecord(value, "proxy");
  representationExactKeys(record, [
    "schemaVersion", "bodyId", "surfaceFrameId", "locationKind", "locationId", "generatorVersion",
    "sourceRevision", "editRevision", "sourceContentHash", "bandId", "proxyAlgorithmVersion", "proxyContentHash"
  ], "proxy");
  if (record.schemaVersion !== SURFACE_PROXY_SCHEMA_VERSION) {
    return representationFail("InvalidIdentity", "proxy/schemaVersion", "Unsupported surface proxy schema.");
  }
  if (record.locationKind !== "Region" && record.locationKind !== "Tile") {
    return representationFail("InvalidIdentity", "proxy/locationKind", "Location kind must be Region or Tile.");
  }
  return {
    schemaVersion: SURFACE_PROXY_SCHEMA_VERSION,
    bodyId: representationId(record.bodyId, "proxy/bodyId"),
    surfaceFrameId: representationId(record.surfaceFrameId, "proxy/surfaceFrameId"),
    locationKind: record.locationKind,
    locationId: representationId(record.locationId, "proxy/locationId"),
    generatorVersion: representationId(record.generatorVersion, "proxy/generatorVersion"),
    sourceRevision: revision(record.sourceRevision, "proxy/sourceRevision"),
    editRevision: revision(record.editRevision, "proxy/editRevision"),
    sourceContentHash: adaptiveHash(record.sourceContentHash, "proxy/sourceContentHash"),
    bandId: representationId(record.bandId, "proxy/bandId"),
    proxyAlgorithmVersion: representationString(record.proxyAlgorithmVersion, "proxy/proxyAlgorithmVersion"),
    proxyContentHash: adaptiveHash(record.proxyContentHash, "proxy/proxyContentHash")
  };
};

export const createObjectProxyIdentity = (value: unknown): ObjectProxyIdentity => {
  const record = representationRecord(value, "objectProxy");
  representationExactKeys(record, [
    "objectId", "objectRevision", "structuralContentHash", "damageDigest", "bandId", "proxyAlgorithmVersion"
  ], "objectProxy");
  const payload = deepFreeze({
    schemaVersion: OBJECT_PROXY_SCHEMA_VERSION,
    objectId: representationId(record.objectId, "objectProxy/objectId"),
    objectRevision: revision(record.objectRevision, "objectProxy/objectRevision"),
    structuralContentHash: adaptiveHash(record.structuralContentHash, "objectProxy/structuralContentHash"),
    damageDigest: representationString(record.damageDigest, "objectProxy/damageDigest"),
    bandId: representationId(record.bandId, "objectProxy/bandId"),
    proxyAlgorithmVersion: representationString(record.proxyAlgorithmVersion, "objectProxy/proxyAlgorithmVersion")
  });
  return deepFreeze({ ...payload, proxyContentHash: hashAdaptiveCanonical(payload) });
};

export const checkObjectProxyCurrentSource = (
  proxy: ObjectProxyIdentity,
  current: Readonly<{
    objectId: string;
    objectRevision: number;
    structuralContentHash: string;
    damageDigest: string;
    bandId: string;
    proxyAlgorithmVersion: string;
  }>
): ProxyCurrentSourceResult => {
  const checkedProxy = validateObjectProxyIdentity(proxy);
  const currentObjectId = representationId(current.objectId, "current/objectId");
  const currentRevision = revision(current.objectRevision, "current/objectRevision");
  const currentHash = adaptiveHash(current.structuralContentHash, "current/structuralContentHash");
  const currentDamage = representationString(current.damageDigest, "current/damageDigest");
  const currentBandId = representationId(current.bandId, "current/bandId");
  const currentAlgorithmVersion = representationString(current.proxyAlgorithmVersion, "current/proxyAlgorithmVersion");
  const proxyContentHash = hashAdaptiveCanonical({
    schemaVersion: checkedProxy.schemaVersion,
    objectId: checkedProxy.objectId,
    objectRevision: checkedProxy.objectRevision,
    structuralContentHash: checkedProxy.structuralContentHash,
    damageDigest: checkedProxy.damageDigest,
    bandId: checkedProxy.bandId,
    proxyAlgorithmVersion: checkedProxy.proxyAlgorithmVersion
  });
  if (checkedProxy.proxyContentHash !== proxyContentHash) return deepFreeze({ status: "Rejected", code: "ProxyContentHashMismatch" });
  if (checkedProxy.objectId !== currentObjectId) return deepFreeze({ status: "Rejected", code: "ObjectIdMismatch" });
  if (checkedProxy.objectRevision !== currentRevision) return deepFreeze({ status: "Rejected", code: "StaleObjectRevision" });
  if (checkedProxy.structuralContentHash !== currentHash) return deepFreeze({ status: "Rejected", code: "StructuralContentHashMismatch" });
  if (checkedProxy.damageDigest !== currentDamage) return deepFreeze({ status: "Rejected", code: "DamageDigestMismatch" });
  if (checkedProxy.bandId !== currentBandId) return deepFreeze({ status: "Rejected", code: "BandIdMismatch" });
  if (checkedProxy.proxyAlgorithmVersion !== currentAlgorithmVersion) return deepFreeze({ status: "Rejected", code: "ProxyAlgorithmVersionMismatch" });
  return deepFreeze({ status: "Ready" });
};

export const createSurfaceProxyIdentity = (value: unknown): SurfaceProxyIdentity => {
  const record = representationRecord(value, "surfaceProxy");
  representationExactKeys(record, [
    "bodyId", "surfaceFrameId", "locationKind", "locationId", "generatorVersion", "sourceRevision",
    "editRevision", "sourceContentHash", "bandId", "proxyAlgorithmVersion"
  ], "surfaceProxy");
  if (record.locationKind !== "Region" && record.locationKind !== "Tile") {
    return representationFail("InvalidIdentity", "surfaceProxy/locationKind", "Location kind must be Region or Tile.");
  }
  const locationKind: SurfaceProxyIdentity["locationKind"] = record.locationKind;
  const payload = deepFreeze({
    schemaVersion: SURFACE_PROXY_SCHEMA_VERSION,
    bodyId: representationId(record.bodyId, "surfaceProxy/bodyId"),
    surfaceFrameId: representationId(record.surfaceFrameId, "surfaceProxy/surfaceFrameId"),
    locationKind,
    locationId: representationId(record.locationId, "surfaceProxy/locationId"),
    generatorVersion: representationId(record.generatorVersion, "surfaceProxy/generatorVersion"),
    sourceRevision: revision(record.sourceRevision, "surfaceProxy/sourceRevision"),
    editRevision: revision(record.editRevision, "surfaceProxy/editRevision"),
    sourceContentHash: adaptiveHash(record.sourceContentHash, "surfaceProxy/sourceContentHash"),
    bandId: representationId(record.bandId, "surfaceProxy/bandId"),
    proxyAlgorithmVersion: representationString(record.proxyAlgorithmVersion, "surfaceProxy/proxyAlgorithmVersion")
  });
  return deepFreeze({ ...payload, proxyContentHash: hashAdaptiveCanonical(payload) });
};

export const checkSurfaceProxyCurrentSource = (
  proxy: SurfaceProxyIdentity,
  current: Readonly<{
    bodyId: string;
    surfaceFrameId: string;
    locationKind: "Region" | "Tile";
    locationId: string;
    generatorVersion: string;
    sourceRevision: number;
    editRevision: number;
    sourceContentHash: string;
    bandId: string;
    proxyAlgorithmVersion: string;
  }>
): ProxyCurrentSourceResult => {
  const checkedProxy = validateSurfaceProxyIdentity(proxy);
  const bodyId = representationId(current.bodyId, "current/bodyId");
  const surfaceFrameId = representationId(current.surfaceFrameId, "current/surfaceFrameId");
  if (current.locationKind !== "Region" && current.locationKind !== "Tile") {
    return representationFail("InvalidIdentity", "current/locationKind", "Location kind must be Region or Tile.");
  }
  const locationId = representationId(current.locationId, "current/locationId");
  const generatorVersion = representationId(current.generatorVersion, "current/generatorVersion");
  const sourceRevision = revision(current.sourceRevision, "current/sourceRevision");
  const editRevision = revision(current.editRevision, "current/editRevision");
  const sourceContentHash = adaptiveHash(current.sourceContentHash, "current/sourceContentHash");
  const bandId = representationId(current.bandId, "current/bandId");
  const proxyAlgorithmVersion = representationString(current.proxyAlgorithmVersion, "current/proxyAlgorithmVersion");
  const proxyContentHash = hashAdaptiveCanonical({
    schemaVersion: checkedProxy.schemaVersion,
    bodyId: checkedProxy.bodyId,
    surfaceFrameId: checkedProxy.surfaceFrameId,
    locationKind: checkedProxy.locationKind,
    locationId: checkedProxy.locationId,
    generatorVersion: checkedProxy.generatorVersion,
    sourceRevision: checkedProxy.sourceRevision,
    editRevision: checkedProxy.editRevision,
    sourceContentHash: checkedProxy.sourceContentHash,
    bandId: checkedProxy.bandId,
    proxyAlgorithmVersion: checkedProxy.proxyAlgorithmVersion
  });
  if (checkedProxy.proxyContentHash !== proxyContentHash) return deepFreeze({ status: "Rejected", code: "ProxyContentHashMismatch" });
  if (checkedProxy.bodyId !== bodyId) return deepFreeze({ status: "Rejected", code: "BodyIdMismatch" });
  if (checkedProxy.surfaceFrameId !== surfaceFrameId) return deepFreeze({ status: "Rejected", code: "SurfaceFrameIdMismatch" });
  if (checkedProxy.locationKind !== current.locationKind) return deepFreeze({ status: "Rejected", code: "LocationKindMismatch" });
  if (checkedProxy.locationId !== locationId) return deepFreeze({ status: "Rejected", code: "LocationIdMismatch" });
  if (checkedProxy.generatorVersion !== generatorVersion) return deepFreeze({ status: "Rejected", code: "GeneratorVersionMismatch" });
  if (checkedProxy.sourceRevision !== sourceRevision) return deepFreeze({ status: "Rejected", code: "StaleSourceRevision" });
  if (checkedProxy.editRevision !== editRevision) return deepFreeze({ status: "Rejected", code: "StaleEditRevision" });
  if (checkedProxy.sourceContentHash !== sourceContentHash) return deepFreeze({ status: "Rejected", code: "SourceContentHashMismatch" });
  if (checkedProxy.bandId !== bandId) return deepFreeze({ status: "Rejected", code: "BandIdMismatch" });
  if (checkedProxy.proxyAlgorithmVersion !== proxyAlgorithmVersion) return deepFreeze({ status: "Rejected", code: "ProxyAlgorithmVersionMismatch" });
  return deepFreeze({ status: "Ready" });
};
