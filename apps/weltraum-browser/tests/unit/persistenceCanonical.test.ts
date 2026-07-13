import { describe, expect, it } from "vitest";
import {
  PersistenceCanonicalError,
  PersistenceValidationError,
  canonicalizePersistenceValue,
  createDefinitionResolutionFixture,
  createPersistenceSignature,
  createSaveGameEnvelopeV1Fixture,
  createSaveGameSignature,
  deserializeSaveGameEnvelopeV1,
  serializeCanonicalPersistenceValue,
  serializeSaveGameEnvelopeV1
} from "../../src/persistence";

type MutableRecord = Record<string, any>;

describe("persistence canonical JSON", () => {
  it("sorts object keys, normalizes negative zero, preserves array order, and deep-freezes clones", () => {
    const source = { z: -0, a: { second: 2, first: 1 }, ordered: [3, 1, 2] };
    const canonical = canonicalizePersistenceValue<MutableRecord>(source);

    expect(JSON.stringify(canonical)).toBe('{"a":{"first":1,"second":2},"ordered":[3,1,2],"z":0}');
    expect(Object.is(canonical.z, -0)).toBe(false);
    expect(Object.isFrozen(canonical)).toBe(true);
    expect(Object.isFrozen(canonical.a)).toBe(true);
    expect(Object.isFrozen(canonical.ordered)).toBe(true);
    source.a.first = 99;
    source.ordered.reverse();
    expect(canonical.a.first).toBe(1);
    expect(canonical.ordered).toEqual([3, 1, 2]);
  });

  it("rejects unsupported values instead of silently dropping or coercing them", () => {
    const sparse = [1, 2];
    delete sparse[0];
    const cycle: MutableRecord = {};
    cycle.self = cycle;
    class ValueClass { public readonly value = 1; }
    class ArrayClass extends Array<number> {}
    const symbolKey = { valid: 1 } as Record<PropertyKey, unknown>;
    symbolKey[Symbol("hidden")] = 2;
    const extraArray = [1] as unknown[] & { extra?: number };
    extraArray.extra = 2;

    const unsupported: unknown[] = [
      undefined,
      { omitted: undefined },
      () => 1,
      Symbol("value"),
      1n,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      sparse,
      cycle,
      new Date(0),
      new Map(),
      new Set(),
      new ValueClass(),
      new ArrayClass(1),
      symbolKey,
      extraArray
    ];
    for (const value of unsupported) {
      expect(() => canonicalizePersistenceValue(value)).toThrowError(PersistenceCanonicalError);
    }

    expect(serializeCanonicalPersistenceValue(JSON.parse('{"__proto__":{"preserved":true}}')))
      .toBe('{"__proto__":{"preserved":true}}');
  });

  it("normalizes schema-declared unordered collections before save serialization", () => {
    const snapshots = createDefinitionResolutionFixture();
    const first = JSON.parse(JSON.stringify(createSaveGameEnvelopeV1Fixture())) as MutableRecord;
    first.discoveries = [
      { schemaVersion: 1, siteId: "site:zeta.0", discoveredAtTick: 2, data: { order: "z" } },
      { schemaVersion: 1, siteId: "site:alpha.0", discoveredAtTick: 1, data: { order: "a" } }
    ];
    const second = Object.fromEntries(Object.entries(first).reverse()) as MutableRecord;
    second.discoveries = [...first.discoveries].reverse();

    expect(serializeSaveGameEnvelopeV1(second, snapshots)).toBe(serializeSaveGameEnvelopeV1(first, snapshots));
    expect(createSaveGameSignature(second, snapshots)).toBe(createSaveGameSignature(first, snapshots));
  });

  it("roundtrips validated V1 saves to identical bytes and direct fnv1a32 signatures", () => {
    const snapshots = createDefinitionResolutionFixture();
    const save = createSaveGameEnvelopeV1Fixture();
    const serialized = serializeSaveGameEnvelopeV1(save, snapshots);
    const parsed = deserializeSaveGameEnvelopeV1(serialized, snapshots);
    const signature = createSaveGameSignature(parsed, snapshots);

    expect(serializeSaveGameEnvelopeV1(parsed, snapshots)).toBe(serialized);
    expect(signature).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
    expect(createPersistenceSignature(parsed)).toBe(signature);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.player.data)).toBe(true);

    const changed = JSON.parse(serialized) as MutableRecord;
    changed.player.data.credits += 1;
    expect(createSaveGameSignature(changed, snapshots)).not.toBe(signature);
  });

  it("validates save data before it can reach canonical bytes or a signature", () => {
    const invalid = JSON.parse(JSON.stringify(createSaveGameEnvelopeV1Fixture())) as MutableRecord;
    invalid.ships[0].currentMassKg = Number.NaN;
    expect(() => serializeSaveGameEnvelopeV1(invalid, createDefinitionResolutionFixture()))
      .toThrowError(PersistenceValidationError);

    expect(serializeCanonicalPersistenceValue({ ordered: ["b", "a"] }))
      .toBe('{"ordered":["b","a"]}');
  });
});
