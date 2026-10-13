export * from "./types";
export {
  StructuralValidationError,
  normalizeAdaptiveAuthorityError,
  normalizeAdaptiveAuthorityFunction,
  structuralFail,
  structuralNonNegativeSafeInteger,
  structuralPositiveBudget,
  structuralRevision,
  structuralMaterialId,
  structuralCanonicalString,
  validateStructuralMaterialDefinition,
  validateStructuralVoxelState,
  validateStructuralFrameBinding,
  assertStructuralKeyMatchesFrame,
  validateStructuralMaterialFilter,
  validateStructuralAdaptiveSourceBindingExpectation,
  validateStructuralCommandBudgets,
  validateStructuralDestructionCommand,
  validateStructuralSphereShape,
  validateStructuralBoxShape,
  requireStructuralHash,
  type StructuralValidationErrorCode
} from "./validation";
export * from "./coordinates";
export {
  projectStructuralObjectContent,
  projectStructuralCommandEvidence,
  projectStructuralObject,
  projectStructuralResult,
  canonicalStructuralJson,
  serializeStructuralCellAddress,
  serializeStructuralObject,
  serializeStructuralCommand,
  serializeStructuralResult,
  hashStructuralObjectContent,
  hashStructuralEvidence,
  hashStructuralCommand,
  hashStructuralResult,
  hashStructuralAdaptiveAuthorityBinding,
  hashStructuralComponentId,
  hashStructuralFragmentContent,
  hashStructuralFragmentId
} from "./canonical";
export {
  createStructuralMaterialTable,
  createStructuralBrick,
  validateStructuralAdaptiveSourceBinding,
  createStructuralObjectFromAdaptive,
  getStructuralVoxel,
  structuralAddressForBrickCell
} from "./model";
export * from "./connectivity";
// Explicit lists: exactly the previous public names. The owner-internal step forms
// (`...Steps`) of these modules stay module exports only and are not part of this barrel.
export {
  StructuralMassError,
  deriveStructuralObjectMassProperties,
  deriveStructuralSingleComponentMasses,
  deriveStructuralComponentMassProperties
} from "./massProperties";
export { applyStructuralDestructionCommand } from "./commands";
export {
  STRUCTURAL_PHYSICS_TRANSITION_SCHEMA_VERSION,
  STRUCTURAL_PHYSICS_TRANSITION_FALLBACK_KIND,
  StructuralPhysicsTransitionError,
  deriveStructuralSplitVelocity,
  mergeGreedyQuantumBoxes,
  deriveStructuralPhysicsTransition,
  deriveStructuralSingleComponentPhysicsPreparation,
  canonicalStructuralTransitionJson,
  type StructuralPhysicsTransitionBudgets,
  type StructuralBodyMotion,
  type StructuralColliderBoxMeters,
  type StructuralFragmentBodyPlan,
  type StructuralDebrisBodyPlan,
  type StructuralOccupancyProof,
  type StructuralParentMotionSource,
  type StructuralInstalledPhysicsTransition,
  type StructuralFallbackPhysicsTransition,
  type StructuralPhysicsTransitionResult
} from "./physicsTransition";
export * from "./physicsCommit";
export * from "./regionSave";
export * from "./greedyMesher";
export * from "./provingGroundR5";
export * from "./persistence";
export { MICROVOXEL_BASE_QUANTUM_METERS, ADAPTIVE_LEVELS } from "../adaptive";
