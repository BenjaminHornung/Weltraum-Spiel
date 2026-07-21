import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_BRICK_CELL_COUNT,
  ADAPTIVE_LEVELS,
  ADAPTIVE_MAX_JOURNAL_RECORDS,
  AdaptiveAuthorityError,
  MICROVOXEL_BASE_QUANTUM_METERS,
  adaptiveLevel,
  ancestorsOf,
  authorityRevision,
  brickExtentQuantumForLevel,
  canonicalAdaptiveJson,
  cellSizeMetersForLevel,
  childrenOf,
  containsQuantumCoordinate,
  createAdaptiveBaseFieldDescriptor,
  createAdaptiveBrickKey,
  createAdaptiveEditJournal,
  globalQuantumCoordinate,
  hashAdaptiveBaseFieldDescriptor,
  hashAdaptiveCanonical,
  isDeepFrozen,
  keyFromGlobalQuantum,
  materializeAdaptiveBrick,
  meterBoundsForKey,
  parentOf,
  planAdaptiveMicrovoxels,
  quantumBoundsForKey,
  serializeAdaptiveEditJournal,
  serializeAdaptiveKey,
  serializeAdaptivePlan,
  serializeMaterializedAdaptiveBrick,
  stableAuthorityId,
  validateAdaptiveBaseFieldDescriptor,
  validateAdaptiveBrickKey,
  validateAdaptivePlanResult,
  validateMaterializedAdaptiveBrick,
  type AdaptiveBaseFieldDescriptor,
  type AdaptiveBrickCoordinate,
  type AdaptiveBrickResidencyState,
  type AdaptiveBrickRevision,
  type AdaptiveEditInput,
  type AdaptiveEditId,
  type AdaptiveEditRevision,
  type AdaptivePlanningEpoch,
  type AdaptiveRefinementLevel,
  type AdaptiveRegionId,
  type MaterializedAdaptiveBrick
} from "../../src/voxel/adaptive";

const withInheritedMapGetter = <T>(values: T[], onAccess: () => void): T[] => {
  const foreignPrototype = Object.create(Array.prototype) as object;
  Object.defineProperty(foreignPrototype, "map", {
    configurable: true,
    get: () => {
      onAccess();
      throw new Error("caller map getter must not execute");
    }
  });
  Object.setPrototypeOf(values, foreignPrototype);
  return values;
};

const key = (level = 4, x = 0) =>
  createAdaptiveBrickKey({ bodyId: "planet.test", surfaceFrameId: "frame.surface", regionId: "region.test", generatorVersion: "generator.v1", level, originQuantum: { x, y: 0, z: 0 } });

const baseField = (density = -0.25): AdaptiveBaseFieldDescriptor => createAdaptiveBaseFieldDescriptor({
  kind: "constant-v1",
  identity: stableAuthorityId("base.test"),
  version: stableAuthorityId("base.test.v1"),
  sourceRevision: authorityRevision(3),
  sample: {
    density,
    occupancy: density <= 0 ? 1 : 0,
    materialId: stableAuthorityId("material.rock")
  }
});

const edit = (overrides: Partial<AdaptiveEditInput> = {}): AdaptiveEditInput => ({
  editId: "edit.1",
  sequence: 1,
  expectedRegionRevision: 0,
  resultRegionRevision: 1,
  actorId: "actor.test",
  sourceId: "tool.test",
  operation: "SubtractBox",
  box: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
  ...overrides
});

const utf8Hex = (value: string): string =>
  Array.from(new TextEncoder().encode(value), (byte) => byte.toString(16).padStart(2, "0")).join("");

const canonicalVectorKey = createAdaptiveBrickKey({
  bodyId: 'planet.\u00e4"north',
  surfaceFrameId: "frame.surface",
  regionId: "region.\u5ca9",
  generatorVersion: "generator.v1",
  level: 4,
  originQuantum: { x: -16, y: 16, z: -32 }
});
const canonicalVectorProvider = createAdaptiveBaseFieldDescriptor({
  kind: "constant-v1",
  identity: stableAuthorityId('base.\u00e9"constant'),
  version: stableAuthorityId("base.v1"),
  sourceRevision: authorityRevision(3),
  sample: { density: -0.25, occupancy: 1, materialId: stableAuthorityId("material.\u5ca9"), semanticId: stableAuthorityId("semantic.\u00e9") }
});
const canonicalVectorJournal = createAdaptiveEditJournal([{
  editId: 'edit.\u00e9"paint',
  sequence: 1,
  expectedRegionRevision: 0,
  resultRegionRevision: 1,
  actorId: "actor.\u00e4",
  sourceId: "tool.\\path",
  operation: "SetMaterialBox",
  box: { min: { x: -16, y: 16, z: -32 }, max: { x: -14, y: 18, z: -30 } },
  materialId: "material.\u94dc",
  semanticId: 'semantic."cut'
}]);

