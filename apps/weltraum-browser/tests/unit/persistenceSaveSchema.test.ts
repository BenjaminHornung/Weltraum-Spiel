import { describe, expect, it } from "vitest";
import {
  PersistenceValidationError,
  createDefinitionResolutionFixture,
  createSaveGameEnvelopeV1Fixture,
  createStableFixtureId,
  validateSaveGameEnvelopeV1
} from "../../src/persistence";

type MutableRecord = Record<string, any>;

const mutableFixture = (): MutableRecord => JSON.parse(JSON.stringify(createSaveGameEnvelopeV1Fixture())) as MutableRecord;

const validationError = (operation: () => unknown): PersistenceValidationError => {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(PersistenceValidationError);
    return error as PersistenceValidationError;
  }
  throw new Error("Expected PersistenceValidationError.");
};

describe("persistence SaveGameEnvelopeV1", () => {
  it("validates finite mobile state, definition-only references, and immutable defensive output", () => {
    const source = mutableFixture();
    const validated = validateSaveGameEnvelopeV1(source, createDefinitionResolutionFixture());
    source.player.data.credits = -1;
    source.ships[0].positionMeters.x = 999;

    expect(validated.player.data).toEqual({ credits: 1000 });
    expect(validated.ships[0]?.positionMeters.x).toBe(1);
    expect(validated.ships[0]?.definitionId).toBe("ship-variant:scout.0");
    expect(validated.ships[0]).not.toHaveProperty("definitionRef");
    expect(JSON.stringify(validated)).not.toContain("displayName");
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated.ships)).toBe(true);
    expect(Object.isFrozen(validated.ships[0]?.positionMeters)).toBe(true);
  });

  it("rejects unknown fields and future schemas before returning domain state", () => {
    const future = { unexpected: true, ...mutableFixture(), schemaVersion: 2 };
    const futureError = validationError(() => validateSaveGameEnvelopeV1(future, createDefinitionResolutionFixture()));
    expect(futureError.code).toBe("UNSUPPORTED_FUTURE_SCHEMA_VERSION");
    expect(futureError.path).toBe("/schemaVersion");

    const unknown = mutableFixture();
    unknown.player.displayName = "Not persisted";
    const unknownError = validationError(() => validateSaveGameEnvelopeV1(unknown, createDefinitionResolutionFixture()));
    expect(unknownError.code).toBe("UNKNOWN_FIELD");
    expect(unknownError.path).toBe("/player/displayName");

    const legacyMobileShape = mutableFixture();
    legacyMobileShape.ships[0].definitionRef = {
      domain: "ships",
      definitionId: legacyMobileShape.ships[0].definitionId,
      definitionsVersionRef: { domain: "ships", version: "fixture-v1" }
    };
    delete legacyMobileShape.ships[0].definitionId;
    const legacyError = validationError(() =>
      validateSaveGameEnvelopeV1(legacyMobileShape, createDefinitionResolutionFixture())
    );
    expect(legacyError).toMatchObject({ code: "UNKNOWN_FIELD", path: "/ships/0/definitionRef" });
  });

  it("rejects duplicate owned IDs and unresolved active player references", () => {
    const duplicate = mutableFixture();
    duplicate.ships.push({ ...duplicate.ships[0] });
    const duplicateError = validationError(() =>
      validateSaveGameEnvelopeV1(duplicate, createDefinitionResolutionFixture())
    );
    expect(duplicateError.code).toBe("DUPLICATE_ID");
    expect(duplicateError.path).toBe("/ships/1/objectId");

    const missingShip = mutableFixture();
    missingShip.player.activeShipId = createStableFixtureId("ship", "missing", 0);
    const referenceError = validationError(() =>
      validateSaveGameEnvelopeV1(missingShip, createDefinitionResolutionFixture())
    );
    expect(referenceError).toMatchObject({ code: "UNKNOWN_REFERENCE", path: "/player/activeShipId" });
  });

  it("reports missing definitions and version mismatches at deterministic JSON Pointer paths", () => {
    const save = mutableFixture();
    const missingDefinition = createDefinitionResolutionFixture().map((snapshot) => ({ ...snapshot, definitionIds: [] }));
    const missingError = validationError(() => validateSaveGameEnvelopeV1(save, missingDefinition));
    expect(missingError).toMatchObject({ code: "MISSING_DEFINITION", path: "/ships/0/definitionId" });

    const missingVersionSave = mutableFixture();
    missingVersionSave.definitionsVersionRefs = [];
    const missingVersionError = validationError(() =>
      validateSaveGameEnvelopeV1(missingVersionSave, createDefinitionResolutionFixture())
    );
    expect(missingVersionError).toMatchObject({
      code: "MISSING_DEFINITIONS_VERSION",
      path: "/ships/0/definitionId"
    });

    const mismatch = createDefinitionResolutionFixture().map((snapshot) => ({ ...snapshot, version: "fixture-v2" }));
    const mismatchError = validationError(() => validateSaveGameEnvelopeV1(save, mismatch));
    expect(mismatchError).toMatchObject({
      code: "DEFINITIONS_VERSION_MISMATCH",
      path: "/ships/0/definitionId"
    });

    const ambiguousSnapshots = [
      ...createDefinitionResolutionFixture(),
      {
        domain: "alternate-ships",
        version: "fixture-v1",
        definitionIds: [createStableFixtureId("ship-variant", "scout", 0)]
      }
    ];
    const ambiguityError = validationError(() => validateSaveGameEnvelopeV1(save, ambiguousSnapshots));
    expect(ambiguityError).toMatchObject({ code: "DUPLICATE_ID", path: "/ships/0/definitionId" });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects nonfinite mobile numeric state: %s",
    (invalid) => {
      const save = mutableFixture();
      save.ships[0].velocityMetersPerSecond.y = invalid;
      const error = validationError(() => validateSaveGameEnvelopeV1(save, createDefinitionResolutionFixture()));
      expect(error).toMatchObject({ code: "INVALID_NUMBER", path: "/ships/0/velocityMetersPerSecond/y" });
    }
  );

  it("rejects nonfinite and zero orientation quaternions", () => {
    const nonfinite = mutableFixture();
    nonfinite.ships[0].orientation.w = Number.POSITIVE_INFINITY;
    expect(validationError(() => validateSaveGameEnvelopeV1(nonfinite, createDefinitionResolutionFixture()))).toMatchObject({
      code: "INVALID_NUMBER",
      path: "/ships/0/orientation/w"
    });

    const zero = mutableFixture();
    zero.ships[0].orientation = { x: 0, y: 0, z: 0, w: 0 };
    expect(validationError(() => validateSaveGameEnvelopeV1(zero, createDefinitionResolutionFixture()))).toMatchObject({
      code: "INVALID_VALUE",
      path: "/ships/0/orientation"
    });
  });

  it("keeps external definition snapshots and mutable save state independent", () => {
    const snapshots = createDefinitionResolutionFixture();
    const save = mutableFixture();
    save.player.data = { flags: ["started"] };
    const validated = validateSaveGameEnvelopeV1(save, snapshots);

    expect(validated.player.data).toEqual({ flags: ["started"] });
    expect(snapshots).toEqual(createDefinitionResolutionFixture());
    expect(JSON.stringify(validated)).not.toContain("definitionIds");
  });
});
