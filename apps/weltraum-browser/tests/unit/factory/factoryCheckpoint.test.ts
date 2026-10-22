import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHvpFactorySourceSnapshotV5, createHvpFactorySourceSnapshotV6 } from "../../../src/hvp/hvpCoastSource";
import { materializeFactoryStartSiteV5 } from "../../../src/factory/fixtures/startSite";
import { materializeFactoryStartSiteV6 } from "../../../src/factory/fixtures/startSiteV6";
import { createFactoryCargoSite } from "../../../src/factory/fixtures/cargoSite";
import { createHvpTerrainRoot } from "../../../src/hestia-prototype/terrain/cutPlan";
import { collisionSectors } from "../../../src/hestia-prototype/physics/terrainColliders";
import { decodeHvpGrid, encodeHvpGrid } from "../../../src/hestia-prototype/persistence/gridCheckpoint";
import { createHvpPhysicsSession, resolveHvpGravity } from "../../../src/hestia-prototype/physics/session";
import { hvpCollisionDigest } from "../../../src/hestia-prototype/persistence/worldCheckpoint";
import { loadFactoryHullProjection } from "../../../src/factory/presentation/playAssetLoader";
import { createFactoryMaterialView, prepareFactoryMaterialStep, commitFactoryMaterialStep, type MaterialIntent, type MaterialMove, type MaterialView } from "../../../src/factory/material/reservations";
import { createFp02Fixture } from "../../../src/factory/catalog/fp02Catalog";
import { createResourceContainerDefinition, createResourceContainerSnapshot, createResourceContainerState } from "../../../src/resources/containers";
import { readCargoHandlingProfile } from "../../../src/factory/construction/cargoHandlingProfile";
import { factoryMaterialBytes, type FactoryInstallation } from "../../../src/factory/construction/placement";
import { createFactoryInstallationProfile, FACTORY_RUNTIME_INSTALLATION_PROFILE_CACHE_RESERVE_BYTES, transformFactoryBounds, transformFactoryPoint } from "../../../src/factory/construction/installationProfile";
import { canonicalJson, canonicalSignature } from "../../../src/resources/serialization";
import { bindFactoryDomainSession, adoptDryFactoryBelt, commitDryFactoryStep, prepareDryFactoryStep, readDryFactoryBeltPort, readDryFactorySupply, reconcileDryFactoryInstallations } from "../../../src/factory/session/dryFactorySlice";
import * as dryFactorySlice from "../../../src/factory/session/dryFactorySlice";
import type { FactoryUiBinding, FactoryUiCommand, FactoryUiReceipt } from "../../../src/factory/session/hostPort";
import { FACTORY_POWER_POLICY } from "../../../src/factory/power/factoryPower";
import { createPersistenceSignature } from "../../../src/persistence";
import { createMemorySaveRepository } from "../../../src/browser-storage";
import { createFactorySaveStore } from "../../../src/factory/persistence/factorySaveStore";
import { mountFactorySession, mountCompactFactorySession, type FactoryCompactSessionHandle, type FactorySessionHandle } from "../../../src/factory/session/factorySession";
import * as productionGoals from "../../../src/factory/session/freshLineageProjection";
import { factoryReason } from "../../../src/factory/ui/cargoPanel";
import type { FactoryHostPort, FactoryHostView } from "../../../src/factory/session/hostPort";
import {
  assertFactoryDecodedOwner, assertFactoryStoredDecodedCheckpoint, decodeFactoryCheckpoint, decodeFactoryCheckpointV2, decodeStoredFactoryCheckpoint,
  admitFactoryV1OwnerImport, encodeFactoryCheckpoint, encodeFactoryCheckpointV2, estimateFactoryV1OwnerImportBytes,
  FACTORY_COMBINED_SAVE_PROFILES, FACTORY_COMBINED_SAVE_V2_PROFILES, FACTORY_COMBINED_SAVE_V6_PROFILES, FACTORY_COMBINED_SAVE_V2_V6_PROFILES,
  FACTORY_SAVE_CPU_BYTES, FACTORY_SAVE_TRANSPORT_BYTES, createFactorySaveEnvelopeInput, factoryCheckpointBytes, inspectFactoryCheckpointTree, parseFactoryCheckpoint, readFactoryDecodedOwner,
  readFactoryDecodedOwnerImportBytes,
  type FactoryCombinedCheckpointInput, type FactoryCombinedCheckpointV1, type FactoryDecodedCheckpoint,
  type FactorySessionCheckpointV1, type FactorySessionCheckpointV2,
  type FactoryPaidPowerLinkV1
} from "../../../src/factory/persistence/factoryCheckpoint";
import type { FactoryPowerSuccess } from "../../../src/factory/power/factoryPower";
import type { FactoryNativeOwnerCheckpoint } from "../../../src/hestia-prototype/persistence/factoryWorldParts";
import type { ProductionStart } from "../../../src/factory/production/recipeAdmission";

const fixture = createFp02Fixture("cargo");
const repo = fileURLToPath(new URL("../../../../../", import.meta.url));
const HULL_RUNTIME_URL = "/factory/crashsite-walkable-v1-2026-10-19/crashsite-walkable-v1.glb";
let source: ReturnType<typeof materializeFactoryStartSiteV5>;
let root: ReturnType<typeof createHvpTerrainRoot>;
let physics: Awaited<ReturnType<typeof createHvpPhysicsSession>>;
let artifact: ReturnType<typeof encodeFactoryCheckpoint>;
let v6Physics: Awaited<ReturnType<typeof createHvpPhysicsSession>> | undefined;
let v6Artifact: ReturnType<typeof encodeFactoryCheckpoint> | undefined;
let v6TerrainOnlyCollisionDigest: string | undefined;
let v6CombinedCollisionDigest: string | undefined;
let v6HullSectorCount = 0;
const NATIVE_TICKS_PER_FACTORY_STEP = 6;
const PAID_W09_STEPS = 56;

beforeAll(async () => {
  source = materializeFactoryStartSiteV5();
  root = createHvpTerrainRoot(source, "factory-save-test", 2);
  physics = await createHvpPhysicsSession([...collisionSectors(root.read())], { x: -9, y: 8, z: -9 }, resolveHvpGravity(),
    { spawn: { x: -9, y: 2.42, z: -11 }, coverage: [{ minX: -16, maxX: 16, minZ: -16, maxZ: 16 }] },
    undefined, undefined, "worker-world-save-test");
  for (let tick = 0; tick < NATIVE_TICKS_PER_FACTORY_STEP * PAID_W09_STEPS; tick++) physics.advance(1 / 60);
  if (physics.read().ticks !== NATIVE_TICKS_PER_FACTORY_STEP * PAID_W09_STEPS) throw new Error("Native test clock did not reach the paid W09 fixture step");
  physics.pause();
  const sourceStack = fixture.resourceState.contents.find(stack => stack.resourceId === "fp02_bulk_steel_known")!;
  const buffer = createResourceContainerSnapshot(createResourceContainerDefinition({ containerId: "save_test_buffer", kind: "OutpostStorage", maxMassKg: 10, maxVolumeM3: 1, maxStackCount: 20 }),
    createResourceContainerState({ containerId: "save_test_buffer", ownerId: fixture.resourceState.ownerId, contents: [] }, fixture.catalog.resources), fixture.catalog.resources);
  const cargo = createResourceContainerSnapshot(createResourceContainerDefinition({ containerId: fixture.resourceState.containerId, kind: "ShipCargo", maxMassKg: 4000, maxVolumeM3: 30, maxStackCount: 200 }), fixture.resourceState, fixture.catalog.resources);
  const initial = createFactoryMaterialView(fixture.catalog, [cargo, buffer]);
  const plan = prepareFactoryMaterialStep(initial, { kind: "transfer", transactionId: "save_test_transfer", ownerId: fixture.resourceState.ownerId!,
    actorId: fixture.resourceState.ownerId!, moves: [{ sourceContainerId: fixture.resourceState.containerId, sourceStackId: sourceStack.stackId,
      targetContainerId: "save_test_buffer", targetStackId: "save_test_steel", itemId: "fp02.bulk.steel_known", quantityUnits: 1 }] });
  if (plan.status !== "Prepared") throw new Error(plan.reason);
  const committed = commitFactoryMaterialStep(initial, plan);
  if (committed.status !== "Committed") throw new Error(committed.status === "Rejected" ? committed.reason : "Unexpected material replay");
  const sessionId = root.read().sessionId, epoch = root.read().epoch;
  const session = bindFactoryDomainSession(sessionId), binding = { sessionId: session.domainSessionId, epoch, netRevision: 0,
    catalogDigest: fixture.catalog.catalogDigest, sourceProfileDigest: FACTORY_POWER_POLICY.sourceObservationVersion };
  const site = createFactoryCargoSite(source);
  const material = { version: "fp06-material-owner-v1" as const, catalogDigest: committed.view.catalog.catalogDigest,
    revision: committed.view.revision, containers: committed.view.containers.map(c => ({ definition: c.definition, state: c.state })),
    reservations: committed.view.reservations, receipts: committed.view.receipts };
  const input: FactoryCombinedCheckpointInput = {
    host: { sessionId, epoch, nativeTick: physics.read().ticks, remainderTicks: 0, steps: 0 },
    native: { version: "fp06-native-core-checkpoint-v1", profiles: FACTORY_COMBINED_SAVE_PROFILES.native, terrain: root.checkpoint(), plants: [],
      world: physics.checkpoint(), receipts: { terrain: { version: "hvp-command-receipts-v1", kind: "terrain", entries: [], last: null },
        structural: { version: "hvp-command-receipts-v1", kind: "structural", entries: [], last: null },
        moving: { version: "hvp-command-receipts-v1", kind: "moving", entries: [], last: null } },
      view: { camera: { mode: "Orbit", preset: "C04-WIDE", fov: 55, position: { x: -24, y: 18, z: -28 }, target: { x: 0, y: 1, z: 1 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } },
        playerYaw: Math.PI, playerPitch: 0, thirdPerson: true, waterEnabled: true, aoEnabled: true,
        tool: { mode: 2, sequence: 0, structureSequence: 0, movingSequence: 0, edges: 0 } }, progress: null, neighbor: null },
    nativeFactory: { version: "fp06-native-factory-parts-v1", revision: 0, state: "Idle", transactionId: null, prepared: null,
      cargo: { ownerId: site.ownerId, containerId: site.containerId, opened: false, sourceDigest: site.sourceDigest, profileDigest: site.profileDigest, site, openReceipt: null },
      carrier: null, owners: [], completedTransactionIds: [] },
    factory: { version: "fp06-factory-session-owner-v1", installations: [], material,
      domain: { binding, revision: 0, tickEndUs: "0", power: { version: "fp06-factory-power-v1", binding, revision: 0, tickEndUs: "0", battery: null, consumers: [] }, machines: [], belts: [], lastStep: null },
      lastPower: null, links: [], recipeSelections: [], waitingStarts: [], commandReceipts: [], lastReceipt: null, publicationRevision: 0 }
  };
  artifact = encodeFactoryCheckpoint(input);
  const sourceV6 = materializeFactoryStartSiteV6(), rootV6 = createHvpTerrainRoot(sourceV6, "factory-save-test", 2);
  const hull = await loadFactoryHullProjection({ instanceId: "checkpoint_v6_hull", fetch: async url => {
    if (String(url) !== HULL_RUNTIME_URL) throw new Error("Checkpoint V6 fixture requested an unexpected Hull path");
    return new Response(new Uint8Array(readFileSync(`${repo}apps/weltraum-browser/public/factory/crashsite-walkable-v1-2026-10-19/crashsite-walkable-v1.glb`)));
  } });
  const terrainSectors = [...collisionSectors(rootV6.read())], sectors = [...terrainSectors, ...hull.nativeSectors];
  v6TerrainOnlyCollisionDigest = hvpCollisionDigest(terrainSectors);
  v6CombinedCollisionDigest = hvpCollisionDigest(sectors);
  v6HullSectorCount = hull.nativeSectors.length;
  const physicsV6 = await createHvpPhysicsSession(sectors, { x: -9, y: 8, z: -9 }, resolveHvpGravity(),
    { spawn: { x: -9, y: 2.42, z: -11 }, coverage: [{ minX: -16, maxX: 16, minZ: -16, maxZ: 16 }] },
    undefined, undefined, "worker-world-save-test");
  v6Physics = physicsV6;
  for (let tick = 0; tick < NATIVE_TICKS_PER_FACTORY_STEP * PAID_W09_STEPS; tick++) physicsV6.advance(1 / 60);
  if (physicsV6.read().ticks !== NATIVE_TICKS_PER_FACTORY_STEP * PAID_W09_STEPS) throw new Error("V6 Native test clock did not reach the checkpoint fixture step");
  physicsV6.pause();
  const siteV6 = createFactoryCargoSite(sourceV6);
  v6Artifact = encodeFactoryCheckpoint({ ...input,
    host: { ...input.host, nativeTick: physicsV6.read().ticks },
    native: { ...input.native, profiles: { ...input.native.profiles, source: "hvp-factory-startsite-v6" },
      terrain: rootV6.checkpoint(), world: physicsV6.checkpoint() },
    nativeFactory: { ...input.nativeFactory, cargo: { ...input.nativeFactory.cargo, sourceDigest: siteV6.sourceDigest,
      profileDigest: siteV6.profileDigest, site: siteV6 } }
  });
}, 120_000);

