import { hashAdaptiveCanonical } from "./canonical";
import { validateQuantumBounds } from "./coordinates";
import {
  ADAPTIVE_EDIT_SCHEMA_VERSION,
  ADAPTIVE_JOURNAL_SCHEMA_VERSION,
  type AdaptiveEditJournal,
  type AdaptiveEditOperation,
  type AdaptiveEditRecord,
  type QuantumSphere
} from "./types";
import {
  authorityRevision,
  deepFreeze,
  editSequence,
  fail,
  globalQuantumCoordinate,
  requireExactKeys,
  requirePlainRecord,
  stableAuthorityId
} from "./validation";
import { adaptiveDrainSteps, adaptiveDenseArraySteps, adaptiveMapSteps, adaptiveSortSteps,
  adaptiveFreezeArraySteps, type AdaptiveOwnedReserve } from "./validation";

export const ADAPTIVE_MAX_JOURNAL_RECORDS = 4_096;

export interface AdaptiveEditInput {
  readonly editId: string;
  readonly sequence: number;
  readonly expectedRegionRevision: number;
  readonly resultRegionRevision: number;
  readonly actorId: string;
  readonly sourceId: string;
  readonly operation: AdaptiveEditOperation;
  readonly sphere?: {
    readonly center: { readonly x: number; readonly y: number; readonly z: number };
    readonly radiusQuantum: number;
  };
  readonly box?: {
    readonly min: { readonly x: number; readonly y: number; readonly z: number };
    readonly max: { readonly x: number; readonly y: number; readonly z: number };
  };
  readonly materialId?: string;
  readonly semanticId?: string;
}

const operations: readonly AdaptiveEditOperation[] = Object.freeze([
  "SubtractSphere",
  "AddSphere",
  "SubtractBox",
  "AddBox",
  "SetMaterialBox"
]);

const createSphere = (value: NonNullable<AdaptiveEditInput["sphere"]>): QuantumSphere => {
  const sphereRecord = requirePlainRecord(value, "sphere");
  requireExactKeys(sphereRecord, ["center", "radiusQuantum"], "sphere");
  const centerRecord = requirePlainRecord(sphereRecord.center, "sphere/center");
  requireExactKeys(centerRecord, ["x", "y", "z"], "sphere/center");
  const radiusQuantum = globalQuantumCoordinate(value.radiusQuantum, "sphere/radiusQuantum");
  if (radiusQuantum <= 0) return fail("InvalidBounds", "sphere/radiusQuantum", "Sphere radius must be a positive quantum count.");
  return deepFreeze({
    center: deepFreeze({
      x: globalQuantumCoordinate(value.center.x, "sphere/center/x"),
      y: globalQuantumCoordinate(value.center.y, "sphere/center/y"),
      z: globalQuantumCoordinate(value.center.z, "sphere/center/z")
    }),
    radiusQuantum
  });
};

