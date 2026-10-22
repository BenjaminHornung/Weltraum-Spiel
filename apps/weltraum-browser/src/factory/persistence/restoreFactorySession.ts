import { FACTORY_COMBINED_SAVE_V2_VERSION, assertFactoryDecodedCheckpoint, assertFactoryDecodedOwner, type FactoryDecodedCheckpoint, type FactoryDecodedCheckpointV1, type FactoryHostCursorV1, type FactorySessionCheckpointV1, type FactorySessionCheckpointV2 } from "./factoryCheckpoint";
import type { FactoryHostPort, FactoryHostView } from "../session/hostPort";
import type { FactoryCatalog } from "../contracts";
import type { MaterialView } from "../material/reservations";
import { bindFactoryDomainSession, reconcileDryFactoryInstallations, reconcileDryFactoryOwnerInstallations } from "../session/dryFactorySlice";
import { canonicalJson } from "../../resources/serialization";

export interface FactoryRestoreSeedV1 {
  readonly host: FactoryHostCursorV1;
  readonly factory: FactorySessionCheckpointV1;
  readonly material: MaterialView;
  readonly domainSession: ReturnType<typeof bindFactoryDomainSession>;
}
export interface FactoryRestoreSeedV2 {
  readonly host: FactoryHostCursorV1;
  readonly factory: FactorySessionCheckpointV2;
  readonly material: MaterialView;
  readonly domainSession: ReturnType<typeof bindFactoryDomainSession>;
}
export type FactoryRestoreSeed = FactoryRestoreSeedV1 | FactoryRestoreSeedV2;

export interface FactoryCheckpointCaptureV1 {
  readonly host: FactoryHostCursorV1;
  readonly factory: FactorySessionCheckpointV1;
  assertCurrent(): void;
  release(): void;
}
export interface FactoryCheckpointCaptureV2 {
  readonly host: FactoryHostCursorV1;
  readonly factory: FactorySessionCheckpointV2;
  assertCurrent(): void;
  release(): void;
}
/** Historical public capture remains V1; only Host/Root boundaries use the union. */
export type FactoryCheckpointCapture = FactoryCheckpointCaptureV1;
export type FactoryCheckpointCaptureUnion = FactoryCheckpointCaptureV1 | FactoryCheckpointCaptureV2;

export const isFactoryHostNeutral = (header: FactoryHostView): boolean => Boolean(header.input
  && !header.input.active && !header.input.activationPending && !header.input.pointerLocked && !header.input.pausePending);

/** Shared live Host/Native admission for both historical V1 and compact V2 owners. */
function readFactoryRestoreSeedCore(host: FactoryHostPort, catalog: FactoryCatalog, decoded: FactoryDecodedCheckpoint,
  factory: FactorySessionCheckpointV1, header: FactoryHostView): FactoryRestoreSeedV1;
function readFactoryRestoreSeedCore(host: FactoryHostPort, catalog: FactoryCatalog, decoded: FactoryDecodedCheckpoint,
  factory: FactorySessionCheckpointV2, header: FactoryHostView): FactoryRestoreSeedV2;
function readFactoryRestoreSeedCore(host: FactoryHostPort, catalog: FactoryCatalog, decoded: FactoryDecodedCheckpoint,
  factory: FactorySessionCheckpointV1 | FactorySessionCheckpointV2, header: FactoryHostView): FactoryRestoreSeed;