afterAll(async () => { await v6Physics?.dispose(); await physics?.dispose(); });

it("round-trips exact V5 source bytes and complete Factory material receipt bytes", () => {
  const decoded = decodeFactoryCheckpoint(JSON.parse(JSON.stringify(artifact)));
  expect(artifact.profiles).toEqual(FACTORY_COMBINED_SAVE_PROFILES);
  expect(decoded.checkpoint).toEqual(artifact);
  expect(() => readFactoryDecodedOwner(decoded)).toThrow(/no issued compact owner/);
  expect(decoded.checkpoint.native.terrain.baseDigest).toBe(createHvpFactorySourceSnapshotV5(source.copySlots()).sourceDigest);
  expect(decoded.material.receipts[0]!.requestCanonicalJson).toBe(artifact.factory.material.receipts[0]!.requestCanonicalJson);
  expect(decoded.checkpoint.native.world.sessionId).toBe("worker-world-save-test");
  expect(decoded.checkpoint.host.sessionId).toBe("factory-save-test");
});

it("rejects rehashed Factory V5 source tampering and oversized bytes before text decoding", () => {
  const { signature: _signature, ...body } = artifact;
  const decodedBase = decodeHvpGrid(body.native.terrain.base), slots = decodedBase.copySlots();
  slots[0] = slots[0] === 0 ? 1 : 0;
  const changedBase = encodeHvpGrid({ sizeX: decodedBase.sizeX, sizeY: decodedBase.sizeY, sizeZ: decodedBase.sizeZ,
    originMeters: decodedBase.originMeters, cellMeters: decodedBase.cellMeters,
    readSlot: (x, y, z) => slots[x + y * decodedBase.sizeX + z * decodedBase.sizeX * decodedBase.sizeY] });
  const bad = { ...body, native: { ...body.native, terrain: { ...body.native.terrain, base: changedBase } } };
  expect(() => decodeFactoryCheckpoint({ ...bad, signature: createPersistenceSignature(bad) })).toThrow(/V5 base bytes\/digest/);
  const badEpoch = { ...body, host: { ...body.host, epoch: body.host.epoch + 1 } };
  expect(() => decodeFactoryCheckpoint({ ...badEpoch, signature: createPersistenceSignature(badEpoch) })).toThrow(/host cursor/i);
  const decode = vi.spyOn(TextDecoder.prototype, "decode");
  try {
    expect(() => parseFactoryCheckpoint(new Uint8Array(FACTORY_SAVE_TRANSPORT_BYTES + 1))).toThrow(/before decode/);
    expect(decode).not.toHaveBeenCalled();
  } finally { decode.mockRestore(); }
});

it("round-trips a real V6 source and Hull collision checkpoint through V1 and V2 while retaining V5 profiles", () => {
  const checkpoint = v6Artifact;
  if (!checkpoint || !v6TerrainOnlyCollisionDigest || !v6CombinedCollisionDigest) throw new Error("V6 combined checkpoint fixture setup did not complete");
  expect(artifact.profiles).toEqual(FACTORY_COMBINED_SAVE_PROFILES);
  expect(checkpoint.profiles).toEqual(FACTORY_COMBINED_SAVE_V6_PROFILES);
  expect(checkpoint.native.profiles.source).toBe("hvp-factory-startsite-v6");
  expect(checkpoint.native.terrain.baseDigest).toBe("360b00fa");
  expect(checkpoint.native.terrain.baseDigest).toBe(checkpoint.nativeFactory.cargo.sourceDigest);
  expect(checkpoint.nativeFactory.cargo.site.sourceDigest).toBe(checkpoint.native.terrain.baseDigest);
  expect(checkpoint.native.world.collisionDigest).toBe(v6CombinedCollisionDigest);
  expect(v6CombinedCollisionDigest).not.toBe(v6TerrainOnlyCollisionDigest);
  expect(v6HullSectorCount).toBe(8);

  const storedV1 = decodeStoredFactoryCheckpoint(JSON.parse(JSON.stringify(checkpoint)));
  if (storedV1.checkpoint.version !== "fp06-combined-checkpoint-v1") throw new Error("V6 fixture did not decode through the V1 checkpoint path");
  expect(storedV1.checkpoint).toEqual(checkpoint);
  expect(storedV1.checkpoint.profiles).toEqual(FACTORY_COMBINED_SAVE_V6_PROFILES);
  const owner = readFactoryDecodedOwner(storedV1);
  const compact = encodeFactoryCheckpointV2({ host: storedV1.checkpoint.host, native: storedV1.checkpoint.native,
    nativeFactory: storedV1.checkpoint.nativeFactory, factory: owner });
  expect(compact.profiles).toEqual(FACTORY_COMBINED_SAVE_V2_V6_PROFILES);
  expect(compact.native.world.collisionDigest).toBe(v6CombinedCollisionDigest);
  const storedV2 = decodeFactoryCheckpointV2(JSON.parse(JSON.stringify(compact)));
  expect(storedV2.checkpoint).toEqual(compact);
  expect(storedV2.checkpoint.profiles).toEqual(FACTORY_COMBINED_SAVE_V2_V6_PROFILES);

  const v1Input = { host: storedV1.checkpoint.host, native: storedV1.checkpoint.native,
    nativeFactory: storedV1.checkpoint.nativeFactory, factory: storedV1.checkpoint.factory };
  const v2Input = { ...v1Input, factory: owner };
  const assertRejectedBeforeAdmission = (attempt: (admit: () => void) => unknown) => {
    let admissionCalled = false;
    expect(() => attempt(() => { admissionCalled = true; throw new Error("Invalid input reached admission"); }))
      .toThrow(/Invalid Factory checkpoint encoder/i);
    expect(admissionCalled).toBe(false);
  };
  const extraField = { unexpectedRootField: 1 };
  const extraSymbol = { [Symbol("unexpectedRootSymbol")]: 1 };
  assertRejectedBeforeAdmission(admit => encodeFactoryCheckpoint({ ...v1Input, ...extraField } as typeof v1Input, admit));
  assertRejectedBeforeAdmission(admit => encodeFactoryCheckpoint({ ...v1Input, ...extraSymbol } as typeof v1Input, admit));
  assertRejectedBeforeAdmission(admit => encodeFactoryCheckpointV2({ ...v2Input, ...extraField } as typeof v2Input, admit));
  assertRejectedBeforeAdmission(admit => encodeFactoryCheckpointV2({ ...v2Input, ...extraSymbol } as typeof v2Input, admit));

  const withNestedSourceAccessor = () => {
    let sourceReads = 0;
    const profiles = { ...storedV1.checkpoint.native.profiles };
    Object.defineProperty(profiles, "source", { enumerable: true, get: () => {
      sourceReads += 1;
      return storedV1.checkpoint.native.profiles.source;
    } });
    return { native: { ...storedV1.checkpoint.native, profiles }, sourceReads: () => sourceReads };
  };
  const v1Accessor = withNestedSourceAccessor();
  expect(() => encodeFactoryCheckpoint({ host: storedV1.checkpoint.host, native: v1Accessor.native,
    nativeFactory: storedV1.checkpoint.nativeFactory, factory: v1Input.factory })).toThrow(/accessor/i);
  expect(v1Accessor.sourceReads()).toBe(0);
  const v2Accessor = withNestedSourceAccessor();
  expect(() => encodeFactoryCheckpointV2({ host: storedV1.checkpoint.host, native: v2Accessor.native,
    nativeFactory: storedV1.checkpoint.nativeFactory, factory: owner })).toThrow(/accessor/i);
  expect(v2Accessor.sourceReads()).toBe(0);
});

it("rejects rehashed mixed and unknown V5/V6 source, Native, terrain, and outer profiles", () => {
  const checkpoint = v6Artifact;
  if (!checkpoint) throw new Error("V6 combined checkpoint fixture setup did not complete");
  const resign = (body: Omit<FactoryCombinedCheckpointV1, "signature">): FactoryCombinedCheckpointV1 =>
    ({ ...body, signature: createPersistenceSignature(body) });
  const { signature: _signature, ...v6Body } = checkpoint;

  const mixedOuter = resign({ ...v6Body, profiles: FACTORY_COMBINED_SAVE_PROFILES });
  expect(() => decodeFactoryCheckpoint(mixedOuter)).toThrow(/profile/i);

  const mixedNative = resign({ ...v6Body, native: { ...v6Body.native,
    profiles: { ...v6Body.native.profiles, source: "hvp-factory-startsite-v5" } } });
  expect(() => decodeFactoryCheckpoint(mixedNative)).toThrow(/profile/i);

  const mixedTerrain = resign({ ...v6Body, native: { ...v6Body.native,
    terrain: { ...v6Body.native.terrain, baseDigest: "0e2a0bcb" } } });
  expect(() => decodeFactoryCheckpoint(mixedTerrain)).toThrow(/Invalid Native cargo checkpoint binding/);

  const wrongV6Source = createHvpFactorySourceSnapshotV6(source.copySlots());
  const wrongV6Terrain = createHvpTerrainRoot(wrongV6Source, v6Body.host.sessionId, v6Body.host.epoch).checkpoint();
  const wrongV6CargoSite = createFactoryCargoSite(wrongV6Source);
  expect(wrongV6Source.sourceDigest).not.toBe("360b00fa");
  expect(wrongV6Terrain.baseDigest).toBe(wrongV6Source.sourceDigest);
  expect(wrongV6CargoSite.sourceDigest).toBe(wrongV6Terrain.baseDigest);
  const reboundWrongBase = resign({ ...v6Body,
    native: { ...v6Body.native, terrain: wrongV6Terrain },
    nativeFactory: { ...v6Body.nativeFactory, cargo: { ...v6Body.nativeFactory.cargo,
      sourceDigest: wrongV6CargoSite.sourceDigest, profileDigest: wrongV6CargoSite.profileDigest, site: wrongV6CargoSite } }
  });
  expect(() => decodeFactoryCheckpoint(reboundWrongBase)).toThrow(/V6 base bytes\/digest/i);

  const unknownSource = resign({ ...v6Body, native: { ...v6Body.native,
    profiles: { ...v6Body.native.profiles, source: "hvp-factory-startsite-v99" as never } } });
  expect(() => decodeFactoryCheckpoint(unknownSource)).toThrow(/Unsupported combined Factory checkpoint source profile/);

  const { signature: _legacySignature, ...v5Body } = artifact;
  const renamedV5 = resign({ ...v5Body, profiles: FACTORY_COMBINED_SAVE_V6_PROFILES,
    native: { ...v5Body.native, profiles: { ...v5Body.native.profiles, source: "hvp-factory-startsite-v6" } } });
  expect(() => decodeFactoryCheckpoint(renamedV5)).toThrow(/V6 base bytes\/digest/i);
});

