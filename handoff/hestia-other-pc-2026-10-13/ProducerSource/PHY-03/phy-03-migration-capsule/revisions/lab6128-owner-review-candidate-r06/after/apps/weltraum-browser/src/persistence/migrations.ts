import type { JsonObject } from "./types";
import { cloneJsonObject, deepFreeze, isPlainObject } from "./validation";

export type MigrationErrorCode =
  | "INVALID_MIGRATION_ID"
  | "INVALID_MIGRATION_VERSION"
  | "DUPLICATE_MIGRATION_ID"
  | "DUPLICATE_MIGRATION_SOURCE"
  | "NON_CONSECUTIVE_MIGRATION"
  | "MIGRATION_GAP"
  | "MIGRATION_DOWNGRADE"
  | "MIGRATION_FUTURE_VERSION"
  | "MISSING_MIGRATION_PATH"
  | "INVALID_MIGRATION_STAGE";

export class MigrationError extends Error {
  public constructor(
    public readonly code: MigrationErrorCode,
    message: string,
    public readonly migrationId: string | null = null
  ) {
    super(message);
    this.name = "MigrationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface VersionedMigrationRecord extends JsonObject {
  readonly schemaVersion: number;
}

export type MigrationStageValidator = (value: unknown) => VersionedMigrationRecord;

export interface MigrationStep {
  readonly migrationId: string;
  readonly sourceVersion: number;
  readonly targetVersion: number;
  readonly migrate: (input: VersionedMigrationRecord) => unknown;
  readonly validateSource: MigrationStageValidator;
  readonly validateTarget: MigrationStageValidator;
}

export interface MigrationRegistry {
  readonly initialVersion: number;
  readonly maximumVersion: number;
  readonly migrations: readonly MigrationStep[];
}

export interface MigrationResult<TRecord extends VersionedMigrationRecord = VersionedMigrationRecord> {
  readonly value: TRecord;
  readonly appliedMigrationIds: readonly string[];
}

const assertVersion = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MigrationError("INVALID_MIGRATION_VERSION", `${label} must be a nonnegative safe integer.`);
  }
};

const assertMigrationId = (migrationId: string): void => {
  if (typeof migrationId !== "string" || migrationId.length === 0 || migrationId.trim() !== migrationId) {
    throw new MigrationError("INVALID_MIGRATION_ID", "Migration IDs must be nonempty strings without surrounding whitespace.");
  }
};

const freezeRegistry = (
  initialVersion: number,
  maximumVersion: number,
  migrations: readonly MigrationStep[]
): MigrationRegistry =>
  Object.freeze({
    initialVersion,
    maximumVersion,
    migrations: Object.freeze(migrations.map((migration) => Object.freeze({ ...migration })))
  });

export const createMigrationRegistry = (initialVersion: number, maximumVersion: number): MigrationRegistry => {
  assertVersion(initialVersion, "Initial version");
  assertVersion(maximumVersion, "Maximum version");
  if (maximumVersion < initialVersion) {
    throw new MigrationError("INVALID_MIGRATION_VERSION", "Maximum version must not precede the initial version.");
  }
  return freezeRegistry(initialVersion, maximumVersion, []);
};

/** Returns a new registry; the supplied registry and step are never mutated. */
export const registerMigration = (registry: MigrationRegistry, step: MigrationStep): MigrationRegistry => {
  assertMigrationId(step.migrationId);
  assertVersion(step.sourceVersion, "Migration source version");
  assertVersion(step.targetVersion, "Migration target version");
  if (step.targetVersion !== step.sourceVersion + 1) {
    throw new MigrationError(
      "NON_CONSECUTIVE_MIGRATION",
      "A migration target must be exactly one version after its source.",
      step.migrationId
    );
  }
  if (step.sourceVersion < registry.initialVersion || step.targetVersion > registry.maximumVersion) {
    throw new MigrationError(
      "MIGRATION_FUTURE_VERSION",
      "Migration versions lie outside the registry bounds.",
      step.migrationId
    );
  }
  if (registry.migrations.some((migration) => migration.migrationId === step.migrationId)) {
    throw new MigrationError("DUPLICATE_MIGRATION_ID", "Migration ID is already registered.", step.migrationId);
  }
  if (registry.migrations.some((migration) => migration.sourceVersion === step.sourceVersion)) {
    throw new MigrationError(
      "DUPLICATE_MIGRATION_SOURCE",
      "Only one migration may be registered for a source version.",
      step.migrationId
    );
  }
  const expectedSource = registry.migrations.length === 0
    ? registry.initialVersion
    : registry.migrations[registry.migrations.length - 1]!.targetVersion;
  if (step.sourceVersion !== expectedSource) {
    throw new MigrationError("MIGRATION_GAP", "Migrations must be registered as one consecutive path.", step.migrationId);
  }
  return freezeRegistry(registry.initialVersion, registry.maximumVersion, [...registry.migrations, step]);
};

