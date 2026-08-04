export const PREPARED_STRUCTURAL_FIRE_WIRE_SCHEMA_VERSION =
  "prepared-structural-fire-wire-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_PAGE_SCHEMA_VERSION =
  "prepared-structural-fire-page-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_LOGICAL_VIEW_ROOT_SCHEMA_VERSION =
  "prepared-structural-fire-logical-view-root-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_PHYSICAL_PAGE_ROOT_SCHEMA_VERSION =
  "prepared-structural-fire-physical-page-root-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_SEED_MANIFEST_SCHEMA_VERSION =
  "prepared-structural-fire-seed-manifest-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_RESULT_MANIFEST_SCHEMA_VERSION =
  "prepared-structural-fire-result-manifest-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_COMMAND_SCHEMA_VERSION =
  "prepared-structural-fire-command-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_REQUEST_SCHEMA_VERSION =
  "prepared-structural-fire-request-v2" as const;
export const PREPARED_STRUCTURAL_FIRE_BODY_PLAN_SCHEMA_VERSION =
  "prepared-structural-fire-body-plan-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_COLLISION_RESULT_SCHEMA_VERSION =
  "prepared-structural-fire-collision-result-v1" as const;
export const PREPARED_DERIVATION_TRANSACTION_SCHEMA_VERSION =
  "prepared-derivation-transaction-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_RESULT_RECEIPT_SCHEMA_VERSION =
  "prepared-structural-fire-result-receipt-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_CONTINUATION_SCHEMA_VERSION =
  "prepared-structural-fire-continuation-v1" as const;
export const PREPARED_STRUCTURAL_FIRE_READY_SCHEMA_VERSION =
  "prepared-structural-fire-ready-v1" as const;

export const PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION_V2 = 2 as const;
export const PREPARED_STRUCTURAL_FIRE_PAGE_BYTES = 16_777_216 as const;
export const PREPARED_STRUCTURAL_FIRE_RETAINED_IN_FLIGHT_BYTES = 67_108_864 as const;
export const PREPARED_STRUCTURAL_FIRE_ITEM_FRAGMENT_BYTES = 1_048_576 as const;

export type PreparedStructuralFireHash = `fnv1a64-v1:${string}`;
export type PreparedStructuralFireDirection = "Seed" | "PreparedResult";
export type PreparedStructuralFireCardinality = "Singleton" | "OrderedSet";

export const PREPARED_STRUCTURAL_FIRE_SEED_VIEW_NAMES = [
  "seed.authority",
  "seed.collision",
  "seed.existingBodySourceFacts",
  "seed.physicsImmutable",
  "seed.physicsDynamicState"
] as const;

export const PREPARED_STRUCTURAL_FIRE_RESULT_VIEW_NAMES = [
  "result.damageResult",
  "result.detachedFacts",
  "result.bodyPlan",
  "result.transferResult",
  "result.finalAuthority",
  "result.authorityTransfer",
  "result.collision",
  "result.transition",
  "result.work"
] as const;

export type PreparedStructuralFireSeedViewName =
  (typeof PREPARED_STRUCTURAL_FIRE_SEED_VIEW_NAMES)[number];
export type PreparedStructuralFireResultViewName =
  (typeof PREPARED_STRUCTURAL_FIRE_RESULT_VIEW_NAMES)[number];
export type PreparedStructuralFireLogicalViewName =
  | PreparedStructuralFireSeedViewName
  | PreparedStructuralFireResultViewName;

export interface PreparedStructuralFireLogicalViewDefinition {
  readonly name: PreparedStructuralFireLogicalViewName;
  readonly direction: PreparedStructuralFireDirection;
  readonly cardinality: PreparedStructuralFireCardinality;
}