it("counts first elements of arrays in the V1 compact-owner preallocation gate", () => {
  const objectValue = '{"facts":{"a":1}}', arrayValue = '{"facts":{"a":[1]}}';
  const objectBytes = estimateFactoryV1OwnerImportBytes(objectValue, []), arrayBytes = estimateFactoryV1OwnerImportBytes(arrayValue, []);
  expect(arrayBytes - objectBytes).toBeGreaterThanOrEqual(64 + 16 + 2 * (arrayValue.length - objectValue.length));
  const base = FACTORY_SAVE_CPU_BYTES - objectBytes;
  expect(admitFactoryV1OwnerImport(base, objectValue, [])).toBe(FACTORY_SAVE_CPU_BYTES);
  expect(() => admitFactoryV1OwnerImport(base, arrayValue, [])).toThrow("Factory checkpoint CPU/decode budget before allocation");
});

it("counts the separately saved Native Player in the combined body preflight", () => {
  const { signature: _signature, ...body } = artifact;
  const world = { ...body.native.world, bodies: Array.from({ length: 63 }, () => ({ surfaces: [{}] })) };
  const bad = { ...body, native: { ...body.native, world } };
  expect(() => decodeFactoryCheckpoint({ ...bad, signature: createPersistenceSignature(bad) })).toThrow(/Combined Native body budget/);
});

it("uses the repository's atomic Factory slot CAS and leaves stale writes rejected", async () => {
  const repository = createMemorySaveRepository([]), store = createFactorySaveStore(repository);
  await store.initialize();
  try {
    const written = await store.save(artifact, null), loaded = await store.load();
    expect(written.metadata.recordRevision).toBe(1);
    expect(loaded.decoded.checkpoint).toEqual(artifact);
    expect(loaded.decoded.checkpoint.version).toBe("fp06-combined-checkpoint-v1");
    expect(loaded.owner.version).toBe("fp06-factory-session-owner-v2");
    const { lastStep: _lastStep, ...core } = loaded.owner.domain;
    expect(readFactoryDecodedOwnerImportBytes(loaded.decoded)).toBeGreaterThan(0);
    expect(readFactoryDecodedOwnerImportBytes(loaded.decoded)).toBeLessThanOrEqual(
      estimateFactoryV1OwnerImportBytes(null, Object.keys(core)));
    expect(() => assertFactoryStoredDecodedCheckpoint(loaded.decoded)).not.toThrow();
    expect(() => assertFactoryDecodedOwner(loaded.decoded, loaded.owner)).not.toThrow();
    expect(() => assertFactoryDecodedOwner(loaded.decoded, { ...loaded.owner })).toThrow(/not bound/);
    expect(() => assertFactoryStoredDecodedCheckpoint({ ...loaded.decoded } as typeof loaded.decoded)).toThrow(/Unvalidated Factory restore candidate/);
    expect(() => assertFactoryStoredDecodedCheckpoint(loaded as unknown as typeof loaded.decoded)).toThrow(/Unvalidated Factory restore candidate/);
    expect(written.envelope.gameVersion).toBe("hestia-factory-play-v1");
    await expect(store.save(artifact, null)).rejects.toMatchObject({ code: "SlotAlreadyExists" });
    await expect(store.save(artifact, 99)).rejects.toMatchObject({ code: "RevisionConflict" });
    const slotsBeforeRejectedLoad = await store.list();
    await expect(store.load(FACTORY_SAVE_CPU_BYTES)).rejects.toThrow("Factory checkpoint CPU/decode budget before allocation");
    expect(await store.list()).toEqual(slotsBeforeRejectedLoad);
    const stillLoadedV1 = await store.load();
    expect(stillLoadedV1.metadata).toEqual(loaded.metadata);
    expect(stillLoadedV1.decoded.checkpoint).toEqual(artifact);
  } finally { await store.close(); }
});

it("writes compact V2 while keeping the fully issued V1 load readable", async () => {
  const repository = createMemorySaveRepository([]), store = createFactorySaveStore(repository);
  await store.initialize();
  try {
    const historical = withHistoricalDryStep(artifact);
    const loadedV1 = await store.save(historical, null).then(() => store.load());
    expect(loadedV1.owner.domain.lastStep).not.toBeNull();
    expect(dryFactorySlice.materializeDryFactoryStateV1(loadedV1.owner.domain, () => undefined)).toEqual(historical.factory.domain);
    const compact = encodeFactoryCheckpointV2({ host: historical.host, native: historical.native, nativeFactory: historical.nativeFactory,
      factory: loadedV1.owner });
    expect(compact.version).toBe("fp06-combined-checkpoint-v2");
    expect(compact.profiles).toEqual(FACTORY_COMBINED_SAVE_V2_PROFILES);
    expect(compact.factory.version).toBe("fp06-factory-session-owner-v2");
    expect(() => decodeFactoryCheckpoint(compact)).toThrow(/Unsupported combined Factory checkpoint profile/);
    const decoded = decodeStoredFactoryCheckpoint(JSON.parse(JSON.stringify(compact)));
    expect(decoded.checkpoint).toEqual(compact);
    expect(() => assertFactoryDecodedOwner(decoded, { ...compact.factory })).toThrow(/not bound/);
    const { signature: _signature, ...unsigned } = compact;
    const wrongEpoch = { ...unsigned, factory: { ...compact.factory, domain: { ...compact.factory.domain,
      binding: { ...compact.factory.domain.binding, epoch: compact.factory.domain.binding.epoch + 1 } } } };
    expect(() => decodeStoredFactoryCheckpoint({ ...wrongEpoch, signature: createPersistenceSignature(wrongEpoch) }))
      .toThrow(/logical session\/cursor/i);
    const written = await store.save(compact, 1), loadedV2 = await store.load();
    expect(written.metadata.recordRevision).toBe(2);
    expect(loadedV2.decoded.checkpoint.version).toBe("fp06-combined-checkpoint-v2");
    expect(loadedV2.owner).toEqual(compact.factory);
    expect(readFactoryDecodedOwnerImportBytes(loadedV2.decoded)).toBe(0);
    expect(() => assertFactoryDecodedOwner(loadedV2.decoded, loadedV2.owner)).not.toThrow();
    const slotsBeforeRejectedLoad = await store.list();
    await expect(store.load(FACTORY_SAVE_CPU_BYTES)).rejects.toThrow("Factory checkpoint CPU/decode budget before allocation");
    expect(await store.list()).toEqual(slotsBeforeRejectedLoad);
    const stillLoadedV2 = await store.load();
    expect(stillLoadedV2.metadata).toEqual(loadedV2.metadata);
    expect(stillLoadedV2.owner).toEqual(loadedV2.owner);
  } finally { await store.close(); }
}, 15_000);

const carrierCheckpoint = (phase: "Carrying" | "Deposited", profileId: "B06-BOM" | "CABLE8500", base: FactoryCombinedCheckpointV1 = artifact) => {
  const materialView = decodeFactoryCheckpoint(base).material, profile = readCargoHandlingProfile(fixture.catalog, profileId)!;
  const containerId = "carrier_saved";
  const definition = createResourceContainerDefinition({ containerId, kind: "ShipCargo", maxMassKg: profile.massMg / 1_000_000 + 1,
    maxVolumeM3: profile.capacityMm3 / 1_000_000_000 + 1, maxStackCount: 64 });
  const empty = createResourceContainerSnapshot(definition,
    createResourceContainerState({ containerId, ownerId: fixture.resourceState.ownerId, contents: [] }, fixture.catalog.resources), fixture.catalog.resources);
  const withEmpty = { ...materialView, containers: [...materialView.containers, empty] };
  const moves = [] as import("../../../src/factory/material/reservations").MaterialMove[];
  for (const term of profile.terms) {
    const item = fixture.catalog.items.find(value => value.sourceId === term.itemId)!; let remaining = term.quantityUnits;
    for (const stack of materialView.containers.find(value => value.state.containerId === fixture.resourceState.containerId)!.state.contents) {
      if (stack.resourceId !== item.resourceId || remaining === 0) continue;
      const quantityUnits = Math.min(remaining, stack.quantity);
      moves.push({ sourceContainerId: fixture.resourceState.containerId, sourceStackId: stack.stackId, targetContainerId: containerId,
        targetStackId: `carrier_saved_part_${moves.length}`, itemId: term.itemId, quantityUnits });
      remaining -= quantityUnits;
    }
    if (remaining !== 0) throw new Error(`Fixture lacks ${term.itemId} for ${profileId}`);
  }
  const plan = prepareFactoryMaterialStep(withEmpty, { kind: "transfer", transactionId: "carrier_saved_tx", ownerId: fixture.resourceState.ownerId!,
    actorId: "hvp_player", moves });
  if (plan.status !== "Prepared") throw new Error(plan.reason);
  const committed = commitFactoryMaterialStep(withEmpty, plan);
  if (committed.status !== "Committed") throw new Error(committed.status === "Rejected" ? committed.reason : "Unexpected carrier replay");
  const { version: _version, profiles: _profiles, signature: _signature, ...body } = base;
  const input: FactoryCombinedCheckpointInput = {
    ...body,
    nativeFactory: { ...body.nativeFactory, revision: 1, carrier: { ownerId: "factory_carrier", transactionId: "carrier_saved_tx", profileId,
      profileDigest: profile.digest, phase, massMg: profile.massMg, materialBinding: factoryMaterialBytes(committed.view), containerId,
      positionMm: [-5500.125, 1500.375, 13125.25], physicalRotation: { x: 0, y: Math.fround(Math.SQRT1_2), z: 0, w: Math.fround(Math.SQRT1_2) },
      physicalBodyPhase: phase === "Carrying" ? "KinematicPositionBased" : "Fixed" }, completedTransactionIds: ["carrier_saved_tx"] },
    factory: { ...body.factory, material: { version: "fp06-material-owner-v1", catalogDigest: committed.view.catalog.catalogDigest,
      revision: committed.view.revision, containers: committed.view.containers.map(c => ({ definition: c.definition, state: c.state })),
      reservations: committed.view.reservations, receipts: committed.view.receipts } }
  };
  return encodeFactoryCheckpoint(input);
};

const withHistoricalDryStep = (base: FactoryCombinedCheckpointV1): FactoryCombinedCheckpointV1 => {
  const decoded = decodeFactoryCheckpoint(base), domain = decoded.checkpoint.factory.domain, material = decoded.material;
  const tickEndUs = String(BigInt(domain.tickEndUs) + 100_000n), supply = readDryFactorySupply(domain, material, [], [], tickEndUs);
  const input = { confirmed: true, binding: domain.binding, tickStartUs: domain.tickEndUs, tickEndUs, material, supply, machines: [], belts: [] };
  const proposal = prepareDryFactoryStep(domain, input);
  if (proposal.status !== "Prepared") throw new Error(proposal.reason);
  const committed = commitDryFactoryStep(domain, input, proposal);
  if (committed.status !== "Committed") throw new Error(committed.status === "Rejected" ? committed.reason : "Unexpected dry-step replay");
  const { version: _version, profiles: _profiles, signature: _signature, ...body } = base;
  return encodeFactoryCheckpoint({ ...body, host: { ...body.host, steps: 1 },
    factory: { ...body.factory, domain: committed.state, lastPower: proposal.power } });
};