const assertRequestedVersions = (registry: MigrationRegistry, sourceVersion: number, targetVersion: number): void => {
  assertVersion(sourceVersion, "Source version");
  assertVersion(targetVersion, "Target version");
  if (targetVersion < sourceVersion) {
    throw new MigrationError("MIGRATION_DOWNGRADE", "Migration downgrades are not supported.");
  }
  if (
    sourceVersion < registry.initialVersion
    || sourceVersion > registry.maximumVersion
    || targetVersion > registry.maximumVersion
  ) {
    throw new MigrationError("MIGRATION_FUTURE_VERSION", "Requested versions lie outside the registry bounds.");
  }
};

/** Resolves an exact consecutive path and never skips an unknown stage. */
export const validateMigrationPath = (
  registry: MigrationRegistry,
  sourceVersion: number,
  targetVersion: number
): readonly MigrationStep[] => {
  assertRequestedVersions(registry, sourceVersion, targetVersion);
  const path: MigrationStep[] = [];
  for (let version = sourceVersion; version < targetVersion; version += 1) {
    const step = registry.migrations.find((candidate) => candidate.sourceVersion === version);
    if (step === undefined || step.targetVersion !== version + 1) {
      throw new MigrationError("MISSING_MIGRATION_PATH", `No consecutive migration is registered from version ${version}.`);
    }
    path.push(step);
  }
  return Object.freeze([...path]);
};

const readRecordVersion = (value: unknown): number => {
  if (!isPlainObject(value)) {
    throw new MigrationError("INVALID_MIGRATION_STAGE", "Migration input must be a plain JSON object.");
  }
  const version = value.schemaVersion;
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) {
    throw new MigrationError("INVALID_MIGRATION_STAGE", "Migration input must have a nonnegative integer schemaVersion.");
  }
  return version;
};

const validateStage = (
  validator: MigrationStageValidator,
  value: unknown,
  expectedVersion: number,
  migrationId: string | null
): VersionedMigrationRecord => {
  try {
    const frozenCandidate = deepFreeze(cloneJsonObject(value, "")) as VersionedMigrationRecord;
    const validated = validator(frozenCandidate);
    const clone = cloneJsonObject(validated, "") as VersionedMigrationRecord;
    if (readRecordVersion(clone) !== expectedVersion) {
      throw new MigrationError("INVALID_MIGRATION_STAGE", "A migration stage returned the wrong schemaVersion.", migrationId);
    }
    return deepFreeze(clone) as VersionedMigrationRecord;
  } catch (error) {
    if (error instanceof MigrationError && error.code === "INVALID_MIGRATION_STAGE") {
      throw error;
    }
    throw new MigrationError("INVALID_MIGRATION_STAGE", "A migration stage failed validation.", migrationId);
  }
};

const validatorForVersion = (registry: MigrationRegistry, version: number): MigrationStageValidator | undefined => {
  const source = registry.migrations.find((step) => step.sourceVersion === version);
  if (source !== undefined) {
    return source.validateSource;
  }
  return registry.migrations.find((step) => step.targetVersion === version)?.validateTarget;
};

/** Migrates a caller-owned record through validated, deeply frozen stage snapshots. */
export const migrateSave = <TRecord extends VersionedMigrationRecord = VersionedMigrationRecord>(
  registry: MigrationRegistry,
  input: unknown,
  targetVersion: number
): MigrationResult<TRecord> => {
  const sourceVersion = readRecordVersion(input);
  const path = validateMigrationPath(registry, sourceVersion, targetVersion);
  const initialValidator = validatorForVersion(registry, sourceVersion);
  if (initialValidator === undefined) {
    throw new MigrationError("MISSING_MIGRATION_PATH", `No validator is registered for version ${sourceVersion}.`);
  }
  let current = validateStage(initialValidator, input, sourceVersion, path[0]?.migrationId ?? null);
  const appliedMigrationIds: string[] = [];

  for (const step of path) {
    current = validateStage(step.validateSource, current, step.sourceVersion, step.migrationId);
    let transformed: unknown;
    try {
      transformed = step.migrate(current);
    } catch {
      throw new MigrationError("INVALID_MIGRATION_STAGE", "A migration transform failed.", step.migrationId);
    }
    current = validateStage(step.validateTarget, transformed, step.targetVersion, step.migrationId);
    appliedMigrationIds.push(step.migrationId);
  }

  return deepFreeze({
    value: current as TRecord,
    appliedMigrationIds: Object.freeze([...appliedMigrationIds])
  }) as MigrationResult<TRecord>;
};