describe("adaptive microvoxel contract obligations 01-09", () => {
  it("[01] accepts only the fixed quantum and exact level ladder", () => {
    const namedContracts: readonly [AdaptiveRegionId, AdaptiveBrickCoordinate, AdaptiveRefinementLevel, AdaptiveBrickRevision, AdaptivePlanningEpoch, AdaptiveEditId, AdaptiveEditRevision, AdaptiveBrickResidencyState] = [
      stableAuthorityId("region.test"), key().originQuantum, adaptiveLevel(4), authorityRevision(1), authorityRevision(1), stableAuthorityId("edit.test"), authorityRevision(1), "ready"
    ];
    expect(namedContracts).toHaveLength(8);
    expect(MICROVOXEL_BASE_QUANTUM_METERS).toBe(0.125);
    expect(ADAPTIVE_LEVELS.map((level) => cellSizeMetersForLevel(adaptiveLevel(level)))).toEqual([2, 1, 0.5, 0.25, 0.125]);
    for (const level of ADAPTIVE_LEVELS) expect(adaptiveLevel(level)).toBe(level);
    for (const invalid of [-1, 5, 1.5, -0, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => adaptiveLevel(invalid)).toThrow(AdaptiveAuthorityError);
    }
  });

  it("[02] fixes every materialized brick to 16 cubed dense cells and rejects malformed channels or metadata", () => {
    const brick = materializeAdaptiveBrick({ key: key(), baseField: baseField(), editJournal: createAdaptiveEditJournal([]) });
    expect(brick.cellCount).toBe(ADAPTIVE_BRICK_CELL_COUNT);
    expect(brick.density).toHaveLength(4_096);
    expect(brick.occupancy).toHaveLength(4_096);
    expect(brick.material).toHaveLength(4_096);
    const validated = validateMaterializedAdaptiveBrick(brick);
    expect(validated).toStrictEqual(brick);
    expect(isDeepFrozen(validated)).toBe(true);
    expect(() =>
      validateMaterializedAdaptiveBrick({ ...brick, density: brick.density.slice(1) } as MaterializedAdaptiveBrick)
    ).toThrow(AdaptiveAuthorityError);
    expect(() => validateMaterializedAdaptiveBrick({ ...brick, level: adaptiveLevel(3) })).toThrow(AdaptiveAuthorityError);
  });

  it("[03] enforces safe integer alignment for positive and negative global quantum coordinates", () => {
    expect(brickExtentQuantumForLevel(adaptiveLevel(0))).toBe(256);
    expect(brickExtentQuantumForLevel(adaptiveLevel(4))).toBe(16);
    expect(keyFromGlobalQuantum("planet.test", "frame.surface", "region.test", "generator.v1", 2, { x: -1, y: 0, z: 0 }).originQuantum.x).toBe(-64);
    expect(keyFromGlobalQuantum("planet.test", "frame.surface", "region.test", "generator.v1", 2, { x: 64, y: 0, z: 0 }).originQuantum.x).toBe(64);
    expect(() => key(2, 1)).toThrow(AdaptiveAuthorityError);
    expect(() => globalQuantumCoordinate(Number.MAX_SAFE_INTEGER + 1)).toThrow(AdaptiveAuthorityError);
    expect(() => keyFromGlobalQuantum("planet.test", "frame.surface", "region.test", "generator.v1", 4, { x: -0, y: 0, z: 0 })).toThrow(
      AdaptiveAuthorityError
    );
  });

  it("[03] accepts only the ancestry-closed Number-safe key domain at every level", () => {
    const levelZeroExtent = brickExtentQuantumForLevel(adaptiveLevel(0));
    const positiveAccepted = Math.floor((Number.MAX_SAFE_INTEGER - levelZeroExtent) / levelZeroExtent) * levelZeroExtent;
    const negativeAccepted = Math.ceil(Number.MIN_SAFE_INTEGER / levelZeroExtent) * levelZeroExtent;

    for (const levelValue of ADAPTIVE_LEVELS) {
      const level = adaptiveLevel(levelValue);
      const extent = brickExtentQuantumForLevel(level);
      for (const origin of [negativeAccepted, positiveAccepted]) {
        const accepted = key(level, origin);
        for (const current of [accepted, ...ancestorsOf(accepted)]) {
          const bounds = quantumBoundsForKey(current);
          const currentExtent = brickExtentQuantumForLevel(current.level);
          expect(Number.isSafeInteger(bounds.min.x)).toBe(true);
          expect(Number.isSafeInteger(bounds.max.x)).toBe(true);
          expect(Math.abs(bounds.min.x % currentExtent)).toBe(0);
          expect(bounds.max.x - bounds.min.x).toBe(currentExtent);
        }
      }

      const positiveRejected = level === 0
        ? Math.floor(Number.MAX_SAFE_INTEGER / extent) * extent
        : Math.floor((Number.MAX_SAFE_INTEGER - extent) / extent) * extent;
      const negativeRejected = level === 0
        ? Number.MIN_SAFE_INTEGER - 1
        : Math.ceil(Number.MIN_SAFE_INTEGER / extent) * extent;

      if (level > 0) {
        expect(Number.isSafeInteger(positiveRejected)).toBe(true);
        expect(Number.isSafeInteger(positiveRejected + extent)).toBe(true);
        expect(Number.isSafeInteger(negativeRejected)).toBe(true);
        expect(Number.isSafeInteger(negativeRejected + extent)).toBe(true);
      }
      expect(() => key(level, positiveRejected)).toThrow(AdaptiveAuthorityError);
      expect(() => key(level, negativeRejected)).toThrow(AdaptiveAuthorityError);
    }

    const priorLocallySafeCounterexample = -9_007_199_254_740_976;
    expect(Number.isSafeInteger(priorLocallySafeCounterexample)).toBe(true);
    expect(Number.isSafeInteger(priorLocallySafeCounterexample + brickExtentQuantumForLevel(adaptiveLevel(4)))).toBe(true);
    expect(() => key(4, priorLocallySafeCounterexample)).toThrow(AdaptiveAuthorityError);
    expect(() => validateAdaptiveBrickKey({
      ...key(4),
      originQuantum: { x: priorLocallySafeCounterexample, y: 0, z: 0 }
    })).toThrow(AdaptiveAuthorityError);
    expect(() => keyFromGlobalQuantum(
      "planet.test",
      "frame.surface",
      "region.test",
      "generator.v1",
      4,
      { x: priorLocallySafeCounterexample, y: 0, z: 0 }
    )).toThrow(AdaptiveAuthorityError);
  });

  it("[04] partitions each parent into exactly eight half-open children and handles ancestry", () => {
    const parent = key(2, -64);
    const children = childrenOf(parent);
    expect(children).toHaveLength(8);
    expect(new Set(children.map(serializeAdaptiveKey)).size).toBe(8);
    expect(children.every((child) => serializeAdaptiveKey(parentOf(child)!) === serializeAdaptiveKey(parent))).toBe(true);
    const parentBounds = quantumBoundsForKey(parent);
    expect(children.every((child) => {
      const bounds = quantumBoundsForKey(child);
      return (["x", "y", "z"] as const).every(
        (axis) => bounds.min[axis] >= parentBounds.min[axis] && bounds.max[axis] <= parentBounds.max[axis]
      );
    })).toBe(true);
    expect(ancestorsOf(children[0]).map((entry) => entry.level)).toEqual([2, 1, 0]);
    expect(parentOf(key(0))).toBeNull();
    expect(childrenOf(key(4))).toEqual([]);
    expect(containsQuantumCoordinate(parent, parentBounds.min)).toBe(true);
    expect(containsQuantumCoordinate(parent, parentBounds.max)).toBe(false);
    expect(meterBoundsForKey(key(4)).max.x).toBe(2);
  });

  it("[05] keeps stable spatial identity independent of separate operational metadata and fails closed on unknown key fields", () => {
    const first = createAdaptiveBrickKey({
      bodyId: "planet.test",
      surfaceFrameId: "frame.surface",
      regionId: "region.test",
      generatorVersion: "generator.v1",
      level: 4,
      originQuantum: { x: 0, y: 0, z: 0 }
    });
    const second = createAdaptiveBrickKey({
      bodyId: "planet.test",
      surfaceFrameId: "frame.surface",
      regionId: "region.test",
      generatorVersion: "generator.v1",
      level: 4,
      originQuantum: { x: 0, y: 0, z: 0 }
    });
    const firstMetadata = { requestId: "request.a", workerEpoch: 1 };
    const secondMetadata = { requestId: "request.b", renderer: "anything" };
    expect(first).toEqual(second);
    expect(hashAdaptiveCanonical(first)).toBe(hashAdaptiveCanonical(second));
    expect(firstMetadata).not.toEqual(secondMetadata);
    expect(Object.keys(first)).toEqual(["schemaVersion", "bodyId", "surfaceFrameId", "regionId", "generatorVersion", "level", "originQuantum"]);
    expect(() => createAdaptiveBrickKey({ ...first, requestId: "request.a" } as never)).toThrow(AdaptiveAuthorityError);
  });

  it("[05] rejects lone UTF-16 surrogates at stable-ID and key publication boundaries", () => {
    for (const [value, label] of [["id.\ud800", "high"], ["id.\udc00", "low"]] as const) {
      try {
        stableAuthorityId(value);
        throw new Error(`expected lone ${label} surrogate rejection`);
      } catch (error) {
        expect(error).toBeInstanceOf(AdaptiveAuthorityError);
        expect((error as AdaptiveAuthorityError).code).toBe("InvalidIdentity");
      }

      try {
        createAdaptiveBrickKey({
          bodyId: value,
          surfaceFrameId: "frame.surface",
          regionId: "region.test",
          generatorVersion: "generator.v1",
          level: 4,
          originQuantum: { x: 0, y: 0, z: 0 }
        });
        throw new Error(`expected key lone ${label} surrogate rejection`);
      } catch (error) {
        expect(error).toBeInstanceOf(AdaptiveAuthorityError);
        expect((error as AdaptiveAuthorityError).code).toBe("InvalidIdentity");
        expect((error as AdaptiveAuthorityError).path).toBe("bodyId");
      }
    }
  });

  it("[06] accepts only the closed immutable constant descriptor and never infers air", () => {
    const journal = createAdaptiveEditJournal([]);
    expect(() => materializeAdaptiveBrick({ key: key(), baseField: undefined as unknown as AdaptiveBaseFieldDescriptor, editJournal: journal }))
      .toThrow(AdaptiveAuthorityError);
    const valid = baseField();
    expect(isDeepFrozen(valid)).toBe(true);
    expect(Object.isFrozen(valid.sample)).toBe(true);
    expect(validateAdaptiveBaseFieldDescriptor(valid)).toEqual(valid);
    expect(hashAdaptiveBaseFieldDescriptor(valid)).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
    for (const invalid of [
      { ...valid, kind: "procedural-v1" },
      { ...valid, extra: true },
      { ...valid, identity: " bad " },
      { ...valid, version: "" },
      { ...valid, sourceRevision: -1 },
      { ...valid, sample: { ...valid.sample, density: Number.NaN } },
      { ...valid, sample: { ...valid.sample, occupancy: 2 } },
      { ...valid, sample: { ...valid.sample, materialId: " bad " } },
      { ...valid, sample: { ...valid.sample, extra: true } }
    ]) {
      expect(() => validateAdaptiveBaseFieldDescriptor(invalid as never)).toThrow(AdaptiveAuthorityError);
    }
  });

  it("[07] appends immutable journal snapshots without mutating records or prior values", () => {
    const first = createAdaptiveEditJournal([edit()]);
    const second = createAdaptiveEditJournal([
      edit(),
      edit({ editId: "edit.2", sequence: 2, expectedRegionRevision: 1, resultRegionRevision: 2 })
    ]);
    expect(first.records).toHaveLength(1);
    expect(second.records).toHaveLength(2);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.records)).toBe(true);
    expect(Object.isFrozen(first.records[0].box)).toBe(true);
    expect(() => Array.prototype.push.call(first.records, edit())).toThrow();

    const sentinel = edit();
    const oversized = new Array(ADAPTIVE_MAX_JOURNAL_RECORDS + 1).fill(sentinel);
    expect(() => createAdaptiveEditJournal(oversized)).toThrow(AdaptiveAuthorityError);
    expect(oversized).toHaveLength(ADAPTIVE_MAX_JOURNAL_RECORDS + 1);
    expect(oversized.every((entry) => entry === sentinel)).toBe(true);
  });

  it("rejects journal accessors and non-index keys without invoking caller getters", () => {
    let getterCalls = 0;
    const accessorRecords: AdaptiveEditInput[] = [];
    Object.defineProperty(accessorRecords, "0", {
      enumerable: true,
      configurable: true,
      get: () => {
        getterCalls += 1;
        return edit();
      }
    });
    expect(() => createAdaptiveEditJournal(accessorRecords)).toThrow(AdaptiveAuthorityError);
    expect(getterCalls).toBe(0);

    const extraKeyRecords = [edit()];
    Object.defineProperty(extraKeyRecords, "extra", { enumerable: true, configurable: true, value: true });
    expect(() => createAdaptiveEditJournal(extraKeyRecords)).toThrow(AdaptiveAuthorityError);

    const symbolKeyRecords = [edit()];
    Object.defineProperty(symbolKeyRecords, Symbol("extra"), { enumerable: true, configurable: true, value: true });
    expect(() => createAdaptiveEditJournal(symbolKeyRecords)).toThrow(AdaptiveAuthorityError);
  });

  it("copies journal descriptors into a plain array without inherited map access", () => {
    let inheritedMapCalls = 0;
    const input = withInheritedMapGetter([edit()], () => {
      inheritedMapCalls += 1;
    });
    const callerPrototype = Object.getPrototypeOf(input);
    const journal = createAdaptiveEditJournal(input);
    expect(journal.records).toHaveLength(1);
    expect(journal.records[0].editId).toBe("edit.1");
    expect(inheritedMapCalls).toBe(0);
    expect(Object.getPrototypeOf(input)).toBe(callerPrototype);
  });

  it("[08] applies canonical sequence authority and rejects duplicates, gaps, ambiguity, and revision conflicts", () => {
    const addThenSubtract = createAdaptiveEditJournal([
      edit({ operation: "AddBox" }),
      edit({ editId: "edit.2", sequence: 2, expectedRegionRevision: 1, resultRegionRevision: 2 })
    ]);
    const subtractThenAdd = createAdaptiveEditJournal([
      edit({ operation: "SubtractBox" }),
      edit({
        editId: "edit.2",
        sequence: 2,
        expectedRegionRevision: 1,
        resultRegionRevision: 2,
        operation: "AddBox"
      })
    ]);
    expect(materializeAdaptiveBrick({ key: key(), baseField: baseField(), editJournal: addThenSubtract }).occupancy[0]).toBe(0);
    expect(materializeAdaptiveBrick({ key: key(), baseField: baseField(), editJournal: subtractThenAdd }).occupancy[0]).toBe(1);
    expect(() => createAdaptiveEditJournal([edit(), edit({ sequence: 2, expectedRegionRevision: 1, resultRegionRevision: 2 })])).toThrow(
      AdaptiveAuthorityError
    );
    expect(() => createAdaptiveEditJournal([edit({ sequence: 2 })])).toThrow(AdaptiveAuthorityError);
    expect(() => createAdaptiveEditJournal([edit({ expectedRegionRevision: 2, resultRegionRevision: 3 })])).toThrow(
      AdaptiveAuthorityError
    );
  });

  it("[09] canonicalizes field order and negative zero while rejecting unknown contract fields and unsafe JSON values", () => {
    expect(canonicalAdaptiveJson({ b: -0, a: [true, 1] })).toBe('{"a":[true,1],"b":0}');
    expect(canonicalAdaptiveJson({ "\uE000": 4, "😀": 3, "ä": 2, z: 1 })).toBe('{"z":1,"ä":2,"😀":3,"":4}');
    expect(() => canonicalAdaptiveJson({ value: Number.POSITIVE_INFINITY })).toThrow(AdaptiveAuthorityError);
    expect(() => canonicalAdaptiveJson({ value: () => 1 })).toThrow(AdaptiveAuthorityError);
    expect(() => canonicalAdaptiveJson(new Map())).toThrow(AdaptiveAuthorityError);
    const sparse = new Array(2);
    sparse[1] = 1;
    expect(() => canonicalAdaptiveJson(sparse)).toThrow(AdaptiveAuthorityError);
    expect(() => serializeAdaptiveKey({ ...key(), unknown: true } as never)).toThrow(AdaptiveAuthorityError);
  });

  it("pins independently derived canonical UTF-8 and FNV-1a64 vectors for key, provider, and journal", () => {
    // These literals were derived with a separate Python canonical-JSON/UTF-8/FNV-1a64 reference.
    // Any change requires deliberate schema/version review; never blindly regenerate these vectors.
    const expectedKey = '{"bodyId":"planet.\u00e4\\"north","generatorVersion":"generator.v1","level":4,"originQuantum":{"x":-16,"y":16,"z":-32},"regionId":"region.\u5ca9","schemaVersion":"adaptive-microvoxel-key-v1","surfaceFrameId":"frame.surface"}';
    const expectedProvider = '{"identity":"base.\u00e9\\"constant","kind":"constant-v1","sample":{"density":-0.25,"materialId":"material.\u5ca9","occupancy":1,"semanticId":"semantic.\u00e9"},"sourceRevision":3,"version":"base.v1"}';
    const expectedJournal = '{"digest":"fnv1a64-v1:c8c7dc4baf7edc73","initialRegionRevision":0,"records":[{"actorId":"actor.\u00e4","box":{"max":{"x":-14,"y":18,"z":-30},"min":{"x":-16,"y":16,"z":-32}},"editId":"edit.\u00e9\\"paint","expectedRegionRevision":0,"materialId":"material.\u94dc","operation":"SetMaterialBox","resultRegionRevision":1,"schemaVersion":"adaptive-microvoxel-edit-v1","semanticId":"semantic.\\"cut","sequence":1,"sourceId":"tool.\\\\path"}],"revision":1,"schemaVersion":"adaptive-microvoxel-journal-v1"}';

    expect(serializeAdaptiveKey(canonicalVectorKey)).toBe(expectedKey);
    expect(utf8Hex(expectedKey)).toBe("7b22626f64794964223a22706c616e65742ec3a45c226e6f727468222c2267656e657261746f7256657273696f6e223a2267656e657261746f722e7631222c226c6576656c223a342c226f726967696e5175616e74756d223a7b2278223a2d31362c2279223a31362c227a223a2d33327d2c22726567696f6e4964223a22726567696f6e2ee5b2a9222c22736368656d6156657273696f6e223a2261646170746976652d6d6963726f766f78656c2d6b65792d7631222c22737572666163654672616d654964223a226672616d652e73757266616365227d");
    expect(hashAdaptiveCanonical(canonicalVectorKey)).toBe("fnv1a64-v1:69a1fd51ba189b76");

    expect(canonicalAdaptiveJson(canonicalVectorProvider)).toBe(expectedProvider);
    expect(utf8Hex(expectedProvider)).toBe("7b226964656e74697479223a22626173652ec3a95c22636f6e7374616e74222c226b696e64223a22636f6e7374616e742d7631222c2273616d706c65223a7b2264656e73697479223a2d302e32352c226d6174657269616c4964223a226d6174657269616c2ee5b2a9222c226f63637570616e6379223a312c2273656d616e7469634964223a2273656d616e7469632ec3a9227d2c22736f757263655265766973696f6e223a332c2276657273696f6e223a22626173652e7631227d");
    expect(hashAdaptiveCanonical(canonicalVectorProvider)).toBe("fnv1a64-v1:fbe25906701bf507");
    expect(hashAdaptiveBaseFieldDescriptor(canonicalVectorProvider)).toBe("fnv1a64-v1:d35f808b2c5eee48");

    expect(serializeAdaptiveEditJournal(canonicalVectorJournal)).toBe(expectedJournal);
    expect(utf8Hex(expectedJournal)).toBe("7b22646967657374223a22666e76316136342d76313a63386337646334626166376564633733222c22696e697469616c526567696f6e5265766973696f6e223a302c227265636f726473223a5b7b226163746f724964223a226163746f722ec3a4222c22626f78223a7b226d6178223a7b2278223a2d31342c2279223a31382c227a223a2d33307d2c226d696e223a7b2278223a2d31362c2279223a31362c227a223a2d33327d7d2c22656469744964223a22656469742ec3a95c227061696e74222c226578706563746564526567696f6e5265766973696f6e223a302c226d6174657269616c4964223a226d6174657269616c2ee9939c222c226f7065726174696f6e223a225365744d6174657269616c426f78222c22726573756c74526567696f6e5265766973696f6e223a312c22736368656d6156657273696f6e223a2261646170746976652d6d6963726f766f78656c2d656469742d7631222c2273656d616e7469634964223a2273656d616e7469632e5c22637574222c2273657175656e6365223a312c22736f757263654964223a22746f6f6c2e5c5c70617468227d5d2c227265766973696f6e223a312c22736368656d6156657273696f6e223a2261646170746976652d6d6963726f766f78656c2d6a6f75726e616c2d7631227d");
    expect(canonicalVectorJournal.digest).toBe("fnv1a64-v1:c8c7dc4baf7edc73");
    expect(hashAdaptiveCanonical(canonicalVectorJournal)).toBe("fnv1a64-v1:b827d6f7d538d9f7");
  });

  it("makes typed serializers reject unsupported schemas and malformed nested authority", () => {
    const validKey = key();
    expect(() => serializeAdaptiveKey({ ...validKey, schemaVersion: "adaptive-microvoxel-key-v2" } as never)).toThrow(AdaptiveAuthorityError);
    expect(() => serializeAdaptiveKey({ ...validKey, level: 5 } as never)).toThrow(AdaptiveAuthorityError);
    expect(() => serializeAdaptiveKey({ ...validKey, bodyId: " bad " } as never)).toThrow(AdaptiveAuthorityError);

    const validJournal = createAdaptiveEditJournal([edit()]);
    expect(serializeAdaptiveEditJournal(validJournal)).toContain("adaptive-microvoxel-journal-v1");
    expect(() => serializeAdaptiveEditJournal({
      ...validJournal,
      records: [{
        ...validJournal.records[0],
        box: { min: { ...validJournal.records[0].box!.min, unknown: true }, max: validJournal.records[0].box!.max }
      }]
    } as never)).toThrow(AdaptiveAuthorityError);

    const brick = materializeAdaptiveBrick({ key: validKey, baseField: baseField(), editJournal: createAdaptiveEditJournal([]) });
    expect(serializeMaterializedAdaptiveBrick(brick)).toContain(brick.contentHash);
    expect(() => serializeMaterializedAdaptiveBrick({ ...brick, semantic: [" bad ", ...brick.semantic.slice(1)] } as never)).toThrow(AdaptiveAuthorityError);

    const plan = planAdaptiveMicrovoxels({ snapshot: {
      schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
      bodyId: stableAuthorityId("planet.test"),
      surfaceFrameId: stableAuthorityId("frame.surface"),
      regionId: stableAuthorityId("region.test"),
      generatorVersion: stableAuthorityId("generator.v1"),
      authority: {
        schemaVersion: "adaptive-microvoxel-planner-authority-v1",
        baseField: baseField(),
        editJournal: createAdaptiveEditJournal([]),
        brickRevision: authorityRevision(0)
      },
      planningEpoch: authorityRevision(0),
      resident: [],
      activeCoverage: [],
      refinementRequests: [{
        requestId: stableAuthorityId("request.test"),
        region: { kind: "aabb", bounds: quantumBoundsForKey(validKey) },
        targetLevel: adaptiveLevel(4),
        reason: "Inspection",
        requiredForCoverage: true,
        priority: 1
      }],
      budgets: { maxBricks: 1, maxBytes: 1_000_000, maxWork: 10_000, maxCoverageQuantum: 4_096 }
    } });
    expect(plan.status).toBe("accepted");
    expect(serializeAdaptivePlan(plan)).toContain(plan.planHash);
    if (plan.status !== "accepted") throw new Error("expected accepted plan");
    const hashConsistentAccepted = (changes: Record<string, unknown>) => {
      const { planHash: _oldHash, ...payload } = { ...plan, ...changes };
      return { ...payload, planHash: hashAdaptiveCanonical(payload) };
    };
    expect(() => validateAdaptivePlanResult(hashConsistentAccepted({
      coverageStatus: { ...plan.coverageStatus, uncoveredRequiredKeyCount: -0 }
    }) as never)).toThrow(AdaptiveAuthorityError);
    const malformedDesired = [{ ...plan.desired[0], originQuantum: { ...plan.desired[0].originQuantum, unknown: 1 } }];
    expect(() => serializeAdaptivePlan({ ...plan, desired: malformedDesired } as never)).toThrow(AdaptiveAuthorityError);

    const rejected = planAdaptiveMicrovoxels({ snapshot: {
      schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
      bodyId: stableAuthorityId("planet.test"),
      surfaceFrameId: stableAuthorityId("frame.surface"),
      regionId: stableAuthorityId("region.test"),
      generatorVersion: stableAuthorityId("generator.v1"),
      authority: {
        schemaVersion: "adaptive-microvoxel-planner-authority-v1",
        baseField: baseField(),
        editJournal: createAdaptiveEditJournal([]),
        brickRevision: authorityRevision(0)
      },
      planningEpoch: authorityRevision(0),
      resident: [],
      activeCoverage: [],
      refinementRequests: [{
        requestId: stableAuthorityId("request.rejected"),
        region: { kind: "aabb", bounds: quantumBoundsForKey(validKey) },
        targetLevel: adaptiveLevel(4),
        reason: "Inspection",
        requiredForCoverage: true,
        priority: 1
      }],
      budgets: { maxBricks: 0, maxBytes: 1_000_000, maxWork: 10_000, maxCoverageQuantum: 4_096 }
    } });
    if (rejected.status !== "rejected") throw new Error("expected rejected plan");
    const coverage = { bounds: quantumBoundsForKey(validKey), key: validKey, kind: "selected" as const };
    const fallback = { ancestor: validKey, requiredChildren: [validKey], coverage: quantumBoundsForKey(validKey) };
    const hashConsistent = (changes: Record<string, unknown>) => {
      const { planHash: _oldHash, ...payload } = { ...rejected, ...changes };
      return { ...payload, planHash: hashAdaptiveCanonical(payload) };
     };
     expect(() => validateAdaptivePlanResult(hashConsistent({ required: 1, limit: -0 }) as never)).toThrow(AdaptiveAuthorityError);
     const maliciousNegativeZeroRequired = hashConsistent({ required: -0, limit: 0 });
     let maliciousNegativeZeroRequiredError: unknown;
     try {
       validateAdaptivePlanResult(maliciousNegativeZeroRequired as never);
     } catch (error) {
       maliciousNegativeZeroRequiredError = error;
     }
     expect(maliciousNegativeZeroRequiredError).toBeInstanceOf(AdaptiveAuthorityError);
     expect((maliciousNegativeZeroRequiredError as AdaptiveAuthorityError).code).toBe("InvalidPlannerInput");
     expect((maliciousNegativeZeroRequiredError as AdaptiveAuthorityError).path).toBe("plan/required");
     const maliciousRejections = [
      hashConsistent({ desired: [validKey], desiredKeys: [validKey] }),
      hashConsistent({ materialize: [validKey], materializeRequests: [validKey] }),
      hashConsistent({ evict: [validKey], evictCandidates: [validKey] }),
      hashConsistent({ fallback: [fallback], parentFallbackKeys: [validKey] }),
      hashConsistent({ coverage: [coverage], coverageStatus: { ...rejected.coverageStatus, coverage: [coverage] } }),
      hashConsistent({ coverageStatus: { coverage: [], complete: true, uncoveredRequiredKeyCount: 0 } }),
      hashConsistent({ coverageStatus: { coverage: [], complete: false, uncoveredRequiredKeyCount: 1 } }),
      hashConsistent({ reasons: ["forged"], deterministicReasons: ["forged"] })
    ];
    for (const malicious of maliciousRejections) {
      expect(() => validateAdaptivePlanResult(malicious as never)).toThrow(AdaptiveAuthorityError);
    }
    expect(validateAdaptivePlanResult(rejected)).toEqual(rejected);
  });
});