const paidW09Checkpoint = (): FactoryCombinedCheckpointV1 => {
  const base = decodeFactoryCheckpoint(artifact).checkpoint, ownerId = fixture.resourceState.ownerId!;
  let material: MaterialView = decodeFactoryCheckpoint(artifact).material, state = base.factory.domain;
  const installations: FactoryInstallation[] = [], nativeOwners: FactoryNativeOwnerCheckpoint[] = [];
  const items = fixture.catalog.items;
  const payInstallation = (instanceId: string, definitionSourceId: string, centerMm: FactoryInstallation["centerMm"]): FactoryInstallation => {
    const profile = createFactoryInstallationProfile(definitionSourceId), containerId = `installed_${instanceId}`;
    const empty = createResourceContainerSnapshot(createResourceContainerDefinition({ containerId, kind: "OutpostStorage",
      maxMassKg: profile.massMg / 1_000_000, maxVolumeM3: 4, maxStackCount: 200 }),
      createResourceContainerState({ containerId, ownerId, contents: [] }, fixture.catalog.resources), fixture.catalog.resources);
    const augmented = { ...material, containers: [...material.containers, empty] }, moves: MaterialMove[] = [];
    for (const term of profile.bom) {
      const item = items.find(value => value.sourceId === term.itemId)!;
      let remaining = term.quantityUnits;
      for (const stack of material.containers.find(value => value.state.containerId === fixture.resourceState.containerId)!.state.contents) {
        if (stack.resourceId !== item.resourceId || remaining === 0) continue;
        const quantityUnits = Math.min(remaining, stack.quantity);
        moves.push({ sourceContainerId: fixture.resourceState.containerId, sourceStackId: stack.stackId, targetContainerId: containerId,
          targetStackId: `${instanceId}_part_${moves.length}`, itemId: term.itemId, quantityUnits });
        remaining -= quantityUnits;
      }
      if (remaining !== 0) throw new Error(`Fixture lacks paid ${term.itemId} for ${instanceId}`);
    }
    const payment = prepareFactoryMaterialStep(augmented, { kind: "transfer", transactionId: `install_${instanceId}`, ownerId, actorId: "hvp_player", moves });
    if (payment.status !== "Prepared") throw new Error(payment.reason);
    const committed = commitFactoryMaterialStep(augmented, payment);
    if (committed.status !== "Committed") throw new Error(committed.status === "Rejected" ? committed.reason : "Unexpected paid-install replay");
    material = committed.view;
    const installation: FactoryInstallation = { instanceId, definitionSourceId, profileDigest: profile.profileDigest, sourceDigest: profile.sourceDigest,
      massMg: profile.massMg, materialContainerId: containerId, centerMm, quarterTurns: 1,
      boundsMm: transformFactoryBounds(profile.boundsMm, centerMm, 1), serviceBoundsMm: transformFactoryBounds(profile.serviceBoundsMm, centerMm, 1) };
    installations.push(installation);
    const reconciled = reconcileDryFactoryInstallations(state, material, installations);
    state = reconciled.state; material = reconciled.material;
    if (definitionSourceId === "fp06.line.belt_4m") {
      const cutter = installations.find(value => value.instanceId === "cut")!, former = installations.find(value => value.instanceId === "form")!;
      const source = readDryFactoryBeltPort(material.catalog, cutter, "B06:OUT-SEMI", 1), target = readDryFactoryBeltPort(material.catalog, former, "B07:IN-SEMI", 2);
      const adopted = adoptDryFactoryBelt(state, material, installation, source, target);
      state = adopted.state; material = adopted.material;
    }
    nativeOwners.push({ ownerId: instanceId, instanceId, transactionId: `install_${instanceId}`, definitionRef: profile.definitionRef,
      profileDigest: profile.profileDigest, sourceDigest: profile.sourceDigest, massMg: profile.massMg, materialBinding: factoryMaterialBytes(material),
      centerMm, quarterTurns: 1, installationRevision: installations.length });
    return installation;
  };
  payInstallation("cut", "B06", [-6250, 1500, 5000]);
  payInstallation("form", "B07", [-6250, 1500, -2500]);
  payInstallation("line", "fp06.line.belt_4m", [-6250, 1500, 1500]);
  payInstallation("battery", "fp02.device.battery_4kwh", [-2250, 1500, 2500]);

  const powerPortCenter = (owner: FactoryInstallation) => {
    const port = createFactoryInstallationProfile(owner.definitionSourceId).source.ports.find(value => value.role.startsWith("Power"));
    if (!port?.centerM) throw new Error(`Fixture has no power port for ${owner.instanceId}`);
    return transformFactoryPoint(port.centerM.map(value => value * 1000), owner.centerMm, owner.quarterTurns);
  };
  const paidLinks: FactoryPaidPowerLinkV1[] = [];
  const battery = installations.find(value => value.instanceId === "battery")!;
  for (const [commandId, targetId, targetCapacity] of [["battery_cut", "cut", 1_700_000n], ["battery_line", "line", 600_000n]] as const) {
    const target = installations.find(value => value.instanceId === targetId)!, from = powerPortCenter(battery), to = powerPortCenter(target);
    const rawLength = from.reduce((sum, coordinate, index) => sum + Math.abs(to[index]! - coordinate), 0), lengthMm = Math.ceil(rawLength / 250) * 250;
    const routeMm: FactoryPaidPowerLinkV1["routeMm"] = [from, [to[0], from[1], from[2]], [to[0], from[1], to[2]], to];
    const containerId = `installed_cable_${commandId}`, source = material.containers.find(value => value.state.containerId === fixture.resourceState.containerId)!;
    const cableItem = items.find(value => value.sourceId === "fp02.comp.field_cable")!;
    const sourceStack = source.state.contents.find(stack => stack.resourceId === cableItem.resourceId);
    if (!sourceStack) throw new Error("Fixture lacks cable stock");
    const empty = createResourceContainerSnapshot(createResourceContainerDefinition({ containerId, kind: "OutpostStorage", maxMassKg: 100, maxVolumeM3: 1, maxStackCount: 1 }),
      createResourceContainerState({ containerId, ownerId, contents: [] }, fixture.catalog.resources), fixture.catalog.resources);
    const augmented = { ...material, containers: [...material.containers, empty] };
    const payment = prepareFactoryMaterialStep(augmented, { kind: "transfer", transactionId: commandId, ownerId, actorId: "hvp_player",
      moves: [{ sourceContainerId: fixture.resourceState.containerId, sourceStackId: sourceStack.stackId, targetContainerId: containerId,
        targetStackId: `cable_${commandId}`, itemId: "fp02.comp.field_cable", quantityUnits: lengthMm }] });
    if (payment.status !== "Prepared") throw new Error(payment.reason);
    const committed = commitFactoryMaterialStep(augmented, payment);
    if (committed.status !== "Committed") throw new Error(committed.status === "Rejected" ? committed.reason : "Unexpected cable replay");
    material = committed.view;
    const sourceProfile = createFactoryInstallationProfile(battery.definitionSourceId), targetProfile = createFactoryInstallationProfile(target.definitionSourceId);
    paidLinks.push({ version: "fp06-paid-native-cable-v1", linkId: `link_${commandId}`, fromPortId: "power_battery", toPortId: `power_${targetId}`,
      active: true, maxMilliWatt: String(targetCapacity), lengthMm, containerId, routeMm,
      sourceProfileDigest: sourceProfile.profileDigest, targetProfileDigest: targetProfile.profileDigest });
  }

  const commitIntent = (intent: MaterialIntent) => {
    const plan = prepareFactoryMaterialStep(material, intent);
    if (plan.status !== "Prepared") throw new Error(plan.reason);
    const committed = commitFactoryMaterialStep(material, plan);
    if (committed.status !== "Committed") throw new Error(committed.status === "Rejected" ? committed.reason : "Unexpected material replay");
    material = committed.view;
  };
  const cutRecipe = fixture.catalog.recipes.find(recipe => recipe.sourceId === "REC-01-CUT")!;
  const raw = items.find(item => item.sourceId === "fp02.bulk.steel_known")!, cargo = material.containers.find(value => value.state.containerId === fixture.resourceState.containerId)!;
  const rawStack = cargo.state.contents.find(stack => stack.resourceId === raw.resourceId)!;
  commitIntent({ kind: "reserve", transactionId: "seed_cut_reserve", ownerId, actorId: "hvp_player", reservationId: "seed_cut_reservation", wipContainerId: "wip_cut",
    recipeRef: { sourceId: cutRecipe.sourceId, version: cutRecipe.version, digest: cutRecipe.digest },
    moves: [{ sourceContainerId: cargo.state.containerId, sourceStackId: rawStack.stackId, targetContainerId: "wip_cut", targetStackId: "seed_raw",
      itemId: "fp02.bulk.steel_known", quantityUnits: 8_000_000 }],
    outputs: [{ itemId: "fp02.bulk.steel_semi", quantityUnits: 7_500_000, targetContainerId: "output_cut", stackId: "seed_semi" },
      { itemId: "fp02.bulk.steel_offcut", quantityUnits: 500_000, targetContainerId: "offcut_cut", stackId: "seed_offcut" }] });
  commitIntent({ kind: "finish-recipe", transactionId: "seed_cut_finish", ownerId, actorId: "hvp_player", reservationId: "seed_cut_reservation" });
  const semi = items.find(item => item.sourceId === "fp02.bulk.steel_semi")!;
  const output = material.containers.find(value => value.state.containerId === "output_cut")!, semiStack = output.state.contents.find(stack => stack.resourceId === semi.resourceId)!;
  commitIntent({ kind: "transfer", transactionId: "partial_form_input", ownerId, actorId: "hvp_player",
    moves: [{ sourceContainerId: "output_cut", sourceStackId: semiStack.stackId, targetContainerId: "input_form", targetStackId: "waiting_partial",
      itemId: semi.sourceId, quantityUnits: 2_000_000 }] });
  const afterPartial = material.containers.find(value => value.state.containerId === fixture.resourceState.containerId)!;
  const remainingRaw = afterPartial.state.contents.find(stack => stack.resourceId === raw.resourceId)!;
  commitIntent({ kind: "transfer", transactionId: "feed_cut_job", ownerId, actorId: "hvp_player",
    moves: [{ sourceContainerId: afterPartial.state.containerId, sourceStackId: remainingRaw.stackId, targetContainerId: "input_cut", targetStackId: "job_raw",
      itemId: raw.sourceId, quantityUnits: 8_000_000 }] });

  const recipeRef = (sourceId: string) => {
    const recipe = fixture.catalog.recipes.find(value => value.sourceId === sourceId)!;
    return { sourceId: recipe.sourceId, version: recipe.version, digest: recipe.digest };
  };
  const cutStart: ProductionStart = { kind: "start", commandId: "w09_cut_start", jobId: "job_w09_cut_start", batchOrdinal: 0, ownerId, actorId: "hvp_player",
    recipeRef: recipeRef("REC-01-CUT"), processKind: "electric", sourceLots: [{ itemId: "fp02.bulk.steel_known", containerId: "input_cut", stackId: "job_raw" }] };
  const formStart: ProductionStart = { kind: "start", commandId: "w09_form_wait", jobId: "job_w09_form_wait", batchOrdinal: 0, ownerId, actorId: "hvp_player",
    recipeRef: recipeRef("REC-02-PROFILE"), processKind: "electric", sourceLots: [{ itemId: "fp02.bulk.steel_semi", containerId: "input_form", stackId: "waiting_partial" }] };
  let lastPower: FactoryPowerSuccess | null = null;
  const step = (commands: ReadonlyMap<string, ProductionStart>) => {
    const tickEndUs = String(BigInt(state.tickEndUs) + 100_000n), supply = readDryFactorySupply(state, material, installations, paidLinks, tickEndUs);
    const machines = state.machines.map(machine => {
      const installation = installations.find(value => value.instanceId === machine.machineInstanceId)!;
      const definition = fixture.catalog.devices.find(value => value.sourceId === installation.definitionSourceId)!;
      const toolId = definition.sourceId === "B06" ? "fp02.tool.cutter_head" : "fp02.tool.forming_die";
      const paid = material.containers.find(value => value.state.containerId === installation.materialContainerId)!;
      const tool = paid.state.contents.find(stack => stack.resourceId === items.find(item => item.sourceId === toolId)!.resourceId)!;
      const facts = { version: "fp06-production-host-facts-v1" as const, binding: state.binding, confirmed: true, tickEndUs,
        installation: { instanceId: installation.instanceId, definitionRef: { sourceId: definition.sourceId, version: definition.version, digest: definition.digest },
          installationRevision: nativeOwners.find(owner => owner.instanceId === installation.instanceId)!.installationRevision, confirmed: true, supported: true,
          serviceClear: true, installedContainerId: installation.materialContainerId, inputContainerId: `input_${installation.instanceId}`,
          outputContainerId: `output_${installation.instanceId}`, offcutContainerId: `offcut_${installation.instanceId}`, wipContainerId: `wip_${installation.instanceId}`,
          powerConsumerId: `consumer_${installation.instanceId}`, powerPortId: `power_${installation.instanceId}`,
          tool: { partId: tool.stackId, sourceItemId: toolId, revision: paid.state.revision, condition: "OK" as const } },
        interaction: { actorId: "hvp_player", actorRevision: 0, confirmed: true, serviceReachable: true,
          accessibleContainers: material.containers.map(container => ({ containerId: container.state.containerId, revision: container.state.revision })) } };
      const command = commands.get(machine.machineInstanceId);
      return { instanceId: machine.machineInstanceId, facts, ...(command ? { command } : {}) };
    });
    const line = state.belts[0]!, sourceContainer = material.containers.find(value => value.state.containerId === line.installation.source.containerId)!;
    const sourceStack = sourceContainer.state.contents[0], sourceItem = sourceStack && items.find(item => item.resourceId === sourceStack.resourceId);
    const input = { confirmed: true, binding: state.binding, tickStartUs: state.tickEndUs, tickEndUs, material, supply, machines,
      belts: [{ lineId: line.lineId, actorId: "hvp_player", enabled: true,
        sourceLot: sourceStack && sourceItem ? { stackId: sourceStack.stackId, itemId: sourceItem.sourceId } : null }] };
    const proposal = prepareDryFactoryStep(state, input);
    if (proposal.status !== "Prepared") throw new Error(proposal.reason);
    const committed = commitDryFactoryStep(state, input, proposal);
    if (committed.status !== "Committed") throw new Error(committed.status === "Rejected" ? committed.reason : "Unexpected dry-step replay");
    state = committed.state; material = committed.material; lastPower = proposal.power;
  };
  const bindingForUi = (): FactoryUiBinding => ({ catalogDigest: fixture.catalog.catalogDigest, terrainSourceDigest: base.native.terrain.sourceDigest,
    powerSourceProfileDigest: FACTORY_POWER_POLICY.sourceObservationVersion, terrainRevision: base.native.terrain.revision,
    facilityRevision: installations.length, materialRevision: material.revision, netRevision: state.binding.netRevision, handlingRevision: installations.length });
  const cutUi: FactoryUiCommand = { version: "fp06-ui-command-v1", commandId: cutStart.commandId, sessionId: base.host.sessionId, epoch: base.host.epoch,
    expected: bindingForUi(), kind: "start", machine: { id: "cut", revision: 0 }, sourceLots: [{ containerId: "input_cut",
      containerRevision: material.containers.find(value => value.state.containerId === "input_cut")!.state.revision, stackId: "job_raw", quantityUnits: 8_000_000 }] };
  step(new Map([["cut", cutStart]]));
  const formUi: FactoryUiCommand = { version: "fp06-ui-command-v1", commandId: formStart.commandId, sessionId: base.host.sessionId, epoch: base.host.epoch,
    expected: bindingForUi(), kind: "start", machine: { id: "form", revision: state.machines.find(machine => machine.machineInstanceId === "form")!.revision },
    sourceLots: [{ containerId: "input_form", containerRevision: material.containers.find(value => value.state.containerId === "input_form")!.state.revision,
      stackId: "waiting_partial", quantityUnits: 7_500_000 }] };
  step(new Map([["form", formStart]]));
  for (let tick = 2; tick < 56; tick++) step(new Map([["form", formStart]]));
  const receipt = (command: FactoryUiCommand, publicationRevision: number): FactoryUiReceipt => ({ commandId: command.commandId, requestCanonicalJson: canonicalJson(command),
    status: "Committed", reason: null, publicationRevision, binding: command.expected });
  const commandReceipts = [receipt(cutUi, 1), receipt(formUi, 2)];
  const nativeFactory = { ...base.nativeFactory, revision: installations.length,
    cargo: { ...base.nativeFactory.cargo, opened: true, openReceipt: { ownerId, profileDigest: base.nativeFactory.cargo.profileDigest,
      expectedTerrainRevision: base.native.terrain.revision, expectedRevision: 0 } }, owners: nativeOwners,
    completedTransactionIds: nativeOwners.map(owner => owner.transactionId) };
  const factory = { ...base.factory, installations, material: { version: "fp06-material-owner-v1" as const, catalogDigest: material.catalog.catalogDigest,
    revision: material.revision, containers: material.containers.map(container => ({ definition: container.definition, state: container.state })),
    reservations: material.reservations, receipts: material.receipts }, domain: state, lastPower, links: paidLinks,
    waitingStarts: [{ instanceId: "form", command: formStart }], commandReceipts, lastReceipt: commandReceipts[1]!, publicationRevision: 2 };
  const { version: _version, profiles: _profiles, signature: _signature, ...body } = base;
  const checkpointInput = { ...body, host: { ...body.host, steps: 56 }, nativeFactory, factory };
  const unsigned = { version: "fp06-combined-checkpoint-v1" as const, profiles: FACTORY_COMBINED_SAVE_PROFILES, ...checkpointInput };
  return { ...unsigned, signature: createPersistenceSignature(unsigned) };
};

