import { describe, expect, it } from "vitest";
import {
  authorityRevision,
  canonicalAdaptiveJson,
  createAdaptiveBaseFieldDescriptor,
  createAdaptiveBrickKey,
  createAdaptiveEditJournal,
  hashAdaptiveCanonical,
  hashAdaptiveBaseFieldDescriptor,
  isDeepFrozen,
  materializeAdaptiveBrick,
  serializeMaterializedAdaptiveBrick,
  stableAuthorityId,
  validateMaterializedAdaptiveBrick,
  AdaptiveAuthorityError,
  type AdaptiveBaseFieldDescriptor
} from "../../src/voxel/adaptive";

const key = (level = 4) =>
  createAdaptiveBrickKey({ bodyId: "planet.test", surfaceFrameId: "frame.surface", regionId: "region.test", generatorVersion: "generator.v1", level, originQuantum: { x: 0, y: 0, z: 0 } });

const base = (identity = "base.a", density = 0, version = "generator.v1", sourceRevision = 7): AdaptiveBaseFieldDescriptor => createAdaptiveBaseFieldDescriptor({
  kind: "constant-v1",
  identity: stableAuthorityId(identity),
  version: stableAuthorityId(version),
  sourceRevision: authorityRevision(sourceRevision),
  sample: {
    density,
    occupancy: 1,
    materialId: stableAuthorityId("material.stone"),
    semanticId: stableAuthorityId("semantic.surface")
  }
});

const journal = () =>
  createAdaptiveEditJournal([
    {
      editId: "edit.cut",
      sequence: 1,
      expectedRegionRevision: 0,
      resultRegionRevision: 1,
      actorId: "actor.test",
      sourceId: "tool.test",
      operation: "SubtractSphere",
      sphere: { center: { x: 8, y: 8, z: 8 }, radiusQuantum: 3 }
    },
    {
      editId: "edit.material",
      sequence: 2,
      expectedRegionRevision: 1,
      resultRegionRevision: 2,
      actorId: "actor.test",
      sourceId: "tool.test",
      operation: "SetMaterialBox",
      box: { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 4, z: 4 } },
      materialId: "material.metal"
    }
  ]);