export const createAdaptiveEdit = (input: AdaptiveEditInput): AdaptiveEditRecord => {
  const inputRecord = requirePlainRecord(input, "edit");
  const optionalKeys = ["sphere", "box", "materialId", "semanticId"].filter((key) => Object.hasOwn(inputRecord, key));
  requireExactKeys(
    inputRecord,
    [
      "editId",
      "sequence",
      "expectedRegionRevision",
      "resultRegionRevision",
      "actorId",
      "sourceId",
      "operation",
      ...optionalKeys
    ],
    "edit"
  );
  for (const key of optionalKeys) {
    if (inputRecord[key] === undefined) {
      return fail("InvalidEditJournal", `edit/${key}`, "Present optional edit fields may not be undefined.");
    }
  }
  if (!operations.includes(input.operation)) return fail("InvalidEditJournal", "operation", "Unsupported edit operation.");
  const expectedRegionRevision = authorityRevision(input.expectedRegionRevision);
  const resultRegionRevision = authorityRevision(input.resultRegionRevision);
  if (resultRegionRevision !== expectedRegionRevision + 1) {
    return fail("InvalidEditJournal", "resultRegionRevision", "Each edit must advance the region revision exactly once.");
  }
  const sphereOperation = input.operation === "SubtractSphere" || input.operation === "AddSphere";
  if (sphereOperation !== (input.sphere !== undefined) || sphereOperation === (input.box !== undefined)) {
    return fail("InvalidEditJournal", "shape", "Each edit must contain exactly the shape required by its operation.");
  }
  if (input.operation === "SetMaterialBox" && input.materialId === undefined) {
    return fail("InvalidEditJournal", "materialId", "SetMaterialBox requires a material ID.");
  }
  if (
    (input.operation === "SubtractSphere" || input.operation === "SubtractBox") &&
    (input.materialId !== undefined || input.semanticId !== undefined)
  ) {
    return fail("InvalidEditJournal", "edit", "Subtract edits may not carry material or semantic assignments.");
  }
  const record: AdaptiveEditRecord = {
    schemaVersion: ADAPTIVE_EDIT_SCHEMA_VERSION,
    editId: stableAuthorityId(input.editId, "editId"),
    sequence: editSequence(input.sequence),
    expectedRegionRevision,
    resultRegionRevision,
    actorId: stableAuthorityId(input.actorId, "actorId"),
    sourceId: stableAuthorityId(input.sourceId, "sourceId"),
    operation: input.operation,
    ...(input.sphere === undefined ? {} : { sphere: createSphere(input.sphere) }),
    ...(input.box === undefined ? {} : { box: validateQuantumBounds(input.box) }),
    ...(input.materialId === undefined ? {} : { materialId: stableAuthorityId(input.materialId, "materialId") }),
    ...(input.semanticId === undefined ? {} : { semanticId: stableAuthorityId(input.semanticId, "semanticId") })
  };
  return deepFreeze(record);
};

const journalDigestPayload = (initialRegionRevision: number, records: readonly AdaptiveEditRecord[]): unknown => ({
  schemaVersion: ADAPTIVE_JOURNAL_SCHEMA_VERSION,
  initialRegionRevision,
  records
});

export const createAdaptiveEditJournal = (
  inputs: readonly (AdaptiveEditInput | AdaptiveEditRecord)[],
  initialRevisionValue = 0
): AdaptiveEditJournal => adaptiveDrainSteps(adaptiveEditJournalSteps(inputs, initialRevisionValue));

/** Module-only options: a higher owner supplies ONE borrowed reservation/hash lifetime. */
export type AdaptiveOwnedJournalOptions = Readonly<{
  reserve: AdaptiveOwnedReserve;
  hash: (payload: unknown) => Generator<void, string, void>;
}>;