export const PREPARED_STRUCTURAL_FIRE_LOGICAL_VIEW_DEFINITIONS:
readonly PreparedStructuralFireLogicalViewDefinition[] = Object.freeze([
  { name: "seed.authority", direction: "Seed", cardinality: "Singleton" },
  { name: "seed.collision", direction: "Seed", cardinality: "Singleton" },
  { name: "seed.existingBodySourceFacts", direction: "Seed", cardinality: "OrderedSet" },
  { name: "seed.physicsImmutable", direction: "Seed", cardinality: "OrderedSet" },
  { name: "seed.physicsDynamicState", direction: "Seed", cardinality: "OrderedSet" },
  { name: "result.damageResult", direction: "PreparedResult", cardinality: "Singleton" },
  { name: "result.detachedFacts", direction: "PreparedResult", cardinality: "OrderedSet" },
  { name: "result.bodyPlan", direction: "PreparedResult", cardinality: "OrderedSet" },
  { name: "result.transferResult", direction: "PreparedResult", cardinality: "OrderedSet" },
  { name: "result.finalAuthority", direction: "PreparedResult", cardinality: "Singleton" },
  { name: "result.authorityTransfer", direction: "PreparedResult", cardinality: "OrderedSet" },
  { name: "result.collision", direction: "PreparedResult", cardinality: "Singleton" },
  { name: "result.transition", direction: "PreparedResult", cardinality: "Singleton" },
  { name: "result.work", direction: "PreparedResult", cardinality: "Singleton" }
]);

export interface PreparedStructuralFireCanonicalItem {
  readonly key: string;
  readonly payload: unknown;
}

export interface PreparedStructuralFireCanonicalItemRecord {
  readonly itemByteLength: number;
  readonly itemHash: PreparedStructuralFireHash;
  readonly key: string;
  readonly payload: unknown;
}

export interface PreparedStructuralFireEncodedItem {
  readonly record: PreparedStructuralFireCanonicalItemRecord;
  readonly bytes: Uint8Array;
}

export interface PreparedStructuralFireLogicalViewDescriptor {
  readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_LOGICAL_VIEW_ROOT_SCHEMA_VERSION;
  readonly viewOrdinal: number;
  readonly logicalViewName: PreparedStructuralFireLogicalViewName;
  readonly cardinality: PreparedStructuralFireCardinality;
  readonly itemCount: number;
  readonly byteLength: number;
  readonly logicalViewRoot: PreparedStructuralFireHash;
  readonly pageCount: number;
  readonly physicalPageRoot: PreparedStructuralFireHash;
}

export interface PreparedStructuralFirePageHeader {
  readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_PAGE_SCHEMA_VERSION;
  readonly direction: PreparedStructuralFireDirection;
  readonly logicalViewName: PreparedStructuralFireLogicalViewName;
  readonly pageIndex: number;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly logicalViewRoot: PreparedStructuralFireHash;
  readonly pageBytesHash: PreparedStructuralFireHash;
  readonly pageHash: PreparedStructuralFireHash;
}

export interface PreparedStructuralFirePageEnvelope {
  readonly workerEpoch: number;
  readonly rootJobId: string;
  readonly requestHash: PreparedStructuralFireHash;
  readonly header: Readonly<PreparedStructuralFirePageHeader>;
  readonly bytes: Uint8Array;
  readonly pageEnvelopeHash: PreparedStructuralFireHash;
}

export interface PreparedStructuralFireSeedManifest {
  readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_SEED_MANIFEST_SCHEMA_VERSION;
  readonly wireSchemaVersion: typeof PREPARED_STRUCTURAL_FIRE_WIRE_SCHEMA_VERSION;
  readonly algorithmVersion: typeof PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION_V2;
  readonly views: readonly PreparedStructuralFireLogicalViewDescriptor[];
  readonly manifestHash: PreparedStructuralFireHash;
}