describe("adaptive microvoxel materialization obligations 10-12", () => {
  it("[10] materializes byte-stable authority independently of operational A-B-A history", () => {
    const authoritativeKey = key();
    const edits = journal();
    const firstA = materializeAdaptiveBrick({ key: authoritativeKey, baseField: base(), editJournal: edits });
    const unrelatedB = materializeAdaptiveBrick({ key: key(3), baseField: base("base.b", 0.5), editJournal: createAdaptiveEditJournal([]) });
    const secondA = materializeAdaptiveBrick({ key: authoritativeKey, baseField: base(), editJournal: edits });
    expect(unrelatedB.contentHash).not.toBe(firstA.contentHash);
    expect(serializeMaterializedAdaptiveBrick(secondA)).toBe(serializeMaterializedAdaptiveBrick(firstA));
    expect(secondA.contentHash).toBe(firstA.contentHash);
    expect(secondA.provenance.provenanceHash).toBe(firstA.provenance.provenanceHash);
    expect(Object.isFrozen(secondA)).toBe(true);
    expect(Object.isFrozen(secondA.density)).toBe(true);
    expect(Object.isFrozen(secondA.provenance)).toBe(true);
  });

  it("[11] uses an explicit deterministic content hash that changes with base, level, or journal authority", () => {
    const first = materializeAdaptiveBrick({ key: key(), baseField: base(), editJournal: journal() });
    const same = materializeAdaptiveBrick({ key: key(), baseField: base(), editJournal: journal() });
    const changedBase = materializeAdaptiveBrick({ key: key(), baseField: base("base.a", 0.125), editJournal: journal() });
    const changedLevel = materializeAdaptiveBrick({ key: key(3), baseField: base(), editJournal: journal() });
    const changedJournal = materializeAdaptiveBrick({ key: key(), baseField: base(), editJournal: createAdaptiveEditJournal([]) });
    expect(first.contentHash).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
    expect(same.contentHash).toBe(first.contentHash);
    expect(new Set([first.contentHash, changedBase.contentHash, changedLevel.contentHash, changedJournal.contentHash]).size).toBe(4);
  });

  it("binds descriptor digest, content, and provenance to every descriptor authority field", () => {
    const empty = createAdaptiveEditJournal([]);
    const neutral = createAdaptiveEditJournal([{
      editId: "edit.outside",
      sequence: 1,
      expectedRegionRevision: 0,
      resultRegionRevision: 1,
      actorId: "actor.test",
      sourceId: "tool.test",
      operation: "SubtractBox",
      box: { min: { x: 1_000, y: 1_000, z: 1_000 }, max: { x: 1_001, y: 1_001, z: 1_001 } }
    }]);
    const original = materializeAdaptiveBrick({ key: key(), baseField: base(), editJournal: empty });
    const changedIdentity = materializeAdaptiveBrick({ key: key(), baseField: base("base.b"), editJournal: empty });
    const changedVersion = materializeAdaptiveBrick({ key: key(), baseField: base("base.a", 0, "generator.v2"), editJournal: empty });
    const changedRevision = materializeAdaptiveBrick({ key: key(), baseField: base("base.a", 0, "generator.v1", 8), editJournal: empty });
    const changedSample = materializeAdaptiveBrick({ key: key(), baseField: base("base.a", 0.25), editJournal: empty });
    const neutralJournal = materializeAdaptiveBrick({ key: key(), baseField: base(), editJournal: neutral });
    expect(changedIdentity.density).toEqual(original.density);
    expect(changedVersion.density).toEqual(original.density);
    expect(changedRevision.density).toEqual(original.density);
    expect(neutralJournal.density).toEqual(original.density);
    expect(new Set([
      original.baseFieldDescriptorDigest,
      changedIdentity.baseFieldDescriptorDigest,
      changedVersion.baseFieldDescriptorDigest,
      changedRevision.baseFieldDescriptorDigest,
      changedSample.baseFieldDescriptorDigest
    ]).size).toBe(5);
    expect(new Set([original.contentHash, changedIdentity.contentHash, changedVersion.contentHash, changedRevision.contentHash, changedSample.contentHash, neutralJournal.contentHash]).size).toBe(6);
    expect(original.provenance.baseFieldDescriptorDigest).toBe(hashAdaptiveBaseFieldDescriptor(base()));
    expect(new Set([original.provenance.provenanceHash, changedIdentity.provenance.provenanceHash, changedVersion.provenance.provenanceHash, changedRevision.provenance.provenanceHash, changedSample.provenance.provenanceHash]).size).toBe(5);
  });

  it("rejects independently relabelled provenance and every embedded authority field", () => {
    const brick = materializeAdaptiveBrick({ key: key(3), baseField: base(), editJournal: journal() });
    const fields = [
      ["baseFieldIdentity", "base.other"],
      ["baseFieldVersion", "generator.v2"],
      ["baseFieldDescriptorDigest", hashAdaptiveCanonical({ different: "descriptor" })],
      ["sourceRevision", 8],
      ["editRevision", 3],
      ["journalDigest", hashAdaptiveCanonical({ different: "journal" })],
      ["hierarchyKeyHash", hashAdaptiveCanonical({ different: "key" })],
      ["parentProvenanceHash", hashAdaptiveCanonical({ different: "parent" })],
      ["provenanceHash", hashAdaptiveCanonical({ relabelled: true })]
    ] as const;
    for (const [field, value] of fields) {
      expect(() => validateMaterializedAdaptiveBrick({ ...brick, provenance: { ...brick.provenance, [field]: value } } as typeof brick)).toThrow(AdaptiveAuthorityError);
    }

    const relabelledPayload = {
      ...brick.provenance,
      baseFieldIdentity: stableAuthorityId("base.other")
    };
    const { provenanceHash: _oldHash, ...withoutHash } = relabelledPayload;
    const relabelled = { ...withoutHash, provenanceHash: hashAdaptiveCanonical(withoutHash) };
    expect(() => validateMaterializedAdaptiveBrick({ ...brick, provenance: relabelled } as typeof brick)).toThrow(AdaptiveAuthorityError);
    expect(() => validateMaterializedAdaptiveBrick({ ...brick, contentHash: hashAdaptiveCanonical({ relabelled: true }) })).toThrow(AdaptiveAuthorityError);

    const root = materializeAdaptiveBrick({ key: key(0), baseField: base(), editJournal: createAdaptiveEditJournal([]) });
    expect(root.provenance.parentProvenanceHash).toBeNull();
    expect(() => validateMaterializedAdaptiveBrick({ ...root, provenance: { ...root.provenance, parentProvenanceHash: brick.provenance.parentProvenanceHash } } as typeof root)).toThrow(AdaptiveAuthorityError);
  });

  it("applies sphere edits to half-open cells with exact negative and large-safe integer arithmetic", () => {
    const tangent = createAdaptiveEditJournal([{
      editId: "edit.tangent",
      sequence: 1,
      expectedRegionRevision: 0,
      resultRegionRevision: 1,
      actorId: "actor.test",
      sourceId: "tool.test",
      operation: "SubtractSphere",
      sphere: { center: { x: 2, y: 0, z: 0 }, radiusQuantum: 1 }
    }]);
    const positive = materializeAdaptiveBrick({ key: key(), baseField: base(), editJournal: tangent });
    expect(positive.occupancy[0]).toBe(1);
    expect(positive.occupancy[1]).toBe(0);

    const negativeKey = createAdaptiveBrickKey({ bodyId: "planet.test", surfaceFrameId: "frame.surface", regionId: "region.test", generatorVersion: "generator.v1", level: 4, originQuantum: { x: -16, y: 0, z: 0 } });
    const negative = materializeAdaptiveBrick({ key: negativeKey, baseField: base(), editJournal: createAdaptiveEditJournal([{
      editId: "edit.negative-tangent", sequence: 1, expectedRegionRevision: 0, resultRegionRevision: 1,
      actorId: "actor.test", sourceId: "tool.test", operation: "SubtractSphere",
      sphere: { center: { x: 1, y: 0, z: 0 }, radiusQuantum: 1 }
    }]) });
    expect(negative.occupancy[15]).toBe(1);

    const large = materializeAdaptiveBrick({ key: key(), baseField: base(), editJournal: createAdaptiveEditJournal([{
      editId: "edit.large", sequence: 1, expectedRegionRevision: 0, resultRegionRevision: 1,
      actorId: "actor.test", sourceId: "tool.test", operation: "SubtractSphere",
      sphere: { center: { x: Number.MAX_SAFE_INTEGER, y: -Number.MAX_SAFE_INTEGER, z: 0 }, radiusQuantum: Number.MAX_SAFE_INTEGER }
    }]) });
    expect(large.contentHash).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
  });

  it("rejects the removed executable shape and retains only deeply frozen descriptor data", () => {
    const executable = {
      kind: "constant-v1",
      identity: stableAuthorityId("base.executable"),
      version: stableAuthorityId("v1"),
      sourceRevision: authorityRevision(0),
      sample: () => ({ density: 0, occupancy: 1, materialId: null })
    };
    expect(() => materializeAdaptiveBrick({ key: key(), baseField: executable as never, editJournal: createAdaptiveEditJournal([]) })).toThrow(AdaptiveAuthorityError);

    const input = base();
    const before = canonicalAdaptiveJson(input);
    const result = materializeAdaptiveBrick({ key: key(), baseField: input, editJournal: createAdaptiveEditJournal([]) });
    expect(canonicalAdaptiveJson(input)).toBe(before);
    expect(isDeepFrozen(input)).toBe(true);
    expect(isDeepFrozen(input.sample)).toBe(true);
    expect(isDeepFrozen(result)).toBe(true);
  });

  it("[12] records complete provenance inputs while excluding runtime and presentation metadata", () => {
    const brick = materializeAdaptiveBrick({ key: key(3), baseField: base(), editJournal: journal() });
    // These independently derived vectors require deliberate schema/version review; never blindly regenerate them.
    expect(brick).toMatchObject({
      key: {
        bodyId: "planet.test",
        surfaceFrameId: "frame.surface",
        regionId: "region.test",
        generatorVersion: "generator.v1",
        level: 3,
        originQuantum: { x: 0, y: 0, z: 0 }
      },
      baseFieldDescriptorDigest: "fnv1a64-v1:ba1ba5a4d02b8cd5",
      sourceRevision: 7,
      editRevision: 2,
      contentHash: "fnv1a64-v1:218a4a226b5eb654"
    });
    expect(brick.provenance).toMatchObject({
      baseFieldIdentity: "base.a",
      baseFieldVersion: "generator.v1",
      baseFieldDescriptorDigest: "fnv1a64-v1:ba1ba5a4d02b8cd5",
      sourceRevision: 7,
      editRevision: 2,
      journalDigest: "fnv1a64-v1:d25e5c7d33b47a27",
      materializationVersion: "adaptive-microvoxel-materialization-v1"
    });
    expect(brick.provenance.provenanceHash).toBe("fnv1a64-v1:e5d79a2e9d837efd");
    expect(brick.provenance.parentProvenanceHash).not.toBeNull();
    const canonical = canonicalAdaptiveJson(brick.provenance);
    for (const forbidden of ["request", "worker", "cache", "camera", "renderer", "telemetry", "timing"]) {
      expect(canonical).not.toContain(forbidden);
    }
  });

  it("pins the complete materialized content-hash input and provenance UTF-8 bytes independently", () => {
    const vectorKey = createAdaptiveBrickKey({
      bodyId: "p",
      surfaceFrameId: "f",
      regionId: "r",
      generatorVersion: "g",
      level: 0,
      originQuantum: { x: 0, y: 0, z: 0 }
    });
    const vectorBase = createAdaptiveBaseFieldDescriptor({
      kind: "constant-v1",
      identity: stableAuthorityId("b"),
      version: stableAuthorityId("v"),
      sourceRevision: authorityRevision(0),
      sample: { density: 0, occupancy: 1, materialId: stableAuthorityId("m") }
    });
    const brick = materializeAdaptiveBrick({ key: vectorKey, baseField: vectorBase, editJournal: createAdaptiveEditJournal([]) });
    const authorityInputDigest = hashAdaptiveCanonical({
      schemaVersion: "adaptive-microvoxel-authority-input-v1",
      brickSchemaVersion: "adaptive-microvoxel-brick-v1",
      materializationVersion: "adaptive-microvoxel-materialization-v1",
      key: brick.key,
      baseFieldIdentity: brick.provenance.baseFieldIdentity,
      baseFieldVersion: brick.provenance.baseFieldVersion,
      baseFieldDescriptorDigest: brick.baseFieldDescriptorDigest,
      sourceRevision: brick.sourceRevision,
      editRevision: brick.editRevision,
      journalDigest: brick.provenance.journalDigest
    });
    const actualContentHashInput = canonicalAdaptiveJson({
      schemaVersion: "adaptive-microvoxel-content-hash-input-v1",
      authorityInputDigest,
      cellSizeQuantum: brick.cellSizeQuantum,
      cellSizeMeters: brick.cellSizeMeters,
      cellCount: brick.cellCount,
      density: brick.density,
      occupancy: brick.occupancy,
      material: brick.material,
      semantic: brick.semantic
    });

    // Independently derived with a separate Python canonical-JSON/UTF-8/FNV-1a64 reference.
    // The literal run builder pins all 4,096 cells without hiding bytes in a generated fixture.
    // Any change requires deliberate schema/version review; never blindly regenerate this vector.
    const literalRun = (literal: string): string => Array.from({ length: 4_096 }, () => literal).join(",");
    const expectedContentHashInput =
      `{"authorityInputDigest":"fnv1a64-v1:de34e3ba00e460c0","cellCount":4096,"cellSizeMeters":2,"cellSizeQuantum":16,"density":[${literalRun("0")}],` +
      `"material":[${literalRun('"m"')}],"occupancy":[${literalRun("1")}],"schemaVersion":"adaptive-microvoxel-content-hash-input-v1","semantic":[${literalRun("null")}]}`;
    const expectedProvenance = '{"baseFieldDescriptorDigest":"fnv1a64-v1:81e095fb999e1a7d","baseFieldIdentity":"b","baseFieldVersion":"v","editRevision":0,"hierarchyKeyHash":"fnv1a64-v1:3507e84712dd1542","journalDigest":"fnv1a64-v1:4144927f889a3178","materializationVersion":"adaptive-microvoxel-materialization-v1","parentProvenanceHash":null,"provenanceHash":"fnv1a64-v1:f1d62e52a9041bae","schemaVersion":"adaptive-microvoxel-provenance-v1","sourceRevision":0}';
    const encoder = new TextEncoder();
    const actualContentBytes = encoder.encode(actualContentHashInput);
    const expectedContentBytes = encoder.encode(expectedContentHashInput);
    const actualProvenanceBytes = encoder.encode(canonicalAdaptiveJson(brick.provenance));
    const expectedProvenanceBytes = encoder.encode(expectedProvenance);

    expect(authorityInputDigest).toBe("fnv1a64-v1:de34e3ba00e460c0");
    expect(actualContentHashInput).toBe(expectedContentHashInput);
    expect(actualContentBytes).toEqual(expectedContentBytes);
    expect(actualContentBytes.byteLength).toBe(53_471);
    expect(brick.contentHash).toBe("fnv1a64-v1:9f29dfdc70de51ff");
    expect(canonicalAdaptiveJson(brick.provenance)).toBe(expectedProvenance);
    expect(actualProvenanceBytes).toEqual(expectedProvenanceBytes);
    expect(actualProvenanceBytes.byteLength).toBe(430);
    expect(brick.provenance.provenanceHash).toBe("fnv1a64-v1:f1d62e52a9041bae");
  });
});
