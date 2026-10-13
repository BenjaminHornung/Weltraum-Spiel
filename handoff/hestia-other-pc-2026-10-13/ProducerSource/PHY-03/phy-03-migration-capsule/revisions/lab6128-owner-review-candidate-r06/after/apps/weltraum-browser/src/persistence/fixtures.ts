import { createStableFixtureId } from "./ids";
import {
  createMigrationRegistry,
  registerMigration,
  type MigrationRegistry,
  type VersionedMigrationRecord
} from "./migrations";
import { validateSaveGameEnvelopeV1 } from "./saveSchema";
import { createUniverseClock } from "./time";
import type { DefinitionResolutionSnapshot, DefinitionsVersionReference, SaveGameEnvelopeV1 } from "./types";
import {
  assertAllowedFields,
  cloneJsonObject,
  deepFreeze,
  failPersistenceValidation,
  readNonEmptyString,
  readPlainObject,
  readRequired
} from "./validation";

export const PERSISTENCE_FIXTURE_DEFINITION_DOMAIN = "ships";
export const PERSISTENCE_FIXTURE_DEFINITIONS_VERSION = "fixture-v1";

export const createDefinitionResolutionFixture = (): readonly DefinitionResolutionSnapshot[] =>
  deepFreeze([
    {
      domain: PERSISTENCE_FIXTURE_DEFINITION_DOMAIN,
      version: PERSISTENCE_FIXTURE_DEFINITIONS_VERSION,
      definitionIds: [createStableFixtureId("ship-variant", "scout", 0)]
    }
  ]);

/** Creates a complete deterministic V1 save without retaining caller-owned state. */
export const createSaveGameEnvelopeV1Fixture = (): SaveGameEnvelopeV1 => {
  const definitionId = createStableFixtureId("ship-variant", "scout", 0);
  const definitionsVersionRef: DefinitionsVersionReference = {
    domain: PERSISTENCE_FIXTURE_DEFINITION_DOMAIN,
    version: PERSISTENCE_FIXTURE_DEFINITIONS_VERSION
  };
  const shipId = createStableFixtureId("ship", "scout", 0);
  const missionId = createStableFixtureId("mission", "intro", 0);

  return validateSaveGameEnvelopeV1(
    {
      schemaVersion: 1,
      gameVersion: "fixture-v1",
      saveId: createStableFixtureId("save", "primary", 0),
      universeTime: createUniverseClock(),
      definitionsVersionRefs: [definitionsVersionRef],
      player: {
        playerId: createStableFixtureId("player", "captain", 0),
        activeShipId: shipId,
        activeMissionRef: missionId,
        data: { credits: 1000 }
      },
      ships: [
        {
          objectId: shipId,
          ownerId: createStableFixtureId("player", "captain", 0),
          definitionId,
          frameId: "frame:sol",
          positionMeters: { x: 1, y: 2, z: 3 },
          velocityMetersPerSecond: { x: 4, y: 5, z: 6 },
          angularVelocity: { x: 0, y: 0.1, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
          epochSeconds: 0,
          currentMassKg: 1000,
          dryMassKg: 800,
          fuelMassKg: 200,
          cargoContainerIds: [createStableFixtureId("container", "cargo", 0)],
          damageStateRef: null,
          powerStateRef: "power:scout.0",
          activePlanRef: null,
          activeMissionRef: missionId,
          simulationMode: "Active"
        }
      ],
      drones: [],
      stations: [],
      bases: [],
      missions: [
        {
          schemaVersion: 1,
          instanceId: missionId,
          definitionRef: null,
          data: { phase: "Briefed" }
        }
      ],
      encounters: [],
      discoveries: [],
      worldEvents: { events: [] },
      metadata: {
        createdAtTick: 0,
        updatedAtTick: 0,
        provenance: { fixture: true }
      }
    },
    createDefinitionResolutionFixture()
  );
};

export const definitionResolutionFixture = createDefinitionResolutionFixture();
export const saveGameEnvelopeV1Fixture = createSaveGameEnvelopeV1Fixture();

export interface NeutralMigrationFixtureV1 extends VersionedMigrationRecord {
  readonly schemaVersion: 1;
  readonly fixtureId: string;
  readonly data: { readonly value: string };
}

export interface NeutralMigrationFixtureV2 extends VersionedMigrationRecord {
  readonly schemaVersion: 2;
  readonly fixtureId: string;
  readonly data: { readonly value: string };
  readonly migrated: true;
}

export const NEUTRAL_FIXTURE_MIGRATION_ID = "fixture.neutral.v1-to-v2";

const validateNeutralData = (value: unknown): { readonly value: string } => {
  const object = readPlainObject(value, "/data");
  assertAllowedFields(object, "/data", ["value"]);
  return { value: readNonEmptyString(readRequired(object, "value", "/data"), "/data/value") };
};

export const validateNeutralMigrationFixtureV1 = (value: unknown): NeutralMigrationFixtureV1 => {
  const object = readPlainObject(value, "");
  assertAllowedFields(object, "", ["schemaVersion", "fixtureId", "data"]);
  if (readRequired(object, "schemaVersion", "") !== 1) {
    return failPersistenceValidation("UNSUPPORTED_SCHEMA_VERSION", "/schemaVersion", "Expected neutral fixture version 1.");
  }
  return deepFreeze({
    schemaVersion: 1,
    fixtureId: readNonEmptyString(readRequired(object, "fixtureId", ""), "/fixtureId"),
    data: validateNeutralData(readRequired(object, "data", ""))
  }) as NeutralMigrationFixtureV1;
};

export const validateNeutralMigrationFixtureV2 = (value: unknown): NeutralMigrationFixtureV2 => {
  const object = readPlainObject(value, "");
  assertAllowedFields(object, "", ["schemaVersion", "fixtureId", "data", "migrated"]);
  if (readRequired(object, "schemaVersion", "") !== 2 || readRequired(object, "migrated", "") !== true) {
    return failPersistenceValidation("UNSUPPORTED_SCHEMA_VERSION", "/schemaVersion", "Expected neutral fixture version 2.");
  }
  return deepFreeze({
    schemaVersion: 2,
    fixtureId: readNonEmptyString(readRequired(object, "fixtureId", ""), "/fixtureId"),
    data: validateNeutralData(readRequired(object, "data", "")),
    migrated: true
  }) as NeutralMigrationFixtureV2;
};

export const createNeutralMigrationFixtureV1 = (): NeutralMigrationFixtureV1 =>
  validateNeutralMigrationFixtureV1({ schemaVersion: 1, fixtureId: "neutral-fixture", data: { value: "original" } });

/** Isolated fixture registry; it is intentionally unrelated to SaveGameEnvelopeV1. */
export const createNeutralFixtureMigrationRegistry = (): MigrationRegistry =>
  registerMigration(createMigrationRegistry(1, 2), {
    migrationId: NEUTRAL_FIXTURE_MIGRATION_ID,
    sourceVersion: 1,
    targetVersion: 2,
    validateSource: validateNeutralMigrationFixtureV1,
    validateTarget: validateNeutralMigrationFixtureV2,
    migrate: (input) => ({
      ...cloneJsonObject(input, ""),
      schemaVersion: 2,
      migrated: true
    })
  });
