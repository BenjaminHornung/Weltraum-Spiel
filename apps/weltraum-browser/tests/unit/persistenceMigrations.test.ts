import { describe, expect, it } from "vitest";
import {
  MigrationError,
  NEUTRAL_FIXTURE_MIGRATION_ID,
  createMigrationRegistry,
  createNeutralFixtureMigrationRegistry,
  createNeutralMigrationFixtureV1,
  migrateSave,
  registerMigration,
  validateMigrationPath,
  validateNeutralMigrationFixtureV1,
  validateNeutralMigrationFixtureV2,
  type NeutralMigrationFixtureV2
} from "../../src/persistence";

describe("persistence migrations", () => {
  it("migrates the isolated neutral fixture through the explicit v1-to-v2 stage", () => {
    const input = createNeutralMigrationFixtureV1();
    const inputBytes = JSON.stringify(input);
    const result = migrateSave<NeutralMigrationFixtureV2>(createNeutralFixtureMigrationRegistry(), input, 2);

    expect(result.value).toEqual({
      schemaVersion: 2,
      fixtureId: "neutral-fixture",
      data: { value: "original" },
      migrated: true
    });
    expect(result.appliedMigrationIds).toEqual([NEUTRAL_FIXTURE_MIGRATION_ID]);
    expect(JSON.stringify(input)).toBe(inputBytes);
    expect(result.value).not.toBe(input);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.data)).toBe(true);
  });

  it("rejects nonconsecutive registration, duplicate IDs/sources, gaps, and out-of-bound versions", () => {
    const registry = createNeutralFixtureMigrationRegistry();
    const step = registry.migrations[0]!;

    expect(() => registerMigration(createMigrationRegistry(1, 3), { ...step, targetVersion: 3 }))
      .toThrowError(expect.objectContaining({ code: "NON_CONSECUTIVE_MIGRATION" }));
    expect(() => registerMigration(registry, step))
      .toThrowError(expect.objectContaining({ code: "DUPLICATE_MIGRATION_ID" }));
    expect(() => registerMigration(registry, { ...step, migrationId: "fixture.duplicate-source" }))
      .toThrowError(expect.objectContaining({ code: "DUPLICATE_MIGRATION_SOURCE" }));
    expect(() => registerMigration(createMigrationRegistry(1, 3), {
      ...step,
      migrationId: "fixture.gap.v2-to-v3",
      sourceVersion: 2,
      targetVersion: 3
    })).toThrowError(expect.objectContaining({ code: "MIGRATION_GAP" }));
    expect(() => registerMigration(createMigrationRegistry(1, 1), step))
      .toThrowError(expect.objectContaining({ code: "MIGRATION_FUTURE_VERSION" }));
  });

  it("fails closed for missing paths, downgrades, and future bounds", () => {
    const partial = registerMigration(createMigrationRegistry(1, 3), createNeutralFixtureMigrationRegistry().migrations[0]!);

    expect(() => validateMigrationPath(partial, 1, 3))
      .toThrowError(expect.objectContaining({ code: "MISSING_MIGRATION_PATH" }));
    expect(() => validateMigrationPath(partial, 2, 1))
      .toThrowError(expect.objectContaining({ code: "MIGRATION_DOWNGRADE" }));
    expect(() => validateMigrationPath(partial, 1, 4))
      .toThrowError(expect.objectContaining({ code: "MIGRATION_FUTURE_VERSION" }));
  });

  it("deep-freezes transform input, preserves caller state, and validates every produced stage", () => {
    const input = JSON.parse(JSON.stringify(createNeutralMigrationFixtureV1())) as Record<string, any>;
    const originalBytes = JSON.stringify(input);
    const base = createMigrationRegistry(1, 2);
    const mutating = registerMigration(base, {
      migrationId: "fixture.mutating.v1-to-v2",
      sourceVersion: 1,
      targetVersion: 2,
      validateSource: validateNeutralMigrationFixtureV1,
      validateTarget: validateNeutralMigrationFixtureV2,
      migrate: (stage) => {
        (stage.data as Record<string, unknown>).value = "mutated";
        return { ...stage, schemaVersion: 2, migrated: true };
      }
    });

    expect(() => migrateSave(mutating, input, 2)).toThrowError(MigrationError);
    expect(JSON.stringify(input)).toBe(originalBytes);

    const invalidOutput = registerMigration(base, {
      migrationId: "fixture.invalid-output.v1-to-v2",
      sourceVersion: 1,
      targetVersion: 2,
      validateSource: validateNeutralMigrationFixtureV1,
      validateTarget: validateNeutralMigrationFixtureV2,
      migrate: (stage) => ({ ...stage, schemaVersion: 2 })
    });
    expect(() => migrateSave(invalidOutput, input, 2))
      .toThrowError(expect.objectContaining({ code: "INVALID_MIGRATION_STAGE" }));
  });
});