export function* adaptiveEditJournalSteps(inputs: readonly (AdaptiveEditInput | AdaptiveEditRecord)[],
  initialRevisionValue = 0, owned?: AdaptiveOwnedJournalOptions): Generator<void, AdaptiveEditJournal, void> {
  const reserve = owned?.reserve;
  reserve?.(8_192);
  const inputRecords = (yield* adaptiveDenseArraySteps(inputs, "records", "InvalidEditJournal", {
    maximumLength: ADAPTIVE_MAX_JOURNAL_RECORDS
  }, reserve)) as (AdaptiveEditInput | AdaptiveEditRecord)[];
  const initialRegionRevision = authorityRevision(initialRevisionValue);
  const records = yield* adaptiveSortSteps(yield* adaptiveMapSteps(inputRecords, (input, index) => {
      reserve?.(8_192, true); // Fixed-schema reconstruction, identity/shape/string/descriptor coexistence.
      const inputRecord = requirePlainRecord(input, `records/${index}`);
      const optionalKeys = ["sphere", "box", "materialId", "semanticId"].filter((key) => Object.hasOwn(inputRecord, key));
      const hasSchemaVersion = Object.hasOwn(inputRecord, "schemaVersion");
      requireExactKeys(
        inputRecord,
        [
          ...(hasSchemaVersion ? ["schemaVersion"] : []),
          "editId",
          "sequence",
          "expectedRegionRevision",
          "resultRegionRevision",
          "actorId",
          "sourceId",
          "operation",
          ...optionalKeys
        ],
        `records/${index}`
      );
      if (hasSchemaVersion && inputRecord.schemaVersion !== ADAPTIVE_EDIT_SCHEMA_VERSION) {
        return fail("InvalidEditJournal", `records/${index}/schemaVersion`, "Unsupported edit schema.");
      }
      return createAdaptiveEdit({
        editId: input.editId,
        sequence: input.sequence,
        expectedRegionRevision: input.expectedRegionRevision,
        resultRegionRevision: input.resultRegionRevision,
        actorId: input.actorId,
        sourceId: input.sourceId,
        operation: input.operation,
        ...(input.sphere === undefined ? {} : { sphere: input.sphere }),
        ...(input.box === undefined ? {} : { box: input.box }),
        ...(input.materialId === undefined ? {} : { materialId: input.materialId }),
        ...(input.semanticId === undefined ? {} : { semanticId: input.semanticId })
      });
    }, reserve), (left, right) => left.sequence - right.sequence || (left.editId < right.editId ? -1 : left.editId > right.editId ? 1 : 0), reserve);
  reserve?.(64);
  const ids = new Set<string>();
  let revision = initialRegionRevision;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (ids.has(record.editId)) { return fail("InvalidEditJournal", `records/${index}/editId`, "Duplicate edit IDs are rejected."); }
    reserve?.(128);
    ids.add(record.editId);
    if (record.sequence !== index + 1) {
      return fail("InvalidEditJournal", `records/${index}/sequence`, "Edit sequences must be unique and contiguous from one.");
    }
    if (record.expectedRegionRevision !== revision) {
      return fail("InvalidEditJournal", `records/${index}/expectedRegionRevision`, "Edit revision conflicts are rejected.");
    }
    revision = record.resultRegionRevision;
    if (reserve !== undefined) { yield; }
  }
  let copied: AdaptiveEditRecord[];
  if (reserve === undefined) { copied = [...records]; }
  else {
    reserve(64 + records.length * 128, true);
    copied = [];
    for (const record of records) { copied.push(record); yield; }
  }
  const frozenRecords = yield* adaptiveFreezeArraySteps(copied, reserve);
  reserve?.(1_024, true);
  const payload = journalDigestPayload(initialRegionRevision, frozenRecords);
  const digest = owned === undefined ? hashAdaptiveCanonical(payload) : yield* owned.hash(Object.freeze(payload));
  const result: AdaptiveEditJournal = {
    schemaVersion: ADAPTIVE_JOURNAL_SCHEMA_VERSION,
    initialRegionRevision,
    revision,
    records: frozenRecords,
    digest
  };
  return reserve === undefined ? deepFreeze(result) : Object.freeze(result);
}

export const appendAdaptiveEdit = (journal: AdaptiveEditJournal, input: AdaptiveEditInput): AdaptiveEditJournal => {
  const validated = validateAdaptiveEditJournal(journal);
  return createAdaptiveEditJournal([...validated.records, input], validated.initialRegionRevision);
};

export const validateAdaptiveEditJournal = (journal: AdaptiveEditJournal): AdaptiveEditJournal =>
  adaptiveDrainSteps(adaptiveValidateEditJournalSteps(journal));

export function* adaptiveValidateEditJournalSteps(journal: AdaptiveEditJournal,
  owned?: AdaptiveOwnedJournalOptions): Generator<void, AdaptiveEditJournal, void> {
  owned?.reserve(1_024);
  const record = requirePlainRecord(journal, "journal");
  requireExactKeys(record, ["schemaVersion", "initialRegionRevision", "revision", "records", "digest"], "journal");
  if (record.schemaVersion !== ADAPTIVE_JOURNAL_SCHEMA_VERSION) {
    return fail("InvalidEditJournal", "journal", "Malformed or unsupported edit journal.");
  }
  const journalRecords = (yield* adaptiveDenseArraySteps(
    record.records,
    "journal/records",
    "InvalidEditJournal",
    { maximumLength: ADAPTIVE_MAX_JOURNAL_RECORDS }, owned?.reserve
  )) as readonly AdaptiveEditRecord[];
  const rebuilt = yield* adaptiveEditJournalSteps(journalRecords, record.initialRegionRevision as number, owned);
  if (rebuilt.revision !== authorityRevision(record.revision as number) || rebuilt.digest !== record.digest) {
    return fail("InvalidEditJournal", "journal", "Journal revision or digest does not match its records.");
  }
  return rebuilt;
}