export interface PreparedStructuralFireResultManifest {
  readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_RESULT_MANIFEST_SCHEMA_VERSION;
  readonly wireSchemaVersion: typeof PREPARED_STRUCTURAL_FIRE_WIRE_SCHEMA_VERSION;
  readonly algorithmVersion: typeof PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION_V2;
  readonly rootJobId: string;
  readonly seedHash: PreparedStructuralFireHash;
  readonly commandHash: PreparedStructuralFireHash;
  readonly requestHash: PreparedStructuralFireHash;
  readonly views: readonly PreparedStructuralFireLogicalViewDescriptor[];
  readonly manifestHash: PreparedStructuralFireHash;
}

export interface PreparedStructuralFireSourceIdentity {
  readonly objectId: string;
  readonly objectRevision: number;
  readonly editRevision: number;
  readonly contentHash: PreparedStructuralFireHash;
}

export interface PreparedStructuralFireCommand {
  readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_COMMAND_SCHEMA_VERSION;
  readonly seedHash: PreparedStructuralFireHash;
  readonly fireCommandId: string;
  readonly structuralCommandId: string;
  readonly hit: unknown;
  readonly simulationTick: number;
  readonly commandHash: PreparedStructuralFireHash;
}

export interface PreparedStructuralFireRequest {
  readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_REQUEST_SCHEMA_VERSION;
  readonly wireSchemaVersion: typeof PREPARED_STRUCTURAL_FIRE_WIRE_SCHEMA_VERSION;
  readonly algorithmVersion: typeof PREPARED_STRUCTURAL_FIRE_ALGORITHM_VERSION_V2;
  readonly seedHash: PreparedStructuralFireHash;
  readonly commandHash: PreparedStructuralFireHash;
  readonly callerNonce: string;
  readonly rootJobId: string;
  readonly source: Readonly<PreparedStructuralFireSourceIdentity>;
  readonly activationTick: number;
  readonly deadlineTick: number;
  readonly physicsRepresentationPolicy: Readonly<{
    readonly authorityResolution: "ExactStructural";
    readonly allowedLevels: readonly [
      "ExactBoxes",
      "SparseBoxes",
      "HierarchicalBounds",
      "AdaptiveCoarse"
    ];
  }>;
  readonly requestHash: PreparedStructuralFireHash;
}

export type PreparedStructuralFireBodyPlan =
  | Readonly<{
      readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_BODY_PLAN_SCHEMA_VERSION;
      readonly kind: "Empty";
      readonly count: 0;
      readonly bodyPlanRoot: PreparedStructuralFireHash;
    }>
  | Readonly<{
      readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_BODY_PLAN_SCHEMA_VERSION;
      readonly kind: "CreateOnly";
      readonly count: number;
      readonly firstBodyId: string;
      readonly lastBodyId: string;
      readonly bodyPlanRoot: PreparedStructuralFireHash;
    }>;

export interface PreparedStructuralFireCollisionBinding {
  readonly objectId: string;
  readonly objectRevision: number;
  readonly objectContentHash: PreparedStructuralFireHash;
}

export type PreparedStructuralFireCollisionResult =
  | Readonly<{
      readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_COLLISION_RESULT_SCHEMA_VERSION;
      readonly kind: "Delta";
      readonly sourceBinding: Readonly<PreparedStructuralFireCollisionBinding>;
      readonly sourceCellSetRoot: PreparedStructuralFireHash;
      readonly removedCellKeys: readonly string[];
      readonly upsertedCells: readonly unknown[];
      readonly resultingBinding: Readonly<PreparedStructuralFireCollisionBinding>;
      readonly resultingCellSetRoot: PreparedStructuralFireHash;
      readonly resultingCollisionCommitmentHash: PreparedStructuralFireHash;
    }>
  | Readonly<{
      readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_COLLISION_RESULT_SCHEMA_VERSION;
      readonly kind: "NoGeometryChange";
      readonly sourceBinding: Readonly<PreparedStructuralFireCollisionBinding>;
      readonly resultingBinding: Readonly<PreparedStructuralFireCollisionBinding>;
      readonly unchangedCellSetRoot: PreparedStructuralFireHash;
      readonly sourceCollisionCommitmentHash: PreparedStructuralFireHash;
      readonly resultingCollisionCommitmentHash: PreparedStructuralFireHash;
    }>;