const replacePaidPowerSupplyLinks = (checkpoint: FactoryCombinedCheckpointV1, links: readonly unknown[]): FactoryCombinedCheckpointV1 => {
  const receipt = checkpoint.factory.lastPower;
  if (!receipt) throw new Error("Paid W09 fixture lacks its power receipt");
  const originalSupply = JSON.parse(receipt.supplyCanonicalJson) as Record<string, unknown>;
  const nextSupply = { ...originalSupply, links };
  const { canonicalJson: _receiptBytes, digest: _receiptDigest, ...receiptPayload } = receipt;
  const nextReceiptPayload = { ...receiptPayload, supplyCanonicalJson: canonicalJson(nextSupply) };
  const lastPower = { ...nextReceiptPayload, canonicalJson: canonicalJson(nextReceiptPayload), digest: canonicalSignature(nextReceiptPayload) };
  const next = { ...checkpoint, factory: { ...checkpoint.factory, lastPower } };
  const { signature: _signature, ...unsigned } = next;
  return { ...unsigned, signature: createPersistenceSignature(unsigned) };
};

const replaceOuterPaidPowerLinks = (checkpoint: FactoryCombinedCheckpointV1, links: readonly FactoryPaidPowerLinkV1[]): FactoryCombinedCheckpointV1 => {
  const next = { ...checkpoint, factory: { ...checkpoint.factory, links } };
  const { signature: _signature, ...unsigned } = next;
  return { ...unsigned, signature: createPersistenceSignature(unsigned) };
};

it("retains historical container membership after a later real carrier transfer appends a container", () => {
  const stepped = withHistoricalDryStep(artifact), checkpoint = carrierCheckpoint("Carrying", "B06-BOM", stepped), decoded = decodeFactoryCheckpoint(checkpoint);
  expect(decoded.checkpoint.factory.domain.lastStep?.materialBytes).not.toBe(factoryMaterialBytes(decoded.material));
  expect(decoded.material.containers.map(container => container.state.containerId)).toEqual(checkpoint.factory.material.containers.map(container => container.state.containerId));
  expect(decoded.checkpoint.nativeFactory.carrier).toMatchObject({ ownerId: "factory_carrier", containerId: "carrier_saved" });
});