function readFactoryRestoreSeedCore(host: FactoryHostPort, catalog: FactoryCatalog, decoded: FactoryDecodedCheckpoint,
  factory: FactorySessionCheckpointV1 | FactorySessionCheckpointV2, header: FactoryHostView): FactoryRestoreSeed {
  const checkpoint = decoded.checkpoint, terrain = checkpoint.native.terrain, base = decoded.native.base;
  if (!host.current() || !host.construction || !host.handling || !header.confirmed || header.physicsStatus !== "Paused" || !isFactoryHostNeutral(header)
    || header.sessionId !== checkpoint.host.sessionId || header.epoch !== checkpoint.host.epoch || header.nativeTick !== checkpoint.host.nativeTick
    || header.terrain.epoch !== terrain.epoch || header.terrain.revision !== terrain.revision || header.terrain.sourceDigest !== terrain.sourceDigest
    || header.terrain.baseDigest !== terrain.baseDigest || header.terrain.profileVersion !== checkpoint.native.profiles.source
    || header.terrain.cellMeters !== base.cellMeters || canonicalJson(header.terrain.originMeters) !== canonicalJson(base.originMeters)
    || header.terrain.sizeX !== base.sizeX || header.terrain.sizeY !== base.sizeY || header.terrain.sizeZ !== base.sizeZ
    || decoded.material.catalog.canonicalJson !== catalog.canonicalJson) throw new Error("Factory restore Host admission mismatch");

  const native = host.handling.read(), saved = checkpoint.nativeFactory;
  const owners = native.owners.map(({ bodyHandle: _bodyHandle, colliderHandles: _colliderHandles, ...owner }) => owner);
  const cargo = native.cargo && { ownerId: native.cargo.ownerId, containerId: native.cargo.containerId, opened: native.cargo.opened,
    sourceDigest: native.cargo.sourceDigest, profileDigest: native.cargo.profileDigest, site: native.cargo.site, openReceipt: native.cargo.openReceipt };
  const carrier = native.carrier && { ownerId: native.carrier.ownerId, transactionId: native.carrier.transactionId, profileId: native.carrier.profileId,
    profileDigest: native.carrier.profileDigest, phase: native.carrier.phase, massMg: native.carrier.massMg, materialBinding: native.carrier.materialBinding,
    containerId: native.carrier.containerId, positionMm: native.carrier.positionMm };
  const savedCarrier = saved.carrier && { ownerId: saved.carrier.ownerId, transactionId: saved.carrier.transactionId, profileId: saved.carrier.profileId,
    profileDigest: saved.carrier.profileDigest, phase: saved.carrier.phase, massMg: saved.carrier.massMg, materialBinding: saved.carrier.materialBinding,
    containerId: saved.carrier.containerId, positionMm: saved.carrier.positionMm };
  if (native.state !== "Idle" || native.transactionId !== null || native.prepared !== null || native.revision !== saved.revision
    || native.owners.some(owner => !Number.isFinite(owner.bodyHandle) || owner.bodyHandle < 0 || !Array.isArray(owner.colliderHandles)
      || !owner.colliderHandles.length || !owner.colliderHandles.every(handle => Number.isFinite(handle) && handle >= 0))
    || canonicalJson(owners) !== canonicalJson(saved.owners) || canonicalJson(cargo ?? null) !== canonicalJson(saved.cargo)
    || canonicalJson(carrier ?? null) !== canonicalJson(savedCarrier ?? null)) {
    throw new Error("Factory restore Native owners mismatch");
  }

  const reconciled = factory.version === "fp06-factory-session-owner-v2"
    ? reconcileDryFactoryOwnerInstallations(factory.domain, decoded.material, factory.installations)
    : reconcileDryFactoryInstallations(factory.domain, decoded.material, factory.installations);
  if (reconciled.state !== factory.domain || reconciled.material !== decoded.material) throw new Error("Factory restore would recreate saved state");
  const domainSession = bindFactoryDomainSession(checkpoint.host.sessionId);
  if (factory.domain.binding.sessionId !== domainSession.domainSessionId || factory.domain.binding.epoch !== checkpoint.host.epoch) {
    throw new Error("Factory restore logical identity mismatch");
  }
  return factory.version === "fp06-factory-session-owner-v2"
    ? Object.freeze({ host: checkpoint.host, factory, material: decoded.material, domainSession })
    : Object.freeze({ host: checkpoint.host, factory, material: decoded.material, domainSession });
}

/** Admit only the exact decoder-issued V1 save whose Native owners are live. */
export const readFactoryRestoreSeed = (host: FactoryHostPort, catalog: FactoryCatalog, decoded: FactoryDecodedCheckpointV1,
  header: FactoryHostView): FactoryRestoreSeedV1 => {
  assertFactoryDecodedCheckpoint(decoded);
  return readFactoryRestoreSeedCore(host,catalog,decoded,decoded.checkpoint.factory,header);
};

/** Compact Entry path. The Owner must be paired with this exact fully decoded save. */
export const readFactoryCompactRestoreSeed = (host: FactoryHostPort, catalog: FactoryCatalog, decoded: FactoryDecodedCheckpoint,
  owner: FactorySessionCheckpointV2, header: FactoryHostView): FactoryRestoreSeedV2 => {
  assertFactoryDecodedOwner(decoded,owner);
  const factory:FactorySessionCheckpointV2=decoded.checkpoint.version===FACTORY_COMBINED_SAVE_V2_VERSION
    ? decoded.checkpoint.factory
    : Object.freeze({...decoded.checkpoint.factory,version:"fp06-factory-session-owner-v2",domain:owner.domain});
  return readFactoryRestoreSeedCore(host,catalog,decoded,factory,header);
};