export interface PreparedStructuralFireContinuationCursor {
  readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_CONTINUATION_SCHEMA_VERSION;
  readonly rootJobId: string;
  readonly requestHash: PreparedStructuralFireHash;
  readonly domain: PreparedStructuralFireResultViewName;
  readonly lastItemKey: string | null;
  readonly ordinal: number;
  readonly globalOrdinal: number;
  readonly chainHash: PreparedStructuralFireHash;
}

export interface PreparedDerivationTransaction {
  readonly schemaVersion: typeof PREPARED_DERIVATION_TRANSACTION_SCHEMA_VERSION;
  readonly seedHash: PreparedStructuralFireHash;
  readonly commandHash: PreparedStructuralFireHash;
  readonly requestHash: PreparedStructuralFireHash;
  readonly rootJobId: string;
  readonly terminalJobId: string;
  readonly source: Readonly<PreparedStructuralFireSourceIdentity>;
  readonly result: Readonly<PreparedStructuralFireSourceIdentity>;
  readonly resultManifestHash: PreparedStructuralFireHash;
  readonly structuralCommandId: string;
  readonly outcome: "Applied" | "NoChange";
  readonly supportResult: "Anchored" | "Detached" | "Empty";
  readonly bodyPlan: PreparedStructuralFireBodyPlan;
  readonly detachedComponentCount: number;
  readonly detachedComponentRoot: PreparedStructuralFireHash;
  readonly sourceFragmentCount: number;
  readonly sourceFragmentRoot: PreparedStructuralFireHash;
  readonly newBodyCount: number;
  readonly newBodyRoot: PreparedStructuralFireHash;
  readonly collision: PreparedStructuralFireCollisionResult;
  readonly terminalContinuation: Readonly<PreparedStructuralFireContinuationCursor>;
  readonly preparedDerivationTransactionHash: PreparedStructuralFireHash;
}

export type PreparedStructuralFireResultReceipt =
  | Readonly<{
      readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_RESULT_RECEIPT_SCHEMA_VERSION;
      readonly kind: "NoChangeReceipt";
      readonly rootJobId: string;
      readonly terminalJobId: string;
      readonly seedHash: PreparedStructuralFireHash;
      readonly commandHash: PreparedStructuralFireHash;
      readonly requestHash: PreparedStructuralFireHash;
      readonly resultManifestHash: PreparedStructuralFireHash;
      readonly preparedDerivationTransactionHash: PreparedStructuralFireHash;
      readonly receiptHash: PreparedStructuralFireHash;
    }>
  | Readonly<{
      readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_RESULT_RECEIPT_SCHEMA_VERSION;
      readonly kind: "AppliedReceipt";
      readonly rootJobId: string;
      readonly terminalJobId: string;
      readonly seedHash: PreparedStructuralFireHash;
      readonly commandHash: PreparedStructuralFireHash;
      readonly requestHash: PreparedStructuralFireHash;
      readonly resultManifestHash: PreparedStructuralFireHash;
      readonly preparedDerivationTransactionHash: PreparedStructuralFireHash;
      readonly receiptHash: PreparedStructuralFireHash;
    }>;

export interface PreparedStructuralFireReady {
  readonly schemaVersion: typeof PREPARED_STRUCTURAL_FIRE_READY_SCHEMA_VERSION;
  readonly type: "Ready";
  readonly manifest: Readonly<PreparedStructuralFireResultManifest>;
  readonly receipt: PreparedStructuralFireResultReceipt;
}

export interface PreparedStructuralFirePayloadFragment {
  readonly logicalViewName: PreparedStructuralFireLogicalViewName;
  readonly ordinal: number;
  readonly key: string;
  readonly fragmentIndex: number;
  readonly payloadByteOffset: number;
  readonly byteLength: number;
  readonly isFinal: boolean;
  readonly bytes: Uint8Array;
}