describe("paid W09 combined checkpoint", () => {
  let w09: FactoryCombinedCheckpointV1 | undefined;
  let producerW09: FactoryCombinedCheckpointV1 | undefined;
  let paidDecoded: ReturnType<typeof decodeFactoryCheckpoint> | undefined;
  let paidStoredV2: ReturnType<typeof decodeStoredFactoryCheckpoint> | undefined;
  let producerV1Decoded: ReturnType<typeof decodeFactoryCheckpoint> | undefined;
  let producerV1Encoded: FactoryCombinedCheckpointV1 | undefined;
  let producerStoredV1: ReturnType<typeof decodeStoredFactoryCheckpoint> | undefined;
  let producerV2Encoded: ReturnType<typeof encodeFactoryCheckpointV2> | undefined;
  let producerStoredV2: ReturnType<typeof decodeStoredFactoryCheckpoint> | undefined;
  const paidCheckpoint = (): FactoryCombinedCheckpointV1 => {
    if (!w09) throw new Error("Paid W09 fixture setup did not complete");
    return w09;
  };
  const paidW09Decoded = () => {
    if (!paidDecoded) throw new Error("Paid W09 decode setup did not complete");
    return paidDecoded;
  };
  const paidProducerCheckpoint = () => {
    if (!producerW09) throw new Error("Paid W09 producer fixture setup did not complete");
    return producerW09;
  };
  beforeAll(() => {
    const started = performance.now();
    producerW09 = paidW09Checkpoint();
    const legacyLinks = producerW09.factory.links.map(link => ({ linkId: link.linkId, fromPortId: link.fromPortId, toPortId: link.toPortId,
      active: link.active, maxMilliWatt: link.maxMilliWatt }));
    const legacy = replacePaidPowerSupplyLinks(producerW09, legacyLinks), { version: _version, profiles: _profiles, signature: _signature, ...legacyInput } = legacy;
    w09 = encodeFactoryCheckpoint(legacyInput);
    console.info(`[factoryCheckpoint] paid W09 fixture setup ${(performance.now() - started).toFixed(0)} ms`);
  });
  beforeAll(() => {
    const started = performance.now();
    paidDecoded = decodeFactoryCheckpoint(paidCheckpoint());
    console.info(`[factoryCheckpoint] paid W09 decode setup ${(performance.now() - started).toFixed(0)} ms`);
  });
  beforeAll(() => {
    const started=performance.now(),storedV1=decodeStoredFactoryCheckpoint(JSON.parse(JSON.stringify(paidCheckpoint()))),owner=readFactoryDecodedOwner(storedV1);
    const compact=encodeFactoryCheckpointV2({host:storedV1.checkpoint.host,native:storedV1.checkpoint.native,
      nativeFactory:storedV1.checkpoint.nativeFactory,factory:owner});
    paidStoredV2=decodeStoredFactoryCheckpoint(JSON.parse(JSON.stringify(compact)));
    console.info(`[factoryCheckpoint] paid WIP compact V2 setup ${(performance.now()-started).toFixed(0)} ms`);
  });
  beforeAll(() => {
    const started = performance.now(), producer = paidProducerCheckpoint();
    producerV1Decoded = decodeFactoryCheckpoint(JSON.parse(JSON.stringify(producer)));
    producerV1Encoded = encodeFactoryCheckpoint({ host: producerV1Decoded.checkpoint.host, native: producerV1Decoded.checkpoint.native,
      nativeFactory: producerV1Decoded.checkpoint.nativeFactory, factory: producerV1Decoded.checkpoint.factory });
    producerStoredV1 = decodeStoredFactoryCheckpoint(JSON.parse(JSON.stringify(producerV1Encoded)));
    console.info(`[factoryCheckpoint] full paid-link V1 setup ${(performance.now() - started).toFixed(0)} ms`);
  });
  beforeAll(() => {
    const started = performance.now(), storedV1 = producerStoredV1!;
    const owner = readFactoryDecodedOwner(storedV1);
    producerV2Encoded = encodeFactoryCheckpointV2({ host: storedV1.checkpoint.host, native: storedV1.checkpoint.native,
      nativeFactory: storedV1.checkpoint.nativeFactory, factory: owner });
    producerStoredV2 = decodeStoredFactoryCheckpoint(JSON.parse(JSON.stringify(producerV2Encoded)));
    console.info(`[factoryCheckpoint] full paid-link V2 setup ${(performance.now() - started).toFixed(0)} ms`);
  });

  it("rejects high-node cold DTOs before invoking structuredClone", () => {
    const checkpoint = paidCheckpoint();
    const commandReceipts = Array.from({ length: 390_000 }, () => ({}));
    const oversized = { ...checkpoint, factory: { ...checkpoint.factory, commandReceipts } } as unknown as FactoryCombinedCheckpointV1;
    const clone = vi.spyOn(globalThis, "structuredClone");
    try {
      expect(() => decodeFactoryCheckpoint(oversized)).toThrow("Factory checkpoint CPU/decode budget before allocation");
      expect(clone).not.toHaveBeenCalled();
    } finally { clone.mockRestore(); }
  });

  it("reserves runtime caches, the FrameProjection reference, and Factory logical camera before V2 cloning", () => {
    const compact=producerV2Encoded;
    if(!compact)throw new Error("Paid W09 V2 fixture setup did not complete");
    const decoded = decodeFactoryCheckpointV2(compact);
    const tree = inspectFactoryCheckpointTree(createFactorySaveEnvelopeInput(compact));
    const frameProjectionReferenceReserveBytes=1024;
    const logicalCameraReserveBytes=16*1024;
    const runtimeReserveBytes=FACTORY_RUNTIME_INSTALLATION_PROFILE_CACHE_RESERVE_BYTES+frameProjectionReferenceReserveBytes+logicalCameraReserveBytes;
    const unitsFor = (objects: number, nodes: number) => 64 * (objects + tree.arrayCount) + 16 * Math.max(0, nodes - 1);
    const workingFor = (jsonUtf8Bytes: number) => Math.max(decoded.decodeWorkingBytes + 3 * jsonUtf8Bytes,
      5 * jsonUtf8Bytes + FACTORY_SAVE_TRANSPORT_BYTES);
    const baseUnits = unitsFor(tree.objectCount, tree.nodeCount);
    const baseCpu = tree.utf16Bytes + 8 * baseUnits + workingFor(tree.jsonUtf8Bytes);
    expect(baseCpu).toBe(decoded.cpuWorkingBytes);
    const arrayIndexUtf16Bytes = (count: number) => {
      let chars = 0;
      for (let digits = 1, start = 0; start < count; digits++) {
        const end = Math.min(count, 10 ** digits);
        chars += (end - start) * digits;
        start = end;
      }
      return chars * 2;
    };
    const cpuFor = (count: number) => {
      const addedJsonBytes = count === 0 ? 0 : 3 * count - 1;
      return tree.utf16Bytes + arrayIndexUtf16Bytes(count) + 8 * unitsFor(tree.objectCount + count, tree.nodeCount + count)
        + workingFor(tree.jsonUtf8Bytes + addedJsonBytes);
    };
    let low = 1, high = 390_000;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (cpuFor(mid) > FACTORY_SAVE_CPU_BYTES - runtimeReserveBytes) high = mid;
      else low = mid + 1;
    }
    const count = low + 32;
    const candidate = { ...compact, factory: { ...compact.factory, commandReceipts: Array.from({ length: count }, () => ({})) } };
    const candidateTree=inspectFactoryCheckpointTree(createFactorySaveEnvelopeInput(candidate));
    const candidateUnits=64*(candidateTree.objectCount+candidateTree.arrayCount)+16*Math.max(0,candidateTree.nodeCount-1);
    const exactCandidateCpu=candidateTree.utf16Bytes+8*candidateUnits+workingFor(candidateTree.jsonUtf8Bytes);
    expect(exactCandidateCpu).toBeGreaterThan(FACTORY_SAVE_CPU_BYTES-runtimeReserveBytes);
    // The candidate still fits the previous profile and projection reserves, isolating the added 16 KiB camera gate.
    expect(exactCandidateCpu).toBeLessThanOrEqual(FACTORY_SAVE_CPU_BYTES
      - FACTORY_RUNTIME_INSTALLATION_PROFILE_CACHE_RESERVE_BYTES-frameProjectionReferenceReserveBytes);
    const clone = vi.spyOn(globalThis, "structuredClone");
    try {
      expect(() => decodeFactoryCheckpointV2(candidate)).toThrow("Factory checkpoint CPU/decode budget before allocation");
      expect(clone).not.toHaveBeenCalled();
    } finally { clone.mockRestore(); }
  });

  const restoreHostFixture = async (decoded: FactoryDecodedCheckpoint) => {
    const checkpoint=decoded.checkpoint,grid=decoded.native.base,terrain=decoded.native.root.read();
    const restoredPhysics=await createHvpPhysicsSession([...collisionSectors(terrain)],{x:-9,y:8,z:-9},resolveHvpGravity(),undefined,
      undefined,undefined,checkpoint.native.world.sessionId,checkpoint.native.world,"branch",true,checkpoint.nativeFactory.cargo.site,checkpoint.nativeFactory);
    const input = { active: false, activationPending: false, pointerLocked: false, pausePending: false, focusedPanel: null, surface: null, error: null } as const;
    let headerOverride: FactoryHostView | undefined;
    const readFacilities=()=>{
      const facilities=restoredPhysics.read().factoryFacilities;
      if(!facilities)throw new Error("Restored physics session has no Factory Native owners");
      return facilities;
    };
    const readHeader=():FactoryHostView=>{
      const native=restoredPhysics.read(),root=decoded.native.root.read(),facilities=native.factoryFacilities;
      return Object.freeze({sessionId:checkpoint.host.sessionId,epoch:checkpoint.host.epoch,nativeTick:native.ticks,
        physicsStatus:native.status,confirmed:Boolean(facilities&&facilities.state==="Idle"&&["Running","Paused"].includes(native.status)),input,
        terrain:Object.freeze({epoch:root.epoch,revision:root.revision,sourceDigest:root.sourceDigest,baseDigest:root.baseDigest,
          profileVersion:checkpoint.native.profiles.source,cellMeters:root.cellMeters,originMeters:root.originMeters,sizeX:root.sizeX,sizeY:root.sizeY,sizeZ:root.sizeZ})});
    };
    const native={read:readFacilities};
    const header=()=>headerOverride??readHeader();
    let session: Pick<FactorySessionHandle, "isQuiescent"> | undefined, failSubscription = false, constructionDisposals = 0, focusClears = 0;
    const listeners = new Set<(view: FactoryHostView) => void>();
    const noAction = async () => undefined;
    const construction = {
      openCargo: noAction,
      readFacts: () => {const current=header(),player=restoredPhysics.read().player;if(!player)throw new Error("Restored Factory player is unavailable");return ({ binding: { sessionId: current.sessionId, epoch: current.epoch, terrainRevision: current.terrain.revision,
        sourceDigest: current.terrain.sourceDigest, baseDigest: current.terrain.baseDigest, facilityRevision: native.read().revision },
        cargoAccess: native.read().cargo!, actor: { actorId: "hvp_player", ownerId: "fp02_wreck_owner", positionMm: [player.position.x*1000,player.position.y*1000,player.position.z*1000], canBuild: true },
        terrain: { cellMm: grid.cellMeters * 1000, originMm: [grid.originMeters.x * 1000, grid.originMeters.y * 1000, grid.originMeters.z * 1000],
          size: [grid.sizeX,grid.sizeY,grid.sizeZ], readSlot: (x: number, y: number, z: number) => grid.readSlot(x, y, z) } });},
      prepareNative: noAction, commitNative: noAction, publishNative: () => undefined, rollbackNative: noAction, finalizeNative: noAction,
      stageProjection: noAction, publishProjection: () => undefined, rollbackProjection: () => undefined, finalizeProjection: () => undefined,
      projectGhost: () => undefined, dispose: () => { constructionDisposals++; }
    };
    const host: FactoryHostPort = {
      construction, handling: { read: () => native.read(), prepare: async () => native.read(), commit: noAction, publish: () => undefined,
        rollback: noAction, finalize: noAction },
      current: () => restoredPhysics.read().status !== "Disposed", read: () => {const current=header();return session && !session.isQuiescent() ? { ...current, confirmed: false } : current;},
      readTerrainSlot: (x, y, z) => grid.readSlot(x, y, z),
      subscribeConfirmed: listener => { if (failSubscription) throw new Error("InjectedFactorySubscribeFailure"); listeners.add(listener); return () => { listeners.delete(listener); }; },
      pause: async () => {restoredPhysics.pause();return readHeader();}, resume: async () => {restoredPhysics.resume();return readHeader();}, setPanelFocus: panel => { if (panel === null) focusClears++; }
    };
    return { restoredPhysics, native, host, listeners, setSession: (value: Pick<FactorySessionHandle, "isQuiescent"> | undefined) => { session = value; },
      setHeader: (value: FactoryHostView) => { headerOverride = Object.freeze(value); }, publishHeader: () => {headerOverride=undefined;for(const listener of listeners)listener(host.read());}, setFailSubscription: (value: boolean) => { failSubscription = value; },
      get constructionDisposals() { return constructionDisposals; }, get focusClears() { return focusClears; } };
  };

  const assertRestoredGoalBaseline = (session: FactorySessionHandle | FactoryCompactSessionHandle, decodedMaterial: MaterialView, version: "V1" | "V2") => {
    const goalInputs: Parameters<typeof productionGoals.projectFactoryProductionGoals>[0][] = [];
    const project = productionGoals.projectFactoryProductionGoals;
    const spy = vi.spyOn(productionGoals, "projectFactoryProductionGoals").mockImplementation(input => {
      goalInputs.push(input); return project(input);
    });
    const readBytes = (factory: FactorySessionCheckpointV1 | FactorySessionCheckpointV2) =>
      ({ domain: canonicalJson(factory.domain), material: canonicalJson(factory.material), receipts: canonicalJson(factory.commandReceipts),
        wip: canonicalJson(factory.material.containers.find(container => container.state.containerId === "wip_cut")?.state.contents) });
    try {
      const beforeMemory = session.readFactoryCheckpointMemory(), beforeCache = beforeMemory.cacheBreakdown;
      if (!beforeCache) throw new Error("Factory checkpoint cache breakdown missing");
      expect(beforeCache.initialMaterial.included).toBe(true);
      expect(beforeCache.initialMaterial.checkpointDtoBytes).toBeGreaterThan(0);
      const before = readBytes(beforeMemory.factory);
      const actualWip = decodedMaterial.containers.find(container => container.state.containerId === "wip_cut")!.state.contents;
      expect(actualWip.length).toBeGreaterThan(0);
      expect(decodedMaterial.reservations.length).toBeGreaterThan(0);
      expect(decodedMaterial.receipts.length).toBeGreaterThan(0);
      session.readOnboarding();
      session.readOnboarding();
      const input = goalInputs.at(-1);
      if (!input) throw new Error("Restored Goal projector was not called");
      const cargo = createFactoryMaterialView(fixture.catalog, [createResourceContainerSnapshot(createResourceContainerDefinition({
        containerId: fixture.resourceState.containerId, kind: "ShipCargo", maxMassKg: 4000, maxVolumeM3: 30, maxStackCount: 200
      }), fixture.resourceState, fixture.catalog.resources)]);
      expect(input.initialMaterial.revision).toBe(0);
      expect(input.initialMaterial.reservations).toEqual([]);
      expect(input.initialMaterial.receipts).toEqual([]);
      expect(input.initialMaterial.containers).toHaveLength(1);
      expect(input.initialMaterial.containers[0]?.definition).toEqual(cargo.containers[0]?.definition);
      expect(input.initialMaterial.containers[0]?.state.contents).toEqual(fixture.resourceState.contents);
      expect(input.initialMaterial).not.toBe(decodedMaterial);
      expect(input.material).toBe(decodedMaterial);
      expect(canonicalJson(input.material.containers.find(container => container.state.containerId === "wip_cut")?.state.contents)).toBe(canonicalJson(actualWip));
      const afterMemory = session.readFactoryCheckpointMemory(), after = readBytes(afterMemory.factory), afterCache = afterMemory.cacheBreakdown;
      if (!afterCache) throw new Error("Factory checkpoint cache breakdown missing");
      expect(after).toEqual(before);
      console.info(`[factoryCheckpoint] restored ${version} Goal baseline cold-cache ${JSON.stringify({
        beforeBytes: beforeMemory.cacheBytes, afterBytes: afterMemory.cacheBytes, deltaBytes: afterMemory.cacheBytes - beforeMemory.cacheBytes,
        before: beforeCache, after: afterCache
      })}`);
    } finally { spy.mockRestore(); }
  };

  it("round-trips paid WIP, belt packet credit, battery SOC, cable custody, and the first waiting start", () => {
    const checkpoint = paidCheckpoint(), decoded = decodeFactoryCheckpoint(JSON.parse(JSON.stringify(checkpoint)));
    const legacySupply = JSON.parse(checkpoint.factory.lastPower!.supplyCanonicalJson) as { links: readonly unknown[] };
    expect(legacySupply.links).toEqual(checkpoint.factory.links.map(link => ({ linkId: link.linkId, fromPortId: link.fromPortId, toPortId: link.toPortId,
      active: link.active, maxMilliWatt: link.maxMilliWatt })));
    const counts = { objects: 0, arrays: 0, scalars: 0, entries: 0, stringUtf16Bytes: 0 };
    const countTree = (value: unknown): void => {
      if (Array.isArray(value)) { counts.arrays++; counts.entries += value.length; value.forEach(countTree); return; }
      if (value !== null && typeof value === "object") {
        counts.objects++;
        for (const [key, child] of Object.entries(value)) { counts.entries++; counts.stringUtf16Bytes += key.length * 2; countTree(child); }
        return;
      }
      counts.scalars++;
      if (typeof value === "string") counts.stringUtf16Bytes += value.length * 2;
    };
    countTree(checkpoint);
    const branchBytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
    console.info(`[factoryCheckpoint] paid W09 codec counts ${JSON.stringify({
      jsonPayloadUtf8Bytes: new TextEncoder().encode(JSON.stringify(checkpoint)).byteLength,
      canonicalPayloadUtf8Bytes: factoryCheckpointBytes(checkpoint).byteLength, ...counts,
      nativeDecodeWorkingBytes: decoded.decodeWorkingBytes,
      branchJsonUtf8Bytes:{native:branchBytes(checkpoint.native),nativeFactory:branchBytes(checkpoint.nativeFactory),factory:branchBytes(checkpoint.factory),
        domain:branchBytes(checkpoint.factory.domain),material:branchBytes(checkpoint.factory.material),lastPower:branchBytes(checkpoint.factory.lastPower),installations:branchBytes(checkpoint.factory.installations)}
    })}`);
    const cut = decoded.checkpoint.factory.domain.machines.find(machine => machine.machineInstanceId === "cut")!;
    const form = decoded.checkpoint.factory.domain.machines.find(machine => machine.machineInstanceId === "form")!;
    const belt = decoded.checkpoint.factory.domain.belts[0]!;
    const wip = decoded.material.containers.find(container => container.state.containerId === "wip_cut")!.state.contents;
    const battery = decoded.checkpoint.factory.domain.power.battery!.storedEnergy;
    expect(cut.job).toMatchObject({ phase: "RUNNING", start: { commandId: "w09_cut_start", jobId: "job_w09_cut_start", batchOrdinal: 0 } });
    expect(wip).toMatchObject([{ stackId: "job_w09_cut_start_input_0", resourceId: "fp02_bulk_steel_known", quantity: 8_000_000 }]);
    expect(form.status).toBe("WAIT_INPUT");
    expect(belt).toMatchObject({ packetCursor: 1, creditMg: 100_000, packet: { positionMm: 75, itemId: "fp02.bulk.steel_semi" } });
    expect(BigInt(battery.n)).toBeGreaterThan(0n);
    expect(BigInt(battery.n)).toBeLessThan(12_960_000_000n * BigInt(battery.d));
    expect(decoded.checkpoint.factory.links).toHaveLength(2);
    expect(decoded.checkpoint.factory.links.every(link => decoded.material.containers.some(container => container.state.containerId === link.containerId
      && container.state.contents[0]?.quantity === link.lengthMm))).toBe(true);
    expect(decoded.checkpoint.factory.waitingStarts).toMatchObject([{ instanceId: "form", command: { commandId: "w09_form_wait", batchOrdinal: 0,
      sourceLots: [{ itemId: "fp02.bulk.steel_semi", containerId: "input_form", stackId: "waiting_partial" }] } }]);
    expect(decoded.checkpoint.factory.commandReceipts.map(receipt => receipt.commandId)).toEqual(["w09_cut_start", "w09_form_wait"]);
    expect(decoded.checkpoint).toEqual(checkpoint);
  });

  it("labels the completed production state in the Cargo panel", () => {
    expect(factoryReason("COMPLETED")).toBe("Completed");
  });

  it("round-trips the producer's full paid-link supply bytes through V1 and V2", () => {
    const producer = paidProducerCheckpoint(), originalBytes = producer.factory.lastPower!.supplyCanonicalJson;
    const supply = JSON.parse(originalBytes) as { links: unknown[] };
    expect(supply.links).toEqual(producer.factory.links);
    expect(producerV1Decoded!.checkpoint.factory.lastPower?.supplyCanonicalJson).toBe(originalBytes);
    expect(producerV1Encoded!.factory.lastPower?.supplyCanonicalJson).toBe(originalBytes);
    expect(producerStoredV1!.checkpoint.factory.lastPower?.supplyCanonicalJson).toBe(originalBytes);
    expect(producerV2Encoded!.factory.lastPower?.supplyCanonicalJson).toBe(originalBytes);
    expect(producerStoredV2!.checkpoint.factory.lastPower?.supplyCanonicalJson).toBe(originalBytes);
  });

  it("rejects a full paid-link supply with a changed length", () => {
    const producer = paidProducerCheckpoint(), originalSupply = JSON.parse(producer.factory.lastPower!.supplyCanonicalJson) as { links: Record<string, unknown>[] };
    const badLength = originalSupply.links.map((link, index) => index === 0 ? { ...link, lengthMm: Number(link.lengthMm) + 250 } : link);
    expect(() => decodeFactoryCheckpoint(replacePaidPowerSupplyLinks(producer, badLength))).toThrow("Saved power link/paid ledger mismatch");
  });

  it("rejects a full paid-link supply with a changed route", () => {
    const producer = paidProducerCheckpoint(), links = (JSON.parse(producer.factory.lastPower!.supplyCanonicalJson) as { links: Record<string, unknown>[] }).links;
    const firstRoute = links[0]!.routeMm as readonly unknown[][];
    const badRoute = links.map((link, index) => index === 0 ? { ...link, routeMm: [[0, 0, 0], ...firstRoute.slice(1)] } : link);
    expect(() => decodeFactoryCheckpoint(replacePaidPowerSupplyLinks(producer, badRoute))).toThrow("Saved power link/paid ledger mismatch");
  });

  it("rejects unknown fields on a full paid-link supply", () => {
    const producer = paidProducerCheckpoint(), links = (JSON.parse(producer.factory.lastPower!.supplyCanonicalJson) as { links: Record<string, unknown>[] }).links;
    const unknownKey = links.map((link, index) => index === 0 ? { ...link, unrecognized: true } : link);
    expect(() => decodeFactoryCheckpoint(replacePaidPowerSupplyLinks(producer, unknownKey))).toThrow("Saved power link malformed");
  });

  it("rejects a full paid-link supply whose outer paid link is missing", () => {
    const producer = paidProducerCheckpoint();
    expect(() => decodeFactoryCheckpoint(replaceOuterPaidPowerLinks(producer, producer.factory.links.slice(1))))
      .toThrow("Saved power link missing from paid ledger");
  });

  it("seeds the paid W09 owner without replay, checks the live Native bodies, and cleans failed/successful mounts", async () => {
    const checkpoint = paidCheckpoint(), decoded = paidW09Decoded(), hostFixture = await restoreHostFixture(decoded);
    let session: FactorySessionHandle | undefined;
    const validHeader = hostFixture.host.read();
    try {
      hostFixture.setHeader({ ...validHeader, terrain: { ...validHeader.terrain, sizeX: validHeader.terrain.sizeX + 1 } });
      await expect(mountFactorySession(hostFixture.host, fixture.catalog, decoded)).rejects.toThrow(/Host admission mismatch/);
      expect(hostFixture.listeners.size).toBe(0);
      hostFixture.setHeader(validHeader);

      hostFixture.setFailSubscription(true);
      await expect(mountFactorySession(hostFixture.host, fixture.catalog, decoded)).rejects.toThrow("InjectedFactorySubscribeFailure");
      expect(hostFixture.listeners.size).toBe(0);
      expect(hostFixture.constructionDisposals).toBe(1);
      expect(hostFixture.focusClears).toBe(1);

      hostFixture.setFailSubscription(false);
      session = await mountFactorySession(hostFixture.host, fixture.catalog, decoded);
      hostFixture.setSession(session);
      assertRestoredGoalBaseline(session, decoded.material, "V1");
      expect(session.read()).toMatchObject({ sessionId: checkpoint.host.sessionId, epoch: checkpoint.host.epoch,
        nativeTick: checkpoint.host.nativeTick, remainderTicks: checkpoint.host.remainderTicks, steps: checkpoint.host.steps,
        elapsedMs: checkpoint.host.steps * 100, state: "Ready" });
      const native = hostFixture.native.read();
      expect(native.owners).toHaveLength(checkpoint.nativeFactory.owners.length);
      expect(hostFixture.restoredPhysics.read().bodyCount).toBeGreaterThan(checkpoint.native.world.bodies.length);
      for (const owner of native.owners) {
        expect(Number.isFinite(owner.bodyHandle)&&owner.bodyHandle>=0).toBe(true);
        expect(owner.colliderHandles.length).toBeGreaterThan(0);
      }

      const capture = session.beginFactoryCheckpoint((rawFactory, cacheBytes, treeMetrics) => {
        expect(session!.isQuiescent()).toBe(false);
        expect(rawFactory.domain).toBe(decoded.checkpoint.factory.domain);
        const memory = session!.readFactoryCheckpointMemory();
        expect(memory.factory.domain).toBe(rawFactory.domain);
        expect(memory.cacheBytes).toBe(cacheBytes);
        expect(memory.treeMetrics).toEqual(treeMetrics);
        const cacheBreakdown=memory.cacheBreakdown;if(!cacheBreakdown)throw Error("Factory checkpoint cache breakdown missing");
        expect(cacheBreakdown.cachedDomainCanonicalDescendantsBytes+cacheBreakdown.dryFactoryStateBytes+cacheBreakdown.currentExactMaterialBindingsBytes
          +cacheBreakdown.currentProductionMaterialBytes+cacheBreakdown.catalogTreeBytes+cacheBreakdown.goalProjectionMemoBytes+cacheBreakdown.initialMaterial.checkpointDtoBytes
          +cacheBreakdown.initialMaterial.exactMaterialBindingsBytes+cacheBreakdown.initialMaterial.productionMaterialBytes).toBe(cacheBytes);
        expect(session!.isQuiescent()).toBe(false);
        console.info(`[factoryCheckpoint] W09 raw Factory admission ${JSON.stringify({ cacheBytes, cacheBreakdown, ...treeMetrics })}`);
      });
      expect(canonicalJson(capture.factory)).toBe(canonicalJson(checkpoint.factory));
      expect(capture.host).toEqual(checkpoint.host);
      expect(session.isQuiescent()).toBe(false);
      expect(hostFixture.host.read().confirmed).toBe(false);
      capture.assertCurrent();
      capture.release();
      expect(session.isQuiescent()).toBe(true);
      expect(() => session!.beginFactoryCheckpoint(rawFactory => {
        expect(session!.isQuiescent()).toBe(false);
        expect(rawFactory.version).toBe("fp06-factory-session-owner-v1");
        throw new Error("FactoryCheckpointBudgetRejected");
      })).toThrow("FactoryCheckpointBudgetRejected");
      expect(session.isQuiescent()).toBe(true);
      expect(session.canBeginFactoryCheckpoint()).toBe(true);
      await session.dispose();
      session = undefined;
      expect(hostFixture.listeners.size).toBe(0);
      expect(hostFixture.constructionDisposals).toBe(2);
      expect(hostFixture.focusClears).toBe(2);
    } finally {
      if (session) await session.dispose();
      await hostFixture.restoredPhysics.dispose();
    }
  });

  it("keeps the original Goal baseline through compact V2 restore with active WIP", async () => {
    const decodedV1 = paidW09Decoded(), decodedV2 = paidStoredV2;
    if (!decodedV2) throw new Error("Paid WIP compact V2 setup did not complete");
    const ownerV2 = readFactoryDecodedOwner(decodedV2), checkpoint = decodedV2.checkpoint;
    const hostFixture = await restoreHostFixture(decodedV1);
    let session: FactoryCompactSessionHandle | undefined;
    try {
      session = await mountCompactFactorySession(hostFixture.host, fixture.catalog, decodedV2, ownerV2);
      hostFixture.setSession(session);
      assertRestoredGoalBaseline(session, decodedV2.material, "V2");
      expect(session.read()).toMatchObject({ sessionId: checkpoint.host.sessionId, epoch: checkpoint.host.epoch,
        nativeTick: checkpoint.host.nativeTick, steps: checkpoint.host.steps, state: "Ready" });
    } finally {
      if (session) await session.dispose();
      await hostFixture.restoredPhysics.dispose();
    }
  });

  it("rejects Native installation owners that do not match their instance IDs", () => {
    const checkpoint = paidCheckpoint(), { signature: _signature, ...unsigned } = checkpoint;
    const formerOwnerId = unsigned.nativeFactory.owners.find(owner => owner.instanceId === "form")!.ownerId;
    const owners = unsigned.nativeFactory.owners.map(owner => owner.instanceId === "cut" ? { ...owner, ownerId: formerOwnerId } : owner);
    const mismatchedOwner = { ...unsigned, nativeFactory: { ...unsigned.nativeFactory, owners } };
    expect(() => decodeFactoryCheckpoint({ ...mismatchedOwner, signature: createPersistenceSignature(mismatchedOwner) }))
      .toThrow(/Invalid Native installation owner/);
  });

  it("rejects paid belt ports moved 250 mm away from their Native installations", () => {
    const checkpoint = paidCheckpoint(), { signature: _signature, ...unsigned } = checkpoint;
    const belt = checkpoint.factory.domain.belts[0]!;
    const shiftPort = (port: typeof belt.installation.source) => ({ ...port,
      placementCenterMm: [port.placementCenterMm[0] + 250, port.placementCenterMm[1], port.placementCenterMm[2]] as const,
      centerMm: [port.centerMm[0] + 250, port.centerMm[1], port.centerMm[2]] as const });
    const shiftedBelt = { ...belt, installation: { ...belt.installation,
      source: shiftPort(belt.installation.source), target: shiftPort(belt.installation.target) } };
    const movedPorts = { ...unsigned, factory: { ...unsigned.factory,
      domain: { ...unsigned.factory.domain, belts: [shiftedBelt] } } };
    expect(() => decodeFactoryCheckpoint({ ...movedPorts, signature: createPersistenceSignature(movedPorts) }))
      .toThrow(/BeltNativePortPoseMismatch/);
  });

  it("rejects an active WIP reservation after its production job is removed", () => {
    const checkpoint = paidCheckpoint(), { signature: _signature, ...unsigned } = checkpoint;
    const orphanDomain = { ...unsigned.factory.domain,
      machines: unsigned.factory.domain.machines.map(machine => machine.machineInstanceId === "cut"
        ? { ...machine, status: "IDLE" as const, job: null, lastStep: null } : machine), lastStep: null };
    const orphanWip = { ...unsigned, factory: { ...unsigned.factory, domain: orphanDomain } };
    expect(() => decodeFactoryCheckpoint({ ...orphanWip, signature: createPersistenceSignature(orphanWip) }))
      .toThrow(/OrphanProductionReservation/);
  });

  it("rejects Factory steps that exceed the saved Native tick history", () => {
    const checkpoint = paidCheckpoint(), { signature: _signature, ...unsigned } = checkpoint;
    const tooFewNativeTicks = NATIVE_TICKS_PER_FACTORY_STEP * PAID_W09_STEPS - 1;
    const phantomSteps = { ...unsigned, host: { ...unsigned.host, nativeTick: tooFewNativeTicks },
      native: { ...unsigned.native, world: { ...unsigned.native.world,
        tick: { ...unsigned.native.world.tick, ticks: tooFewNativeTicks } } } };
    expect(() => decodeFactoryCheckpoint({ ...phantomSteps, signature: createPersistenceSignature(phantomSteps) }))
      .toThrow(/cursor exceeds Native tick history/);
  });

  describe("saved two-tick remainder", () => {
    let checkpoint:FactoryCombinedCheckpointV1|undefined;
    let decoded:ReturnType<typeof decodeFactoryCheckpoint>|undefined;
    beforeAll(() => {
      const started=performance.now(),base=paidCheckpoint();
      expect(physics.read().ticks).toBe(base.host.nativeTick);
      physics.resume();
      try { physics.advance(1/60); physics.advance(1/60); } finally { physics.pause(); }
      const {version:_version,profiles:_profiles,signature:_signature,...body}=base;
      checkpoint=encodeFactoryCheckpoint({...body,
        host:{...body.host,nativeTick:physics.read().ticks,remainderTicks:2,steps:PAID_W09_STEPS},
        native:{...body.native,world:physics.checkpoint()}});
      expect(checkpoint.factory).toEqual(base.factory);
      expect(checkpoint.host.nativeTick).toBe(base.host.nativeTick+2);
      decoded=decodeFactoryCheckpoint(checkpoint);
      console.info(`[factoryCheckpoint] paid W09 remainder setup and decode ${(performance.now()-started).toFixed(0)} ms`);
    });

    it("restores the saved two-tick remainder and completes one step on four new Native ticks", async () => {
    if(!checkpoint||!decoded)throw new Error("Paid W09 remainder setup did not complete");
    const base=paidCheckpoint(),hostFixture=await restoreHostFixture(decoded);
    expect(checkpoint.host.nativeTick).toBe(base.host.nativeTick+2);
    expect(checkpoint.host.remainderTicks).toBe(2);
    let session:FactorySessionHandle|undefined;
    try{
      session=await mountFactorySession(hostFixture.host,fixture.catalog,decoded);hostFixture.setSession(session);
      expect(session.read()).toMatchObject({nativeTick:checkpoint.host.nativeTick,remainderTicks:2,steps:PAID_W09_STEPS,state:"Ready"});
      expect(hostFixture.host.read().physicsStatus).toBe("Paused");
      const dryCommits:{status:string;reason:string|null}[]=[];
      const commitActual=dryFactorySlice.commitDryFactoryStep;
      const commitSpy=vi.spyOn(dryFactorySlice,"commitDryFactoryStep").mockImplementation((state,input,proposal)=>{
        const result=commitActual(state,input,proposal);
        dryCommits.push({status:result.status,reason:result.status==="Rejected"?result.reason:null});
        return result;
      });
      try{
        hostFixture.restoredPhysics.resume();
        for(let tick=0;tick<4;tick++){
          hostFixture.restoredPhysics.advance(1/60);
          hostFixture.publishHeader();
        }
        hostFixture.restoredPhysics.pause();
        const native=hostFixture.native.read(),factory=session.ui.read();
        const clock=session.read();
        console.info(`[factoryCheckpoint] restored W09 four-tick diagnostic ${JSON.stringify({
          physics:{ticks:hostFixture.restoredPhysics.read().ticks,status:hostFixture.restoredPhysics.read().status},
          session:{state:clock.state,nativeTick:clock.nativeTick,remainderTicks:clock.remainderTicks,steps:clock.steps,elapsedMs:clock.elapsedMs,reason:factory.reason},
          owners:native.owners.map(owner=>owner.instanceId),
          production:native.production?.map(value=>({instanceId:value.instanceId,confirmed:value.confirmed,supported:value.supported,serviceClear:value.serviceClear,sweepClear:value.sweepClear,accessible:value.accessible})),
          solidPorts:native.solidPorts?.map(value=>({instanceId:value.instanceId,sourcePortId:value.sourcePortId,confirmed:value.confirmed,supported:value.supported,serviceClear:value.serviceClear,sweepClear:value.sweepClear,accessible:value.accessible})),
          powerPorts:native.powerPorts?.map(value=>({instanceId:value.instanceId,sourcePortId:value.sourcePortId,role:value.role,confirmed:value.confirmed,accessible:value.accessible})),
          machines:factory.machines.map(value=>({id:value.id,status:value.status,reason:value.reason,confirmedWorkMs:value.confirmedWorkMs})),
          power:{status:factory.power.status,consumers:factory.power.consumers.map(value=>({id:value.id,reason:value.reason,requestedWatts:value.requestedWatts,allocatedWatts:value.allocatedWatts}))},
          lastDryCommits:dryCommits.slice(-4)
        })}`);
        expect(session.read()).toMatchObject({nativeTick:checkpoint.host.nativeTick+4,remainderTicks:0,steps:PAID_W09_STEPS+1,elapsedMs:(PAID_W09_STEPS+1)*100});
      }finally{hostFixture.restoredPhysics.pause();commitSpy.mockRestore();}
    }finally{
      hostFixture.restoredPhysics.pause();if(session)await session.dispose();await hostFixture.restoredPhysics.dispose();
    }
    });
  });
});

it.each([["Carrying", "B06-BOM"], ["Deposited", "CABLE8500"]] as const)("round-trips actual %s carrier pose, uppercase closed profile, and custody", (phase, profileId) => {
  const checkpoint = carrierCheckpoint(phase, profileId), decoded = decodeFactoryCheckpoint(checkpoint);
  expect(decoded.checkpoint.nativeFactory.carrier).toMatchObject({ ownerId: "factory_carrier", phase, profileId, positionMm: [-5500.125, 1500.375, 13125.25],
    physicalRotation: { x: 0, y: Math.fround(Math.SQRT1_2), z: 0, w: Math.fround(Math.SQRT1_2) },
    physicalBodyPhase: phase === "Carrying" ? "KinematicPositionBased" : "Fixed" });
  const { signature: _signature, ...body } = checkpoint;
  const wrongPhase = { ...body, nativeFactory: { ...body.nativeFactory, carrier: { ...body.nativeFactory.carrier!,
    physicalBodyPhase: phase === "Carrying" ? "Fixed" : "KinematicPositionBased" } } };
  expect(() => decodeFactoryCheckpoint({ ...wrongPhase, signature: createPersistenceSignature(wrongPhase) })).toThrow(/carrier/i);
  const wrongRotation = { ...body, nativeFactory: { ...body.nativeFactory, carrier: { ...body.nativeFactory.carrier!, physicalRotation: { x: 0, y: 0, z: 0, w: 1 } } } };
  expect(() => decodeFactoryCheckpoint({ ...wrongRotation, signature: createPersistenceSignature(wrongRotation) })).toThrow(/carrier/i);
  const wrongOwner = { ...body, nativeFactory: { ...body.nativeFactory, carrier: { ...body.nativeFactory.carrier!, ownerId: "fp02_wreck_owner" } } };
  expect(() => decodeFactoryCheckpoint({ ...wrongOwner, signature: createPersistenceSignature(wrongOwner) })).toThrow(/carrier/i);
});
