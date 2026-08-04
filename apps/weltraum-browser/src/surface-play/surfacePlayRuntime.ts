import { createWeaponMountPose } from "../combat";
import { VOXEL_BRICK_CELL_COUNT } from "../voxel";
import { hashAdaptiveCanonical } from "../voxel/adaptive";
import { HESTIA_SEA_LEVEL_METERS } from "../world-generation/hestia";
import {
  createRevisionBoundSurfaceCollisionPort,
  type SurfaceCollisionDelegate
} from "./collision";
import {
  HESTIA_PULSE_CUTTER_MAXIMUM_ENERGY_JOULES,
  HESTIA_PULSE_CUTTER_V1,
  advanceSurfaceCombatRuntime,
  createCombatCoreSurfaceRaycastPort,
  createSurfaceCombatRuntimeState,
  createSurfaceTerrainRaycastAdapter,
  deriveSurfaceCombatWeaponReadiness,
  executeSurfaceCombatFire,
  probeSurfaceCombatFire,
  replaySurfaceCombatPresentation,
  type SurfaceCombatRaycastCandidate,
  type SurfaceCombatRaycastRequest,
  type SurfaceCombatRuntimeResult,
  type SurfaceCombatRuntimeState,
  type SurfaceTargetTerrainRaycastPort
} from "./combat";
import {
  createSurfaceCombatSnapshot,
  createSurfacePlayHudSnapshot,
  createSurfaceTargetPresentationSnapshot,
  createSurfaceTerrainPresentationSnapshot,
  createSurfaceWeaponPresentationSnapshot,
  type SurfaceAuthorityBinding,
  type SurfaceCombatSnapshot,
  type SurfaceFireRejectionCode,
  type SurfaceImpactPresentationSnapshot,
  type SurfacePhysicsFailureSnapshot,
  type SurfacePlayerCommand,
  type SurfacePlayerPresentationSnapshot,
  type SurfacePlayHudSnapshot,
  type SurfaceTargetPresentationSnapshot,
  type SurfaceTerrainPresentationSnapshot,
  type SurfaceStructuralPresentationSnapshot,
  type SurfaceVoxelEditRejectionCode,
  type SurfaceWeaponPresentationSnapshot
} from "./contracts";
import {
  createSurfaceRigidBodyWorld,
  raycastSurfaceRigidBodies,
  replaceSurfaceRigidBodyTerrainColliders,
  separateSurfaceRigidBodyCapsule,
  type SurfaceRigidBodyWorld
} from "./physics";
import {
  advanceSurfaceFixedStepRuntime,
  applySurfaceFixedStepCapsuleSeparation,
  createHestiaAgileGroundedLocomotionPresetV1,
  createSurfaceFirstPersonViewSnapshot,
  createSurfaceFixedStepRuntime,
  createSurfacePlayerContractSnapshot,
  createSurfacePlayerPresentationSnapshot,
  type SurfaceFirstPersonViewSnapshot,
  type SurfaceFixedStepCommandFactory,
  type SurfaceFixedStepRuntime,
  type SurfaceLocomotionConfig,
  type SurfaceLocomotionRejection,
  type SurfaceLocomotionState
} from "./player";
import {
  HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
  HESTIA_SURFACE_PLAY_V1_CONFIG
} from "./surfacePlayConfig";
import {
  createShoreBoundSurfaceCollisionDelegate,
  createSurfaceVoxelCollisionDelegate
} from "./surfacePlayCollision";
import { quantizeSurfaceHitCoordinateMeters } from "./surfacePlayQuantization";
import {
  SURFACE_VOXEL_EDIT_QUANTUM_METERS,
  SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
  applySurfaceVoxelEdit,
  createSurfaceRegionVoxelAuthority,
  createSurfaceRegionVoxelCollisionAdapter,
  createSurfaceVoxelRemeshPlan,
  type SurfaceRegionVoxelAuthority,
  type SurfaceRegionVoxelAuthorityInput,
  type SurfaceRegionMaterializedVoxelBrick,
  type SurfaceVoxelEditIntent,
  type SurfaceVoxelEditResult as AuthorityVoxelEditResult,
  type SurfaceVoxelEditTransition,
  type SurfaceVoxelRemeshPlanResult
} from "./voxel-edit";
import {
  createHestiaAuthorityGroundSurfaceProbe,
  deriveHestiaSurfaceRigidBodyTerrainPatch,
  refreshHestiaSurfaceRigidBodyTerrainPatch,
  revalidateHestiaSurfaceWorldIncrementallyAgainstAuthority,
  type HestiaSurfaceRigidBodyTerrainPatch,
  type HestiaSurfaceWorldFacts
} from "./world";
import { createHestiaUmbrellaTree } from "./vegetation/hestiaUmbrellaTree";
import {
  createSurfaceTreeCollisionBinding,
  isSurfaceTreeSpawnClear,
  raycastSurfaceTreeCollision,
  type SurfaceTreeCollisionHit,
  type SurfaceTreeCollisionSnapshot
} from "./vegetation/surfaceTreeCollision";
import { createAttachedSurfaceTreeCollisionDelegate } from "./vegetation/surfaceTreeCollisionDelegate";
import {
  advanceSurfaceTreePhysics,
  createSurfaceTreePreparedFireWorkerInput,
  createSurfaceTreePreparedFireWorkerRunInput,
  createSurfaceTreePresentationSnapshot,
  createSurfaceTreeRuntimeState,
  deriveSurfaceTreePreparedStructuralCommandId,
  preflightSurfaceTreeFire,
  resolveSurfaceTreeStructuralMeshArtifact,
  type SurfaceTreeFirePreflight,
  type SurfaceTreeStructuralMeshArtifact,
  type SurfaceTreeRuntimeState
} from "./vegetation/surfaceTreeRuntime";
import type {
  PreparedStructuralFireWorkerClient,
  PreparedStructuralFireWorkerClientResult
} from "./workers/preparedStructuralFireWorkerClient";
import type {
  PreparedStructuralFireHash,
  PreparedStructuralFireReady,
  PreparedStructuralFireSeedManifest
} from "./workers/preparedStructuralFireWire";
import type {
  PreparedStructuralFirePrivateBoundaryDiagnostics,
  PreparedStructuralFirePrivateDiagnosticStatus,
  PreparedStructuralFirePrivateDiagnosticTrace,
  PreparedStructuralFirePrivateMainDiagnostics,
  PreparedStructuralFirePrivateRuntimeDiagnostics,
  PreparedStructuralFirePrivateWorkerDiagnostics
} from "./workers/preparedStructuralFireProtocol";
import { preparedStructuralFireSeedHash } from "./workers/preparedStructuralFireWireCodec";

export const SURFACE_PLAY_ACTION_LIFETIME_TICKS = 180;
export const SURFACE_PLAY_WARNING_LIFETIME_TICKS = 300;

const playerFacingFireBlock = (code: SurfaceFireRejectionCode): string => {
  switch (code) {
    case "BodyCapacityExceeded":
      return "Too many fallen pieces would be active. Aim for a smaller cut or re-enter Surface Play to clear debris.";
    case "ColliderBudgetExceeded":
      return "This cut is too complex to simulate.";
    case "DetachedBodyImmutable":
      return "Fallen trees cannot be cut in this test slice.";
    case "StaleRevision":
    case "AuthorityRefused":
      return "The tree state changed. Aim again.";
    case "Cooldown":
      return "Pulse Cutter is cooling. Try again when ready.";
    case "InsufficientEnergy":
      return "Energy is recharging. Wait for one shot to become ready.";
    case "Overheated":
      return "Pulse Cutter is overheated. Wait for cooling.";
    case "InvalidTarget":
      return "No valid target is inside the beam.";
    case "FrameMismatch":
      return "Surface targeting changed. Aim again.";
  }
};

const playerFacingVoxelBlock = (code: SurfaceVoxelEditRejectionCode): string => {
  switch (code) {
    case "StaleRevision": return "The terrain state changed. Aim again.";
    case "DuplicateCommand": return "This terrain cut was already processed.";
    default: return "The terrain cut could not be applied. Aim at a stable surface.";
  }
};

export type SurfacePlayRuntimeRejection =
  | Readonly<{
      readonly kind: "Locomotion";
      readonly code: SurfaceLocomotionRejection["code"];
      readonly message: string;
      readonly simulationTick: number;
    }>
  | Readonly<{
      readonly kind: "Fire";
      readonly code: SurfaceFireRejectionCode;
      readonly message: string;
      readonly simulationTick: number;
    }>
  | Readonly<{
      readonly kind: "VoxelEdit";
      readonly code: SurfaceVoxelEditRejectionCode;
      readonly message: string;
      readonly simulationTick: number;
    }>
  | Readonly<{
      readonly kind: "Physics";
      readonly code: SurfacePhysicsFailureSnapshot["code"];
      readonly message: string;
      readonly simulationTick: number;
    }>;

export interface SurfacePlayRuntimePresentationSnapshot {
  readonly player: Readonly<SurfacePlayerPresentationSnapshot>;
  readonly terrain: Readonly<SurfaceTerrainPresentationSnapshot>;
  readonly target: Readonly<SurfaceTargetPresentationSnapshot>;
  readonly weapon: Readonly<SurfaceWeaponPresentationSnapshot>;
  readonly impact: Readonly<SurfaceImpactPresentationSnapshot> | null;
  readonly structural: Readonly<SurfaceStructuralPresentationSnapshot> | null;
}

export interface SurfacePlayRuntimeVoxelTransitionSnapshot {
  readonly intent: Readonly<SurfaceVoxelEditIntent>;
  readonly result: Readonly<AuthorityVoxelEditResult>;
  readonly remeshPlan: Readonly<SurfaceVoxelRemeshPlanResult> | null;
}

export interface SurfacePlayRuntimeSnapshot {
  readonly authorityState: SurfaceRegionVoxelAuthority["state"];
  readonly world: Readonly<HestiaSurfaceWorldFacts> | null;
  readonly fixedStep: Readonly<SurfaceFixedStepRuntime>;
  readonly player: ReturnType<typeof createSurfacePlayerContractSnapshot>;
  readonly firstPersonView: Readonly<SurfaceFirstPersonViewSnapshot>;
  readonly combat: Readonly<SurfaceCombatSnapshot>;
  readonly hud: Readonly<SurfacePlayHudSnapshot>;
  readonly presentation: Readonly<SurfacePlayRuntimePresentationSnapshot>;
  readonly appliedVoxelTransitions: readonly Readonly<SurfacePlayRuntimeVoxelTransitionSnapshot>[];
  readonly latestVoxelTransition: Readonly<SurfacePlayRuntimeVoxelTransitionSnapshot> | null;
  readonly latestRejection: Readonly<SurfacePlayRuntimeRejection> | null;
  readonly preparedStructuralFireDiagnostics: Readonly<{
    readonly current: Readonly<PreparedStructuralFirePrivateDiagnosticTrace> | null;
    readonly lastCompleted: Readonly<PreparedStructuralFirePrivateDiagnosticTrace> | null;
  }>;
}

export type SurfaceStructuralFireMode = "SynchronousV1" | "AsyncPreparingV2";

export type SurfacePreparedStructuralFireClient = Pick<
  PreparedStructuralFireWorkerClient,
  "hasPreparedSeed" | "prepareSeed" | "run" | "readTelemetry"
>;

export interface SurfacePlayRuntimeAdvanceResult {
  readonly status: "Advanced" | "Rejected";
  readonly steps: number;
  readonly snapshot: Readonly<SurfacePlayRuntimeSnapshot>;
  readonly rejections: readonly Readonly<SurfacePlayRuntimeRejection>[];
}

export interface SurfacePlayRuntimeOptions {
  readonly routeId: string;
  readonly initialPlayerState: Readonly<SurfaceLocomotionState>;
  readonly authority?: SurfaceRegionVoxelAuthority;
  readonly authorityInput?: Readonly<SurfaceRegionVoxelAuthorityInput>;
  readonly world?: Readonly<HestiaSurfaceWorldFacts>;
  readonly initialCombatState?: Readonly<SurfaceCombatRuntimeState>;
  readonly locomotionConfig?: Readonly<SurfaceLocomotionConfig>;
  readonly applyVoxelEdit?: typeof applySurfaceVoxelEdit;
  readonly structuralFireMode?: SurfaceStructuralFireMode;
  readonly preparedStructuralFireClient?: SurfacePreparedStructuralFireClient;
  readonly now?: () => number;
}

export interface SurfacePlayRuntime {
  advance(
    elapsedSeconds: number,
    commandFactory: SurfaceFixedStepCommandFactory
  ): Readonly<SurfacePlayRuntimeAdvanceResult>;
  read(): Readonly<SurfacePlayRuntimeSnapshot>;
  materializeBrick(key: string): Readonly<SurfaceRegionMaterializedVoxelBrick> | undefined;
  resolveStructuralMeshArtifact(
    meshArtifactId: string
  ): Readonly<SurfaceTreeStructuralMeshArtifact> | undefined;
  warmPreparedStructuralFireSeed?(): Promise<void>;
  dispose?(): void;
}

type SurfacePlayTransitionAdoptionResult =
  | Readonly<{ readonly status: "Adopted" }>
  | Readonly<{
      readonly status: "Rejected";
      readonly failure: Readonly<{
        readonly code: "NoAdmissibleLandFootprint";
        readonly message: string;
        readonly attemptedCandidateCount: number;
      }>;
    }>;

type SurfaceTerrainImpactResult =
  | Readonly<{ readonly status: "Adopted" }>
  | Readonly<{ readonly status: "Rejected"; readonly refundCombatCost: boolean }>;

interface PendingStructuralPreparation {
  readonly objectId: string;
  readonly diagnosticToken: number;
  readonly queuedAtMilliseconds: number;
  readonly sourceObjectRevision: number;
  readonly sourceEditRevision: number;
  readonly sourceContentHash: string;
  readonly controller: AbortController;
  terminalLatencyMilliseconds: number | null;
  status: "Queued" | "Running" | "ReadyToAdopt";
  ready: PreparedStructuralFireReady | null;
}

interface PreparedStructuralFireSeedCache {
  readonly objectId: string;
  readonly sourceObjectRevision: number;
  readonly sourceEditRevision: number;
  readonly sourceContentHash: string;
  readonly physicsSeedFactsHash: string;
  readonly manifest: Readonly<PreparedStructuralFireSeedManifest>;
}

const emptyMainDiagnostics = (): Readonly<PreparedStructuralFirePrivateMainDiagnostics> => Object.freeze({
  clockDomain: "Main" as const,
  prepareSeedStartAtMilliseconds: null,
  prepareSeedPostStartAtMilliseconds: null,
  prepareSeedPostEndAtMilliseconds: null,
  seedPreparedReceiptAtMilliseconds: null,
  seedValidationCompleteAtMilliseconds: null,
  prepareSeedEndAtMilliseconds: null,
  prepareSeedDurationMilliseconds: null,
  prepareSeedPostDurationMilliseconds: null,
  seedValidationDurationMilliseconds: null,
  executePostStartAtMilliseconds: null,
  executePostReturnedAtMilliseconds: null,
  firstResultOrReadyReceiptAtMilliseconds: null,
  executeReadyReceiptAtMilliseconds: null,
  executeValidationCompleteAtMilliseconds: null,
  executePostDurationMilliseconds: null,
  executeReceiptToValidationDurationMilliseconds: null
});

const emptyRuntimeDiagnostics = (): Readonly<PreparedStructuralFirePrivateRuntimeDiagnostics> => Object.freeze({
  clockDomain: "Main" as const,
  inputAcceptedAtMilliseconds: null,
  queuedAtMilliseconds: null,
  runningAtMilliseconds: null,
  workerPreparationStateStartAtMilliseconds: null,
  workerPreparationStateEndAtMilliseconds: null,
  readyToAdoptAtMilliseconds: null,
  prewarmStartAtMilliseconds: null,
  prewarmWorkerPreparationStateStartAtMilliseconds: null,
  prewarmWorkerPreparationStateEndAtMilliseconds: null,
  prewarmEndAtMilliseconds: null,
  queueWaitDurationMilliseconds: null,
  workerPreparationStateDurationMilliseconds: null,
  fireDurationMilliseconds: null,
  prewarmWorkerPreparationStateDurationMilliseconds: null,
  prewarmDurationMilliseconds: null
});

const freezeWorkerDiagnostics = (
  value: Readonly<PreparedStructuralFirePrivateWorkerDiagnostics> | null
): Readonly<PreparedStructuralFirePrivateWorkerDiagnostics> | null => value === null
  ? null
  : Object.freeze({
      ...value,
      prepareSeed: value.prepareSeed === null ? null : Object.freeze({ ...value.prepareSeed }),
      execute: value.execute === null ? null : Object.freeze({ ...value.execute })
    });

const freezeDiagnosticTrace = (
  value: Readonly<PreparedStructuralFirePrivateDiagnosticTrace>
): Readonly<PreparedStructuralFirePrivateDiagnosticTrace> => Object.freeze({
  ...value,
  runtime: Object.freeze({ ...value.runtime }),
  main: Object.freeze({ ...value.main }),
  worker: freezeWorkerDiagnostics(value.worker),
  publication: Object.freeze({ ...value.publication })
});

const diagnosticDuration = (start: number | null, end: number | null): number | null =>
  start === null || end === null ? null : Math.max(0, end - start);

const preparedStructuralFirePhysicsSeedFactsHash = (
  world: Readonly<SurfaceRigidBodyWorld>
): string => hashAdaptiveCanonical({
  schemaVersion: "surface-tree-prepared-physics-seed-facts-v1",
  gravityMetersPerSecondSquared: world.gravityMetersPerSecondSquared,
  terrainColliders: world.terrainColliders,
  bodies: world.bodies,
  physicsFailure: world.physicsFailure
});

const targetCondition = (
  state: Readonly<SurfaceCombatRuntimeState>
): "Operational" | "Damaged" | "Disabled" | "Destroyed" => {
  if (state.drone.mode === "Destroyed") return "Destroyed";
  if (state.drone.mode === "Damaged") return "Damaged";
  return "Operational";
};

const initialDronePosition = (
  player: Readonly<SurfaceLocomotionState>,
  config: Readonly<SurfaceLocomotionConfig>
): Readonly<{ readonly x: number; readonly y: number; readonly z: number }> => {
  const view = createSurfaceFirstPersonViewSnapshot(player, config);
  return Object.freeze({
    x: view.eyePositionMeters.x + view.forward.x * 12,
    y: view.eyePositionMeters.y + view.forward.y * 12,
    z: view.eyePositionMeters.z + view.forward.z * 12
  });
};

const combatSnapshot = (
  state: Readonly<SurfaceCombatRuntimeState>,
  simulationTick: number,
  previous: Readonly<SurfaceCombatSnapshot> | null = null
): Readonly<SurfaceCombatSnapshot> => createSurfaceCombatSnapshot({
  activeWeaponId: HESTIA_PULSE_CUTTER_V1.weaponId,
  energyJoules: state.weapon.energy ?? 0,
  maximumEnergyJoules: HESTIA_PULSE_CUTTER_MAXIMUM_ENERGY_JOULES,
  heatJoules: state.weapon.heat ?? 0,
  maximumHeatJoules: HESTIA_PULSE_CUTTER_V1.heat?.maximumHeat ?? 0,
  cooldownSeconds: state.weapon.cooldownSeconds,
  readiness: deriveSurfaceCombatWeaponReadiness(state),
  target: {
    targetId: state.drone.damageable.targetEntityId,
    condition: targetCondition(state),
    integrity: state.drone.damageable.armor.current + state.drone.damageable.hull.current,
    maximumIntegrity: state.drone.damageable.armor.maximum + state.drone.damageable.hull.maximum
  },
  latestFireResult: previous?.latestFireResult ?? null,
  events: previous?.events ?? [],
  simulationTick
});

const voxelRejectionCode = (reason: string): SurfaceVoxelEditRejectionCode => {
  switch (reason) {
    case "StaleRevision": return "StaleRevision";
    case "BodyMismatch": return "BodyMismatch";
    case "RegionMismatch": return "RegionMismatch";
    case "FrameMismatch": return "FrameMismatch";
    case "InvalidRadius": return "InvalidRadius";
    case "DuplicateEditId": return "DuplicateCommand";
    default: return "AuthorityRefused";
  }
};

export const surfacePlayPresentationBrickId = (
  coordinate: Readonly<{ x: number; y: number; z: number }>
): string => {
  const component = (value: number): string => value < 0 ? `n${-value}` : String(value);
  return `surface-brick:x-${component(coordinate.x)}:y-${component(coordinate.y)}:z-${component(coordinate.z)}`;
};

export const sameRigidBodyCollisionSource = (
  previous: Readonly<SurfaceRigidBodyWorld> | null,
  current: Readonly<SurfaceRigidBodyWorld> | null
): boolean => {
  if (previous === current) return true;
  if (previous === null || current === null || previous.bodies.length !== current.bodies.length) return false;
  return previous.bodies.every((body, index) => {
    const candidate = current.bodies[index];
    return candidate !== undefined
      && body.bodyId === candidate.bodyId
      && body.componentId === candidate.componentId
      && body.lifecycle === candidate.lifecycle
      && body.colliderRevision === candidate.colliderRevision
      && body.colliders === candidate.colliders
      && body.colliderRepresentation === candidate.colliderRepresentation
      && body.positionMeters.x === candidate.positionMeters.x
      && body.positionMeters.y === candidate.positionMeters.y
      && body.positionMeters.z === candidate.positionMeters.z
      && body.orientation.x === candidate.orientation.x
      && body.orientation.y === candidate.orientation.y
      && body.orientation.z === candidate.orientation.z
      && body.orientation.w === candidate.orientation.w;
  });
};

class SurfacePlayRuntimeImpl implements SurfacePlayRuntime {
  readonly #routeId: string;
  readonly #config: Readonly<SurfaceLocomotionConfig>;
  readonly #applyVoxelEdit: typeof applySurfaceVoxelEdit;
  readonly #structuralFireMode: SurfaceStructuralFireMode;
  readonly #preparedStructuralFireClient: SurfacePreparedStructuralFireClient | null;
  readonly #now: () => number;
  #authority: SurfaceRegionVoxelAuthority;
  #world: Readonly<HestiaSurfaceWorldFacts> | null;
  #worldBoundTerrain!: SurfaceCollisionDelegate;
  #collisionDelegate!: SurfaceCollisionDelegate;
  #collisionPort!: ReturnType<typeof createRevisionBoundSurfaceCollisionPort>;
  #terrainCollisionPort!: ReturnType<typeof createRevisionBoundSurfaceCollisionPort>;
  #terrainCollisionAuthority: SurfaceRegionVoxelAuthority | null = null;
  #terrainCollisionBoundary: HestiaSurfaceWorldFacts["shoreBoundary"] | null = null;
  #treeCollisionSource: Readonly<SurfaceTreeCollisionSnapshot> | null = null;
  #physicsCollisionSource: Readonly<SurfaceRigidBodyWorld> | null = null;
  #binding!: Readonly<SurfaceAuthorityBinding>;
  #treeState: Readonly<SurfaceTreeRuntimeState> | null = null;
  #preparedStructuralFireSeed: PreparedStructuralFireSeedCache | null = null;

  #workerPreparationState(): Readonly<SurfaceTreeRuntimeState> | null {
    const state = this.#treeState;
    if (state === null) return null;
    return Object.freeze({
      authority: state.authority,
      collision: state.collision,
      physicsWorld: state.physicsWorld,
      bodySources: Object.freeze([]),
      latestTransition: null
    }) as unknown as Readonly<SurfaceTreeRuntimeState>;
  }

  #preparedStructuralFireSeedMatches(
    state: Readonly<SurfaceTreeRuntimeState>,
    cached: Readonly<PreparedStructuralFireSeedCache>
  ): boolean {
    return cached.objectId === state.authority.objectId
      && cached.sourceObjectRevision === state.authority.objectRevision
      && cached.sourceEditRevision === state.authority.editRevision
      && cached.sourceContentHash === state.authority.objectContentHash
      && cached.physicsSeedFactsHash
        === preparedStructuralFirePhysicsSeedFactsHash(state.physicsWorld);
  }
  #rigidTerrainPatch: Readonly<HestiaSurfaceRigidBodyTerrainPatch> | null = null;
  readonly #structuralMeshArtifacts = new Map<string, Readonly<SurfaceTreeStructuralMeshArtifact>>();
  #fixedStep: Readonly<SurfaceFixedStepRuntime>;
  #combatState: Readonly<SurfaceCombatRuntimeState>;
  #combatSnapshot: Readonly<SurfaceCombatSnapshot>;
  #presentation: Readonly<SurfacePlayRuntimePresentationSnapshot>;
  readonly #appliedVoxelTransitions: SurfacePlayRuntimeVoxelTransitionSnapshot[] = [];
  #latestVoxelTransition: Readonly<SurfacePlayRuntimeVoxelTransitionSnapshot> | null = null;
  #latestRejection: Readonly<SurfacePlayRuntimeRejection> | null = null;
  #latestAction: string | null = null;
  #latestBlock: string | null = null;
  #latestActionExpiresAtTick: number | null = null;
  #latestBlockExpiresAtTick: number | null = null;
  readonly #pendingStructuralPreparations = new Map<string, PendingStructuralPreparation>();
  #currentDiagnosticTrace: Readonly<PreparedStructuralFirePrivateDiagnosticTrace> | null = null;
  #lastCompletedDiagnosticTrace: Readonly<PreparedStructuralFirePrivateDiagnosticTrace> | null = null;
  #diagnosticSequence = 0;
  #currentDiagnosticToken: number | null = null;
  #disposed = false;

  constructor(options: SurfacePlayRuntimeOptions) {
    if (options.routeId.length === 0 || options.routeId.trim() !== options.routeId) {
      throw new TypeError("Surface Play route identity must be a non-empty trimmed stable ID.");
    }
    if (options.authority !== undefined && options.authorityInput !== undefined) {
      throw new TypeError("Supply either an adopted Surface Play authority or authority input, not both.");
    }
    this.#routeId = options.routeId;
    this.#config = options.locomotionConfig ?? createHestiaAgileGroundedLocomotionPresetV1();
    this.#applyVoxelEdit = options.applyVoxelEdit ?? applySurfaceVoxelEdit;
    this.#structuralFireMode = options.structuralFireMode ?? "SynchronousV1";
    this.#preparedStructuralFireClient = options.preparedStructuralFireClient ?? null;
    this.#now = options.now ?? (() => performance.now());
    if (this.#structuralFireMode === "AsyncPreparingV2" && this.#preparedStructuralFireClient === null) {
      throw new TypeError("Async Structural preparation requires a started Prepared Fire worker client.");
    }
    this.#authority = options.authority
      ?? createSurfaceRegionVoxelAuthority(options.authorityInput ?? HESTIA_SURFACE_PLAY_V1_CONFIG);
    this.#world = options.world ?? null;
    if (
      this.#world !== null
      && (
        this.#world.identity.bodyId !== this.#authority.state.bodyId
        || this.#world.identity.regionId !== this.#authority.state.regionId
        || this.#world.identity.surfaceFrameId !== this.#authority.state.surfaceFrameId
        || this.#world.identity.regionRevision !== this.#authority.state.regionRevision
      )
    ) throw new TypeError("Initial Surface Play world must match the adopted voxel authority.");
    if (options.initialPlayerState.surfaceFrameId !== this.#authority.state.surfaceFrameId) {
      throw new TypeError("Initial Surface Play player frame must match the voxel authority frame.");
    }
    this.#fixedStep = createSurfaceFixedStepRuntime(options.initialPlayerState);
    if (this.#world !== null) {
      const placements = this.#world.encounter.structuralTrees;
      if (placements.length !== 1) {
        throw new TypeError("Hestia Surface Play V1 requires exactly one Structural Umbrella Tree.");
      }
      const placement = placements[0];
      const terrainResult = deriveHestiaSurfaceRigidBodyTerrainPatch({
        world: this.#world,
        placement,
        authorityState: this.#authority.state,
        groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
          state: this.#authority.state,
          adapter: createSurfaceRegionVoxelCollisionAdapter(this.#authority)
        })
      });
      if (terrainResult.status === "Rejected") {
        throw new TypeError(terrainResult.failure.message);
      }
      this.#rigidTerrainPatch = terrainResult.patch;
      this.#treeState = createSurfaceTreeRuntimeState(
        createHestiaUmbrellaTree(placement),
        createSurfaceRigidBodyWorld({
          simulationTick: options.initialPlayerState.simulationTick,
          gravityMetersPerSecondSquared: this.#config.gravityMetersPerSecondSquared,
          terrainColliders: terrainResult.terrainColliders
        })
      );
      const spawnClear = isSurfaceTreeSpawnClear(this.#treeState.collision, {
        binding: createSurfaceTreeCollisionBinding(this.#treeState.collision),
        positionMeters: options.initialPlayerState.positionMeters,
        capsule: options.initialPlayerState.capsule
      });
      if (spawnClear.status !== "Resolved" || !spawnClear.clear) {
        throw new TypeError("World-owned Structural Tree placement intersects the player spawn capsule.");
      }
    }
    this.#combatState = options.initialCombatState
      ?? createSurfaceCombatRuntimeState(
        this.#authority.state.surfaceFrameId,
        this.#world?.encounter.surveyDronePositionMeters
          ?? initialDronePosition(options.initialPlayerState, this.#config)
      );
    if (this.#combatState.drone.frameId !== this.#authority.state.surfaceFrameId) {
      throw new TypeError("Initial Surface Play combat frame must match the voxel authority frame.");
    }
    this.#combatSnapshot = combatSnapshot(this.#combatState, options.initialPlayerState.simulationTick);
    this.#refreshCollision(options.initialPlayerState.simulationTick);
    const view = createSurfaceFirstPersonViewSnapshot(options.initialPlayerState, this.#config);
    this.#presentation = Object.freeze({
      player: createSurfacePlayerPresentationSnapshot(this.#fixedStep),
      terrain: this.#terrainPresentation(),
      target: this.#targetPresentation(),
      weapon: createSurfaceWeaponPresentationSnapshot({
        weaponId: HESTIA_PULSE_CUTTER_V1.weaponId,
        ownerPlayerId: options.initialPlayerState.playerId,
        surfaceFrameId: options.initialPlayerState.surfaceFrameId,
        muzzlePositionMeters: view.eyePositionMeters,
        cooldownSeconds: this.#combatState.weapon.cooldownSeconds,
        firing: false
      }),
      impact: null,
      structural: this.#structuralPresentation(options.initialPlayerState.simulationTick)
    });
  }

  #diagnosticNow(): number | null {
    try {
      const value = this.#now();
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  #beginDiagnostic(
    phase: "WarmSeed" | "Fire",
    state: Readonly<SurfaceTreeRuntimeState>,
    runtime: Readonly<Partial<PreparedStructuralFirePrivateRuntimeDiagnostics>>
  ): number {
    const token = ++this.#diagnosticSequence;
    this.#currentDiagnosticToken = token;
    try {
      this.#currentDiagnosticTrace = freezeDiagnosticTrace({
        phase,
        status: phase === "Fire" ? "Queued" : "Running",
        reason: null,
        objectId: state.authority.objectId,
        sourceObjectRevision: state.authority.objectRevision,
        sourceEditRevision: state.authority.editRevision,
        sourceContentHash: state.authority.objectContentHash,
        rootJobId: null,
        workerEpoch: null,
        runtime: Object.freeze({ ...emptyRuntimeDiagnostics(), ...runtime }),
        main: emptyMainDiagnostics(),
        worker: null,
        seedCanonicalBytes: null,
        resultCanonicalBytes: null,
        structuredCloneBytes: null,
        canonicalBytesBasis: "ManifestDescriptorByteLengthSum",
        publication: Object.freeze({ status: "Unavailable" as const, atMilliseconds: null })
      });
    } catch {
      this.#currentDiagnosticTrace = null;
    }
    return token;
  }

  #patchDiagnostic(patch: Readonly<{
    readonly token: number;
    readonly status?: PreparedStructuralFirePrivateDiagnosticStatus;
    readonly reason?: string | null;
    readonly rootJobId?: string | null;
    readonly workerEpoch?: number | null;
    readonly runtime?: Readonly<Partial<PreparedStructuralFirePrivateRuntimeDiagnostics>>;
    readonly main?: Readonly<Partial<PreparedStructuralFirePrivateMainDiagnostics>>;
    readonly boundary?: Readonly<PreparedStructuralFirePrivateBoundaryDiagnostics>;
  }>): void {
    try {
      if (this.#currentDiagnosticToken !== patch.token) return;
      const current = this.#currentDiagnosticTrace;
      if (current === null) return;
      const boundary = patch.boundary;
      const incomingMain = boundary?.main ?? patch.main;
      const nextMain = incomingMain === undefined
        ? current.main
        : Object.freeze(Object.fromEntries(
            Object.entries(incomingMain).reduce((entries, [key, value]) => {
              if (value !== null) entries.push([key, value]);
              return entries;
            }, Object.entries(current.main))
          )) as unknown as Readonly<PreparedStructuralFirePrivateMainDiagnostics>;
      const incomingWorker = boundary?.worker;
      const nextWorker = incomingWorker === undefined || incomingWorker === null
        ? current.worker
        : freezeWorkerDiagnostics({
            ...current.worker,
            ...incomingWorker,
            prepareSeed: incomingWorker.prepareSeed ?? current.worker?.prepareSeed ?? null,
            execute: incomingWorker.execute ?? current.worker?.execute ?? null
          });
      const nextRuntime = Object.freeze({
        ...current.runtime,
        ...(patch.runtime ?? {}),
        ...(boundary === undefined ? {} : {})
      });
      const next = {
        ...current,
        ...(patch.status === undefined ? {} : { status: patch.status }),
        ...(patch.reason === undefined ? {} : { reason: patch.reason }),
        rootJobId: patch.rootJobId ?? boundary?.rootJobId ?? current.rootJobId,
        workerEpoch: patch.workerEpoch ?? boundary?.workerEpoch ?? current.workerEpoch,
        runtime: nextRuntime,
        main: nextMain,
        worker: nextWorker,
        seedCanonicalBytes: boundary?.seedCanonicalBytes ?? current.seedCanonicalBytes,
        resultCanonicalBytes: boundary?.resultCanonicalBytes ?? current.resultCanonicalBytes
      };
      this.#currentDiagnosticTrace = freezeDiagnosticTrace(next);
    } catch {
      // Diagnostics are strictly observational.
    }
  }

  #finishDiagnostic(
    token: number,
    status: PreparedStructuralFirePrivateDiagnosticStatus,
    reason: string | null
  ): void {
    try {
      if (this.#currentDiagnosticToken !== token) return;
      const current = this.#currentDiagnosticTrace;
      if (current === null) return;
      const completed = freezeDiagnosticTrace({ ...current, status, reason });
      this.#lastCompletedDiagnosticTrace = completed;
      this.#currentDiagnosticTrace = null;
      this.#currentDiagnosticToken = null;
    } catch {
      // Diagnostics are strictly observational.
    }
  }

  #diagnosticSnapshot(): Readonly<SurfacePlayRuntimeSnapshot["preparedStructuralFireDiagnostics"]> {
    return Object.freeze({
      current: this.#currentDiagnosticTrace,
      lastCompleted: this.#lastCompletedDiagnosticTrace
    });
  }

  #authorityBinding(simulationTick: number): Readonly<SurfaceAuthorityBinding> {
    return Object.freeze({
      bodyId: this.#authority.state.bodyId as SurfaceAuthorityBinding["bodyId"],
      regionId: this.#authority.state.regionId as SurfaceAuthorityBinding["regionId"],
      surfaceFrameId: this.#authority.state.surfaceFrameId as SurfaceAuthorityBinding["surfaceFrameId"],
      regionRevision: this.#authority.state.regionRevision,
      simulationTick
    });
  }

  #showAction(message: string, simulationTick: number): void {
    this.#latestAction = message;
    this.#latestActionExpiresAtTick = simulationTick + SURFACE_PLAY_ACTION_LIFETIME_TICKS;
  }

  #clearAction(): void {
    this.#latestAction = null;
    this.#latestActionExpiresAtTick = null;
  }

  #showBlock(message: string, simulationTick: number): void {
    this.#latestBlock = message;
    this.#latestBlockExpiresAtTick = simulationTick + SURFACE_PLAY_WARNING_LIFETIME_TICKS;
  }

  #clearBlock(): void {
    this.#latestBlock = null;
    this.#latestBlockExpiresAtTick = null;
  }

  #expireTransientMessages(simulationTick: number): void {
    if (this.#latestActionExpiresAtTick !== null && simulationTick >= this.#latestActionExpiresAtTick) {
      this.#clearAction();
    }
    if (this.#latestBlockExpiresAtTick !== null && simulationTick >= this.#latestBlockExpiresAtTick) {
      this.#clearBlock();
    }
  }

  #refreshCollision(simulationTick: number): void {
    this.#binding = this.#authorityBinding(simulationTick);
    const boundary = this.#world?.shoreBoundary ?? null;
    const terrainChanged = this.#terrainCollisionAuthority !== this.#authority
      || this.#terrainCollisionBoundary !== boundary;
    if (terrainChanged) {
      const adapter = createSurfaceRegionVoxelCollisionAdapter(this.#authority);
      const terrainDelegate = createSurfaceVoxelCollisionDelegate(adapter, this.#authority.state);
      this.#worldBoundTerrain = boundary === null
        ? terrainDelegate
        : createShoreBoundSurfaceCollisionDelegate({ boundary, delegate: terrainDelegate });
      this.#terrainCollisionPort = createRevisionBoundSurfaceCollisionPort({
        readAuthorityBinding: () => this.#binding,
        delegate: this.#worldBoundTerrain
      });
      this.#terrainCollisionAuthority = this.#authority;
      this.#terrainCollisionBoundary = boundary;
    }

    const treeCollision = this.#treeState?.collision ?? null;
    const physicsWorld = this.#treeState?.physicsWorld ?? null;
    if (
      !terrainChanged
      && this.#treeCollisionSource === treeCollision
      && sameRigidBodyCollisionSource(this.#physicsCollisionSource, physicsWorld)
    ) return;
    this.#collisionDelegate = treeCollision === null || physicsWorld === null
      ? this.#worldBoundTerrain
      : createAttachedSurfaceTreeCollisionDelegate({
          terrain: this.#worldBoundTerrain,
          tree: treeCollision,
          physicsWorld
        });
    this.#collisionPort = createRevisionBoundSurfaceCollisionPort({
      readAuthorityBinding: () => this.#binding,
      delegate: this.#collisionDelegate
    });
    this.#treeCollisionSource = treeCollision;
    this.#physicsCollisionSource = physicsWorld;
  }

  #structuralPresentation(
    simulationTick: number
  ): Readonly<SurfaceStructuralPresentationSnapshot> | null {
    if (this.#treeState === null) return null;
    return createSurfaceTreePresentationSnapshot(this.#treeState, {
      bodyId: this.#authority.state.bodyId,
      regionId: this.#authority.state.regionId,
      surfaceFrameId: this.#authority.state.surfaceFrameId,
      regionRevision: this.#authority.state.regionRevision,
      simulationTick
    });
  }

  #adoptTransition(
    transition: Readonly<SurfaceVoxelEditTransition>,
    intent: Readonly<SurfaceVoxelEditIntent>,
    simulationTick: number
  ): SurfacePlayTransitionAdoptionResult {
    let nextWorld = this.#world;
    let nextTreeState = this.#treeState;
    let nextRigidTerrainPatch = this.#rigidTerrainPatch;
    if (this.#world !== null) {
      const transitionAdapter = createSurfaceRegionVoxelCollisionAdapter(transition.authority);
      const worldResult = revalidateHestiaSurfaceWorldIncrementallyAgainstAuthority({
        sourceWorld: this.#world,
        state: transition.state,
        adapter: transitionAdapter,
        frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
        waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
        capsule: this.#config.capsule,
        collisionSkinMeters: this.#config.collisionSkinMeters,
        editIntent: intent,
        editResult: transition.result
      });
      if (worldResult.status === "Rejected") return worldResult;
      if (this.#treeState !== null) {
        if (this.#rigidTerrainPatch === null) return Object.freeze({
          status: "Rejected" as const,
          failure: Object.freeze({
            code: "NoAdmissibleLandFootprint" as const,
            message: "Rigid-body Terrain patch state is unavailable for incremental adoption.",
            attemptedCandidateCount: 0
          })
        });
        const placement = {
          instanceId: this.#treeState.authority.tree.instanceId,
          seed: this.#treeState.authority.tree.seed,
          rootQuantum: this.#treeState.authority.tree.rootQuantum
        };
        const terrainResult = refreshHestiaSurfaceRigidBodyTerrainPatch({
          sourcePatch: this.#rigidTerrainPatch,
          world: worldResult.world,
          placement,
          authorityState: transition.state,
          editIntent: intent,
          editResult: transition.result,
          groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
            state: transition.state,
            adapter: transitionAdapter
          })
        });
        if (terrainResult.status === "Rejected") return terrainResult;
        nextRigidTerrainPatch = terrainResult.patch;
        nextTreeState = Object.freeze({
          ...this.#treeState,
          physicsWorld: replaceSurfaceRigidBodyTerrainColliders(
            this.#treeState.physicsWorld,
            terrainResult.terrainColliders
          )
        });
      }
      nextWorld = worldResult.world;
    }
    if (nextTreeState !== this.#treeState) {
      this.#preparedStructuralFireSeed = null;
    }
    this.#world = nextWorld;
    this.#treeState = nextTreeState;
    this.#rigidTerrainPatch = nextRigidTerrainPatch;
    this.#authority = transition.authority;
    this.#refreshCollision(simulationTick);
    return Object.freeze({ status: "Adopted" });
  }

  #terrainPresentation(): Readonly<SurfaceTerrainPresentationSnapshot> {
    return createSurfaceTerrainPresentationSnapshot({
      bodyId: this.#authority.state.bodyId,
      regionId: this.#authority.state.regionId,
      surfaceFrameId: this.#authority.state.surfaceFrameId,
      regionRevision: this.#authority.state.regionRevision,
      visibleBrickIds: this.#authority.state.materializedBricks
        .map((brick) => surfacePlayPresentationBrickId(brick.coordinate))
        .sort()
    });
  }

  #targetPresentation(): Readonly<SurfaceTargetPresentationSnapshot> {
    return createSurfaceTargetPresentationSnapshot({
      targetId: this.#combatState.drone.damageable.targetEntityId,
      surfaceFrameId: this.#combatState.drone.frameId,
      positionMeters: this.#combatState.drone.positionMeters,
      condition: targetCondition(this.#combatState)
    });
  }

  #hud(): Readonly<SurfacePlayHudSnapshot> {
    const pending = this.#pendingStructuralPreparations.values().next().value as
      | PendingStructuralPreparation
      | undefined;
    const telemetry = pending === undefined
      ? null
      : this.#preparedStructuralFireClient?.readTelemetry() ?? null;
    return createSurfacePlayHudSnapshot({
      mode: "SurfaceFirstPerson",
      movementMode: this.#fixedStep.currentState.movementMode,
      grounded: this.#fixedStep.currentState.grounded,
      energyJoules: this.#combatSnapshot.energyJoules,
      maximumEnergyJoules: this.#combatSnapshot.maximumEnergyJoules,
      heatJoules: this.#combatSnapshot.heatJoules,
      maximumHeatJoules: this.#combatSnapshot.maximumHeatJoules,
      cooldownSeconds: this.#combatSnapshot.cooldownSeconds,
      weaponReadiness: this.#combatSnapshot.readiness,
      targetCondition: this.#combatSnapshot.target?.condition ?? "None",
      ...(this.#structuralFireMode === "AsyncPreparingV2" ? {
        structuralPreparation: pending === undefined ? null : {
            status: pending.status,
            objectId: pending.objectId,
            queueDepth: telemetry?.scheduler.queueDepth ?? (pending.status === "Queued" ? 1 : 0),
            inFlight: telemetry?.scheduler.inFlight ?? (pending.status === "Running" ? 1 : 0),
            latencyMilliseconds: pending.terminalLatencyMilliseconds
              ?? Math.max(0, this.#now() - pending.queuedAtMilliseconds)
          }
      } : {}),
      latestAction: this.#latestAction,
      latestBlock: this.#latestBlock
    });
  }

  #sameStructuralPreparationSource(pending: PendingStructuralPreparation): boolean {
    const state = this.#treeState;
    if (state === null) return false;
    return state.authority.objectId === pending.objectId
      && state.authority.objectRevision === pending.sourceObjectRevision
      && state.authority.editRevision === pending.sourceEditRevision
      && state.authority.objectContentHash === pending.sourceContentHash;
  }

  #completeStructuralPreparation(
    pending: PendingStructuralPreparation,
    result: Readonly<PreparedStructuralFireWorkerClientResult>,
    simulationTick: number
  ): void {
    if (this.#pendingStructuralPreparations.get(pending.objectId) !== pending) return;
    if (result.state === "Completed" && this.#sameStructuralPreparationSource(pending)) {
      pending.terminalLatencyMilliseconds = Math.max(0, this.#now() - pending.queuedAtMilliseconds);
      pending.status = "ReadyToAdopt";
      pending.ready = result.ready;
      const readyToAdoptAtMilliseconds = this.#diagnosticNow();
      this.#patchDiagnostic({
        status: "ReadyToAdopt",
        reason: "FixedTickAdoptionUnavailable",
        token: pending.diagnosticToken,
        runtime: {
          readyToAdoptAtMilliseconds,
          fireDurationMilliseconds: diagnosticDuration(
            this.#currentDiagnosticTrace?.runtime.inputAcceptedAtMilliseconds ?? null,
            readyToAdoptAtMilliseconds
          )
        }
      });
      this.#finishDiagnostic(pending.diagnosticToken, "ReadyToAdopt", "FixedTickAdoptionUnavailable");
      this.#showAction("PREPARING · READY TO ADOPT", simulationTick);
      return;
    }
    const status = result.state === "Cancelled"
      ? "Cancelled" as const
      : result.state === "Stale" || result.state === "ResyncRequired"
        ? "Stale" as const
        : result.state === "Deferred"
          ? "Deferred" as const
          : "Failed" as const;
    const reason = result.state === "Failed" || result.state === "Rejected"
      ? result.reason
      : result.state === "ResyncRequired"
        ? result.reason
        : result.state;
    this.#patchDiagnostic({ token: pending.diagnosticToken, status, reason });
    this.#finishDiagnostic(pending.diagnosticToken, status, reason);
    this.#pendingStructuralPreparations.delete(pending.objectId);
    if (result.state === "Failed" || result.state === "Rejected") {
      this.#showBlock("Tree preparation stopped safely. Aim again.", simulationTick);
    } else {
      this.#showAction("Tree preparation cleared. Aim again.", simulationTick);
    }
  }

  #queueStructuralPreparation(
    command: Readonly<SurfacePlayerCommand>,
    hit: Readonly<SurfaceTreeCollisionHit>
  ): void {
    const state = this.#treeState;
    const client = this.#preparedStructuralFireClient;
    if (state === null || client === null || this.#disposed) return;
    const objectId = state.authority.objectId;
    if (this.#pendingStructuralPreparations.has(objectId)) {
      this.#showAction("Tree preparation already in progress.", command.simulationTick);
      return;
    }
    const inputAcceptedAtMilliseconds = this.#diagnosticNow();
    const queuedAtMilliseconds = this.#now();
    const diagnosticToken = this.#beginDiagnostic("Fire", state, {
      inputAcceptedAtMilliseconds,
      queuedAtMilliseconds,
      queueWaitDurationMilliseconds: null
    });
    const pending: PendingStructuralPreparation = {
      objectId,
      diagnosticToken,
      queuedAtMilliseconds,
      sourceObjectRevision: state.authority.objectRevision,
      sourceEditRevision: state.authority.editRevision,
      sourceContentHash: state.authority.objectContentHash,
      controller: new AbortController(),
      terminalLatencyMilliseconds: null,
      status: "Queued",
      ready: null
    };
    this.#pendingStructuralPreparations.set(objectId, pending);
    this.#showAction("PREPARING · QUEUED", command.simulationTick);
    void Promise.resolve().then(async () => {
      if (this.#disposed || this.#pendingStructuralPreparations.get(objectId) !== pending) return;
      pending.status = "Running";
      const runningAtMilliseconds = this.#diagnosticNow();
      this.#patchDiagnostic({
        token: diagnosticToken,
        status: "Running",
        runtime: {
          runningAtMilliseconds,
          queueWaitDurationMilliseconds: diagnosticDuration(
            this.#currentDiagnosticTrace?.runtime.queuedAtMilliseconds ?? null,
            runningAtMilliseconds
          )
        }
      });
      this.#showAction("PREPARING · RUNNING", command.simulationTick);
      try {
        const seedPreparationInput = {
          fireCommandId: command.commandId,
          hit,
          simulationTick: command.simulationTick
        } as const;
        const workerPreparationStateStartAtMilliseconds = this.#diagnosticNow();
        this.#patchDiagnostic({
          token: diagnosticToken,
          runtime: { workerPreparationStateStartAtMilliseconds }
        });
        const workerPreparationState = this.#workerPreparationState();
        const workerPreparationStateEndAtMilliseconds = this.#diagnosticNow();
        this.#patchDiagnostic({
          token: diagnosticToken,
          runtime: {
            workerPreparationStateEndAtMilliseconds,
            workerPreparationStateDurationMilliseconds: diagnosticDuration(
              workerPreparationStateStartAtMilliseconds,
              workerPreparationStateEndAtMilliseconds
            )
          }
        });
        if (workerPreparationState === null) {
          const reason = "Preparation state unavailable.";
          this.#patchDiagnostic({ token: diagnosticToken, status: "Failed", reason });
          this.#finishDiagnostic(diagnosticToken, "Failed", reason);
          this.#pendingStructuralPreparations.delete(objectId);
          this.#showBlock("Tree preparation stopped safely. Aim again.", command.simulationTick);
          return;
        }
        const cachedSeed = this.#preparedStructuralFireSeed;
        const cachedSeedMatches = cachedSeed !== null
          && this.#preparedStructuralFireSeedMatches(state, cachedSeed)
          && client.hasPreparedSeed(
            objectId,
            preparedStructuralFireSeedHash(cachedSeed.manifest)
          );
        const prepared = cachedSeedMatches
          ? {
              state: "Prepared" as const,
              input: createSurfaceTreePreparedFireWorkerRunInput(
                state,
                seedPreparationInput,
                cachedSeed.manifest
              )
            }
          : typeof client.prepareSeed === "function"
              ? await client.prepareSeed({ state: workerPreparationState, input: seedPreparationInput }, {
                signal: pending.controller.signal,
                observeDiagnostics: (diagnostics) => this.#patchDiagnostic({
                  token: diagnosticToken,
                  boundary: diagnostics
                })
              })
            : {
                state: "Prepared" as const,
                input: createSurfaceTreePreparedFireWorkerInput(state, seedPreparationInput)
              };
        if (prepared.state !== "Prepared") {
          this.#completeStructuralPreparation(pending, prepared, command.simulationTick);
          return;
        }
        const workerInput = prepared.input;
        if (workerInput.seedManifest !== undefined) {
          this.#preparedStructuralFireSeed = Object.freeze({
            objectId,
            sourceObjectRevision: state.authority.objectRevision,
            sourceEditRevision: state.authority.editRevision,
            sourceContentHash: state.authority.objectContentHash,
            physicsSeedFactsHash: preparedStructuralFirePhysicsSeedFactsHash(state.physicsWorld),
            manifest: workerInput.seedManifest
          });
        }
        const result = await client.run(workerInput, {
          readSource: () => {
            const current = this.#treeState;
            if (current === null) return workerInput.request.source;
            return Object.freeze({
              objectId: current.authority.objectId,
              objectRevision: current.authority.objectRevision,
              editRevision: current.authority.editRevision,
              contentHash: current.authority.objectContentHash as PreparedStructuralFireHash
            });
          },
          readTick: () => this.#fixedStep.currentState.simulationTick,
          signal: pending.controller.signal,
          observeDiagnostics: (diagnostics) => this.#patchDiagnostic({
            token: diagnosticToken,
            boundary: diagnostics
          })
        });
        this.#completeStructuralPreparation(pending, result, command.simulationTick);
      } catch {
        this.#patchDiagnostic({
          token: diagnosticToken,
          status: "Failed",
          reason: "Runtime preparation exception."
        });
        this.#finishDiagnostic(diagnosticToken, "Failed", "Runtime preparation exception.");
        this.#pendingStructuralPreparations.delete(objectId);
        this.#showBlock("Tree preparation stopped safely. Aim again.", command.simulationTick);
      }
    });
  }

  #voxelIntent(result: Readonly<SurfaceCombatRuntimeResult>): Readonly<SurfaceVoxelEditIntent> {
    if (result.impactIntent === null) throw new Error("Terrain result must carry a Surface impact intent.");
    const centerMeters = {
      x: quantizeSurfaceHitCoordinateMeters(result.impactIntent.hitPointMeters.x),
      y: quantizeSurfaceHitCoordinateMeters(result.impactIntent.hitPointMeters.y),
      z: quantizeSurfaceHitCoordinateMeters(result.impactIntent.hitPointMeters.z)
    };
    const shotSequence = result.state.weapon.shotSequence;
    return Object.freeze({
      schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
      editId: `surface-edit:${this.#routeId}:${result.impactIntent.simulationTick}:${shotSequence}`,
      expectedRegionRevision: this.#authority.state.regionRevision,
      tick: result.impactIntent.simulationTick,
      actorId: this.#fixedStep.currentState.playerId,
      sourceId: String(result.impactIntent.sourceWeaponId),
      sourceImpactIntentId: result.impactIntent.intentId,
      bodyId: this.#authority.state.bodyId,
      surfaceFrameId: this.#authority.state.surfaceFrameId,
      regionId: this.#authority.state.regionId,
      operation: "SubtractSphere",
      centerGlobalQuantum: Object.freeze({
        x: centerMeters.x / SURFACE_VOXEL_EDIT_QUANTUM_METERS,
        y: centerMeters.y / SURFACE_VOXEL_EDIT_QUANTUM_METERS,
        z: centerMeters.z / SURFACE_VOXEL_EDIT_QUANTUM_METERS
      }),
      quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
      radiusMeters: result.impactIntent.suggestedEditRadiusMeters
    });
  }

  #applyTerrainImpact(
    combatResult: Readonly<SurfaceCombatRuntimeResult>,
    rejections: SurfacePlayRuntimeRejection[]
  ): SurfaceTerrainImpactResult {
    const intent = this.#voxelIntent(combatResult);
    let transition: Readonly<SurfaceVoxelEditTransition>;
    try {
      transition = this.#applyVoxelEdit(this.#authority, intent);
    } catch {
      const rejected = Object.freeze({
        kind: "VoxelEdit" as const,
        code: "AuthorityRefused" as const,
        message: "Terrain edit authority refused the accepted impact.",
        simulationTick: intent.tick
      });
      this.#latestRejection = rejected;
      this.#showBlock("The terrain cut could not be applied. Aim at a stable surface.", intent.tick);
      rejections.push(rejected);
      return Object.freeze({ status: "Rejected", refundCombatCost: false });
    }
    if (transition.result.status === "Rejected") {
      const rejected = Object.freeze({
        kind: "VoxelEdit" as const,
        code: voxelRejectionCode(transition.result.reason),
        message: transition.result.message,
        simulationTick: intent.tick
      });
      this.#latestVoxelTransition = Object.freeze({ intent, result: transition.result, remeshPlan: null });
      this.#latestRejection = rejected;
      this.#showBlock(playerFacingVoxelBlock(rejected.code), intent.tick);
      rejections.push(rejected);
      return Object.freeze({ status: "Rejected", refundCombatCost: false });
    }

    const adoption = this.#adoptTransition(transition, intent, intent.tick);
    if (adoption.status === "Rejected") {
      const rejected = Object.freeze({
        kind: "VoxelEdit" as const,
        code: "AuthorityRefused" as const,
        message: adoption.failure.message,
        simulationTick: intent.tick
      });
      this.#latestRejection = rejected;
      this.#showBlock("The terrain cut would make this test area unsafe. Aim farther from the dry boundary.", intent.tick);
      rejections.push(rejected);
      return Object.freeze({ status: "Rejected", refundCombatCost: true });
    }
    const remeshPlan = transition.result.status === "Applied"
      ? createSurfaceVoxelRemeshPlan(transition.result, {
          bodyId: transition.state.bodyId,
          regionId: transition.state.regionId,
          surfaceFrameId: transition.state.surfaceFrameId,
          regionRevision: transition.state.regionRevision,
          editRevision: transition.state.editRevision,
          residentBrickKeys: transition.state.materializedBricks.map((brick) => brick.key),
          maxRemeshBricks: transition.state.materializedBricks.length,
          maxEstimatedCellWork: transition.state.materializedBricks.length * VOXEL_BRICK_CELL_COUNT
        })
      : null;
    this.#latestVoxelTransition = Object.freeze({ intent, result: transition.result, remeshPlan });
    if (transition.result.status === "Applied") this.#appliedVoxelTransitions.push(this.#latestVoxelTransition);
    this.#latestRejection = null;
    this.#clearBlock();
    this.#showAction(
      transition.result.status === "Applied" ? "Terrain cut applied." : "Terrain already clear.",
      intent.tick
    );
    this.#presentation = Object.freeze({ ...this.#presentation, terrain: this.#terrainPresentation() });
    return Object.freeze({ status: "Adopted" });
  }

  #createCombatRaycast(
    command: Readonly<SurfacePlayerCommand>,
    prepareOnly = false
  ): Readonly<{
    readonly port: SurfaceTargetTerrainRaycastPort;
    readonly readTreePreflight: () => SurfaceTreeFirePreflight | null;
    readonly readTreeHit: () => Readonly<SurfaceTreeCollisionHit> | null;
  }> {
    let treePreflight: SurfaceTreeFirePreflight | null = null;
    let treeHit: Readonly<SurfaceTreeCollisionHit> | null = null;
    const base = createCombatCoreSurfaceRaycastPort(
      createSurfaceTerrainRaycastAdapter((query) => this.#terrainCollisionPort.queryRay(query))
    );
    const port: SurfaceTargetTerrainRaycastPort = {
      query: (request: Readonly<SurfaceCombatRaycastRequest>): SurfaceCombatRaycastCandidate => {
        const baseCandidate = base.query(request);
        if (baseCandidate.kind === "Blocked" || this.#treeState === null) return baseCandidate;

        const treeState = this.#treeState;
        const structural = raycastSurfaceTreeCollision(treeState.collision, {
          binding: createSurfaceTreeCollisionBinding(treeState.collision),
          originMeters: request.ray.origin,
          direction: request.ray.direction,
          maximumDistanceMeters: request.ray.maximumDistanceMeters
        });
        if (structural.status === "Rejected") {
          return Object.freeze({
            kind: "Blocked" as const,
            code: "AuthorityRefused" as const,
            message: "Structural Tree ray authority is stale or unavailable."
          });
        }
        const dynamic = raycastSurfaceRigidBodies(treeState.physicsWorld, {
          originMeters: request.ray.origin,
          direction: request.ray.direction,
          maximumDistanceMeters: request.ray.maximumDistanceMeters
        });
        const baseDistance = baseCandidate.kind === "CombatTargetHit"
          || baseCandidate.kind === "TerrainHit"
          ? baseCandidate.distanceMeters
          : Number.POSITIVE_INFINITY;
        const baseRank = baseCandidate.kind === "CombatTargetHit"
          ? 0
          : baseCandidate.kind === "TerrainHit"
            ? 3
            : 4;
        const candidates: Array<{
          readonly kind: "Base" | "Structural" | "Dynamic";
          readonly distanceMeters: number;
          readonly rank: number;
        }> = [{
          kind: "Base",
          distanceMeters: baseDistance,
          rank: baseRank
        }];
        if (structural.kind === "Hit") {
          candidates.push({
            kind: "Structural",
            distanceMeters: structural.distanceMeters,
            rank: 1
          });
        }
        if (dynamic.status === "Hit") {
          candidates.push({
            kind: "Dynamic",
            distanceMeters: dynamic.hit.distanceMeters,
            rank: 2
          });
        }
        const nearest = candidates.sort((left, right) =>
          left.distanceMeters - right.distanceMeters
          || left.rank - right.rank)[0];
        if (nearest.kind === "Base") return baseCandidate;
        if (nearest.kind === "Dynamic") {
          if (dynamic.status !== "Hit") throw new Error("Selected Dynamic ray candidate disappeared.");
          return Object.freeze({
            kind: "DetachedBodyHit" as const,
            bodyId: dynamic.hit.bodyId,
            point: dynamic.hit.pointMeters,
            normal: dynamic.hit.normal,
            distanceMeters: dynamic.hit.distanceMeters
          });
        }
        if (structural.kind !== "Hit") throw new Error("Selected Structural ray candidate disappeared.");
        treeHit = structural.hit;
        if (prepareOnly) {
          return Object.freeze({
            kind: "StructuralPrepareHit" as const,
            objectId: treeState.authority.objectId,
            structuralCommandId: deriveSurfaceTreePreparedStructuralCommandId(
              treeState,
              command.commandId
            ),
            point: structural.hit.pointMeters,
            normal: structural.hit.normal,
            distanceMeters: structural.distanceMeters
          });
        }
        treePreflight = preflightSurfaceTreeFire(treeState, {
          fireCommandId: command.commandId,
          hit: structural.hit,
          simulationTick: command.simulationTick
        });
        if (treePreflight.status === "Rejected") {
          return Object.freeze({
            kind: "Blocked" as const,
            code: treePreflight.code === "StructuralAuthorityRefused"
              ? "AuthorityRefused" as const
              : treePreflight.code,
            message: treePreflight.code === "BodyCapacityExceeded"
              ? "Surface rigid-body capacity would be exceeded."
              : treePreflight.code === "ColliderBudgetExceeded"
                ? "The detached Structural collider budget would be exceeded."
                : "Structural Tree authority refused the local edit."
          });
        }
        return Object.freeze({
          kind: "StructuralHit" as const,
          objectId: treeState.authority.objectId,
          structuralCommandId: treePreflight.structuralCommandId,
          supportResult: treePreflight.supportResult,
          suggestedEditRadiusMeters: treePreflight.suggestedEditRadiusMeters,
          point: structural.hit.pointMeters,
          normal: structural.hit.normal,
          distanceMeters: structural.distanceMeters
        });
      }
    };
    return Object.freeze({
      port: Object.freeze(port),
      readTreePreflight: () => treePreflight,
      readTreeHit: () => treeHit
    });
  }

  #processCombat(command: Readonly<SurfacePlayerCommand>, rejections: SurfacePlayRuntimeRejection[]): void {
    this.#combatState = advanceSurfaceCombatRuntime(this.#combatState, this.#config.fixedDeltaSeconds);
    this.#combatSnapshot = combatSnapshot(this.#combatState, command.simulationTick, this.#combatSnapshot);
    const view = createSurfaceFirstPersonViewSnapshot(this.#fixedStep.currentState, this.#config);
    if (!command.fire) {
      this.#presentation = Object.freeze({
        ...this.#presentation,
        target: this.#targetPresentation(),
        weapon: createSurfaceWeaponPresentationSnapshot({
          weaponId: HESTIA_PULSE_CUTTER_V1.weaponId,
          ownerPlayerId: this.#fixedStep.currentState.playerId,
          surfaceFrameId: this.#fixedStep.currentState.surfaceFrameId,
          muzzlePositionMeters: view.eyePositionMeters,
          cooldownSeconds: this.#combatState.weapon.cooldownSeconds,
          firing: false
        })
      });
      return;
    }

    const pose = createWeaponMountPose({
      sourceEntityId: this.#fixedStep.currentState.playerId,
      ownerId: `surface-owner:${this.#routeId}`,
      frameId: this.#fixedStep.currentState.surfaceFrameId,
      muzzlePosition: view.eyePositionMeters,
      forward: view.forward,
      up: view.up,
      muzzleDirection: view.forward,
      sourceVelocity: this.#fixedStep.currentState.velocityMetersPerSecond
    });
    const prepareOnly = this.#structuralFireMode === "AsyncPreparingV2";
    const raycast = this.#createCombatRaycast(command, prepareOnly);
    const combatInput = {
      state: this.#combatState,
      player: createSurfacePlayerContractSnapshot(this.#fixedStep.currentState),
      command: {
        commandId: command.commandId,
        playerId: command.playerId,
        surfaceFrameId: command.surfaceFrameId,
        simulationTick: command.simulationTick
      },
      pose,
      binding: this.#binding,
      raycast: raycast.port
    } as const;
    let result: Readonly<SurfaceCombatRuntimeResult>;
    if (prepareOnly) {
      const probe = probeSurfaceCombatFire(combatInput);
      if (probe.kind === "Candidate" && probe.candidate.kind === "StructuralPrepareHit") {
        const treeHit = raycast.readTreeHit();
        if (treeHit === null) throw new Error("Structural preparation candidate has no collision hit.");
        this.#queueStructuralPreparation(command, treeHit);
        return;
      }
      result = executeSurfaceCombatFire({
        ...combatInput,
        raycast: probe.kind === "Candidate"
          ? Object.freeze({ query: () => probe.candidate })
          : raycast.port
      });
    } else {
      result = executeSurfaceCombatFire(combatInput);
    }
    const treePreflight = raycast.readTreePreflight();
    if (treePreflight?.status === "Rejected") {
      this.#treeState = treePreflight.state;
    } else if (result.kind === "StructuralHit") {
      if (treePreflight === null || treePreflight.status !== "Ready") {
        throw new Error("Accepted Structural fire has no matching pure preflight reservation.");
      }
      this.#treeState = treePreflight.state;
      this.#refreshCollision(command.simulationTick);
    }
    const terrainImpact = result.kind === "TerrainHit"
      ? this.#applyTerrainImpact(result, rejections)
      : null;
    if (terrainImpact?.status === "Rejected" && terrainImpact.refundCombatCost) return;
    this.#combatState = result.state;
    this.#combatSnapshot = result.snapshot;
    const replay = replaySurfaceCombatPresentation(result, this.#fixedStep.currentState.playerId, view.eyePositionMeters);
    this.#presentation = Object.freeze({
      ...this.#presentation,
      target: replay.target,
      weapon: replay.weapon,
      impact: replay.impact
    });
    if (terrainImpact?.status === "Rejected") return;
    if (result.snapshot.latestFireResult?.status === "Rejected") {
      const rejected = Object.freeze({
        kind: "Fire" as const,
        code: result.snapshot.latestFireResult.code,
        message: result.snapshot.latestFireResult.message,
        simulationTick: command.simulationTick
      });
      this.#latestRejection = rejected;
      this.#showBlock(playerFacingFireBlock(rejected.code), command.simulationTick);
      rejections.push(rejected);
      return;
    }
    this.#latestRejection = null;
    this.#clearBlock();
    if (result.kind === "CombatTargetHit") this.#showAction("Pulse Cutter hit target.", command.simulationTick);
    else if (result.kind === "StructuralHit") this.#showAction("Tree cut applied.", command.simulationTick);
    else if (result.kind === "Miss") this.#showAction("Pulse Cutter missed.", command.simulationTick);
  }

  advance(elapsedSeconds: number, commandFactory: SurfaceFixedStepCommandFactory): Readonly<SurfacePlayRuntimeAdvanceResult> {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      throw new RangeError("Surface Play elapsed time must be finite and non-negative.");
    }
    const existingPhysicsFailure = this.#treeState?.physicsWorld.physicsFailure ?? null;
    if (existingPhysicsFailure !== null) {
      const failure = Object.freeze({
        kind: "Physics" as const,
        code: existingPhysicsFailure.code,
        message: "Surface physics stopped safely. Re-enter Surface Play to clear fallen debris.",
        simulationTick: existingPhysicsFailure.simulationTick
      });
      this.#latestRejection = failure;
      this.#showBlock(failure.message, failure.simulationTick);
      return Object.freeze({
        status: "Rejected" as const,
        steps: 0,
        snapshot: this.read(),
        rejections: Object.freeze([failure])
      });
    }
    let remainingSeconds = elapsedSeconds;
    let steps = 0;
    let rejected = false;
    const rejections: SurfacePlayRuntimeRejection[] = [];
    while (
      remainingSeconds > 1e-12
      || this.#fixedStep.accumulatorSeconds + 1e-12 >= this.#config.fixedDeltaSeconds
    ) {
      const neededSeconds = Math.max(0, this.#config.fixedDeltaSeconds - this.#fixedStep.accumulatorSeconds);
      const chunkSeconds = Math.min(remainingSeconds, neededSeconds);
      let command: Readonly<SurfacePlayerCommand> | null = null;
      const result = advanceSurfaceFixedStepRuntime(
        this.#fixedStep,
        chunkSeconds,
        (simulationTick, state) => {
          command = commandFactory(simulationTick, state);
          return command;
        },
        {
          bodyId: this.#authority.state.bodyId,
          regionId: this.#authority.state.regionId,
          surfaceFrameId: this.#authority.state.surfaceFrameId,
          regionRevision: this.#authority.state.regionRevision
        },
        (() => {
          this.#binding = this.#authorityBinding(this.#fixedStep.currentState.simulationTick + 1);
          return this.#collisionPort;
        })(),
        this.#config
      );
      remainingSeconds -= chunkSeconds;
      this.#fixedStep = result.runtime;
      if (result.status === "Rejected") {
        const runtimeRejection = Object.freeze({
          kind: "Locomotion" as const,
          code: result.rejection.code,
          message: result.rejection.message,
          simulationTick: this.#fixedStep.currentState.simulationTick + 1
        });
        this.#latestRejection = runtimeRejection;
        this.#showBlock("Movement paused because the surface state changed.", runtimeRejection.simulationTick);
        rejections.push(runtimeRejection);
        rejected = true;
        break;
      }
      if (result.steps === 0) break;
      const executedCommand = command as Readonly<SurfacePlayerCommand> | null;
      if (executedCommand === null) throw new Error("Advanced Surface Play tick did not provide exactly one player command.");
      steps += 1;
      this.#binding = this.#authorityBinding(executedCommand.simulationTick);
      this.#expireTransientMessages(executedCommand.simulationTick);
      this.#processCombat(executedCommand, rejections);
      if (this.#treeState !== null) {
        const previousTreeState = this.#treeState;
        this.#treeState = advanceSurfaceTreePhysics(this.#treeState);
        const physicsFailure = this.#treeState.physicsWorld.physicsFailure;
        if (physicsFailure === null) {
          const separation = separateSurfaceRigidBodyCapsule(this.#treeState.physicsWorld, {
            capsule: this.#fixedStep.currentState.capsule,
            positionMeters: this.#fixedStep.currentState.positionMeters,
            skinMeters: this.#config.collisionSkinMeters
          });
          if (separation.status === "Blocked") {
            this.#treeState = previousTreeState;
          } else {
            this.#fixedStep = applySurfaceFixedStepCapsuleSeparation(
              this.#fixedStep,
              {
                positionMeters: separation.positionMeters,
                contactNormals: separation.contacts.map((contact) => contact.normal)
              },
              this.#config.fixedDeltaSeconds
            );
          }
        }
        this.#refreshCollision(executedCommand.simulationTick);
        if (physicsFailure !== null) {
          const runtimeRejection = Object.freeze({
            kind: "Physics" as const,
            code: physicsFailure.code,
            message: "Surface physics stopped safely. Re-enter Surface Play to clear fallen debris.",
            simulationTick: physicsFailure.simulationTick
          });
          this.#latestRejection = runtimeRejection;
          this.#showBlock(runtimeRejection.message, runtimeRejection.simulationTick);
          rejections.push(runtimeRejection);
          rejected = true;
          break;
        }
      }
    }
    this.#binding = this.#authorityBinding(this.#fixedStep.currentState.simulationTick);
    this.#presentation = Object.freeze({
      ...this.#presentation,
      player: createSurfacePlayerPresentationSnapshot(this.#fixedStep),
      structural: this.#structuralPresentation(this.#fixedStep.currentState.simulationTick)
    });
    return Object.freeze({
      status: rejected ? "Rejected" as const : "Advanced" as const,
      steps,
      snapshot: this.read(),
      rejections: Object.freeze([...rejections])
    });
  }

  read(): Readonly<SurfacePlayRuntimeSnapshot> {
    return Object.freeze({
      authorityState: this.#authority.state,
      world: this.#world,
      fixedStep: this.#fixedStep,
      player: createSurfacePlayerContractSnapshot(this.#fixedStep.currentState),
      firstPersonView: createSurfaceFirstPersonViewSnapshot(this.#fixedStep.currentState, this.#config),
      combat: this.#combatSnapshot,
      hud: this.#hud(),
      presentation: this.#presentation,
      appliedVoxelTransitions: Object.freeze([...this.#appliedVoxelTransitions]),
      latestVoxelTransition: this.#latestVoxelTransition,
      latestRejection: this.#latestRejection,
      preparedStructuralFireDiagnostics: this.#diagnosticSnapshot()
    });
  }

  materializeBrick(key: string): Readonly<SurfaceRegionMaterializedVoxelBrick> | undefined {
    return this.#authority.materializeBrick(key);
  }

  resolveStructuralMeshArtifact(
    meshArtifactId: string
  ): Readonly<SurfaceTreeStructuralMeshArtifact> | undefined {
    const cached = this.#structuralMeshArtifacts.get(meshArtifactId);
    if (cached !== undefined) return cached;
    if (this.#treeState === null) return undefined;
    const artifact = resolveSurfaceTreeStructuralMeshArtifact(this.#treeState, meshArtifactId);
    if (artifact !== undefined) this.#structuralMeshArtifacts.set(meshArtifactId, artifact);
    return artifact;
  }

  async warmPreparedStructuralFireSeed(): Promise<void> {
    const client = this.#preparedStructuralFireClient;
    const state = this.#treeState;
    if (this.#structuralFireMode !== "AsyncPreparingV2" || client === null || state === null || this.#disposed) return;
    const cell = state.collision.cells[0];
    if (cell === undefined) return;
    const hit: SurfaceTreeCollisionHit = Object.freeze({
      address: cell.address,
      materialId: cell.materialId,
      semanticKey: cell.semanticKey,
      pointMeters: Object.freeze({
        x: (cell.minMeters.x + cell.maxMeters.x) / 2,
        y: (cell.minMeters.y + cell.maxMeters.y) / 2,
        z: (cell.minMeters.z + cell.maxMeters.z) / 2
      }),
      normal: Object.freeze({ x: 0, y: 1, z: 0 })
    });
    const prewarmStartAtMilliseconds = this.#diagnosticNow();
    const diagnosticToken = this.#beginDiagnostic("WarmSeed", state, {
      prewarmStartAtMilliseconds
    });
    try {
      const prewarmWorkerPreparationStateStartAtMilliseconds = this.#diagnosticNow();
      this.#patchDiagnostic({
        token: diagnosticToken,
        runtime: { prewarmWorkerPreparationStateStartAtMilliseconds }
      });
      const transportState = this.#workerPreparationState();
      const prewarmWorkerPreparationStateEndAtMilliseconds = this.#diagnosticNow();
      if (transportState === null) {
        this.#patchDiagnostic({
          token: diagnosticToken,
          status: "Failed",
          reason: "Preparation state unavailable.",
          runtime: {
            prewarmWorkerPreparationStateEndAtMilliseconds,
            prewarmWorkerPreparationStateDurationMilliseconds: diagnosticDuration(
              prewarmWorkerPreparationStateStartAtMilliseconds,
              prewarmWorkerPreparationStateEndAtMilliseconds
            ),
            prewarmEndAtMilliseconds: prewarmWorkerPreparationStateEndAtMilliseconds,
            prewarmDurationMilliseconds: diagnosticDuration(
              prewarmStartAtMilliseconds,
              prewarmWorkerPreparationStateEndAtMilliseconds
            )
          }
        });
        this.#finishDiagnostic(diagnosticToken, "Failed", "Preparation state unavailable.");
        return;
      }
      const prepared = await client.prepareSeed({
        state: transportState,
        input: Object.freeze({
          fireCommandId: "surface-tree-prewarm",
          hit,
          simulationTick: this.#fixedStep.currentState.simulationTick
        })
      }, {
        observeDiagnostics: (diagnostics) => this.#patchDiagnostic({
          token: diagnosticToken,
          boundary: diagnostics
        })
      });
      const prewarmEndAtMilliseconds = this.#diagnosticNow();
      this.#patchDiagnostic({
        token: diagnosticToken,
        runtime: {
          prewarmWorkerPreparationStateEndAtMilliseconds,
          prewarmWorkerPreparationStateDurationMilliseconds: diagnosticDuration(
            prewarmWorkerPreparationStateStartAtMilliseconds,
            prewarmWorkerPreparationStateEndAtMilliseconds
          ),
          prewarmEndAtMilliseconds,
          prewarmDurationMilliseconds: diagnosticDuration(
            prewarmStartAtMilliseconds,
            prewarmEndAtMilliseconds
          )
        }
      });
      if (prepared.state === "Failed") {
        this.#finishDiagnostic(diagnosticToken, "Failed", prepared.reason);
        throw new Error(prepared.reason);
      }
      if (prepared.state === "Prepared" && prepared.input.seedManifest !== undefined) {
        this.#preparedStructuralFireSeed = Object.freeze({
          objectId: state.authority.objectId,
          sourceObjectRevision: state.authority.objectRevision,
          sourceEditRevision: state.authority.editRevision,
          sourceContentHash: state.authority.objectContentHash,
          physicsSeedFactsHash: preparedStructuralFirePhysicsSeedFactsHash(state.physicsWorld),
          manifest: prepared.input.seedManifest
        });
        this.#finishDiagnostic(diagnosticToken, "Completed", null);
      } else if (prepared.state === "Cancelled") {
        this.#finishDiagnostic(diagnosticToken, "Cancelled", "Cancelled");
      } else if (prepared.state === "Deferred") {
        this.#finishDiagnostic(diagnosticToken, "Deferred", prepared.reason);
      } else if (prepared.state === "Prepared") {
        const reason = "Prepared seed worker returned no seed manifest.";
        this.#finishDiagnostic(diagnosticToken, "Failed", reason);
        throw new Error(reason);
      }
    } catch (error) {
      if (this.#currentDiagnosticTrace !== null) {
        this.#finishDiagnostic(
          diagnosticToken,
          "Failed",
          error instanceof Error ? error.message : "Prepared seed prewarm failed."
        );
      }
      throw error;
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const pending of this.#pendingStructuralPreparations.values()) {
      pending.controller.abort();
    }
    this.#pendingStructuralPreparations.clear();
    if (this.#currentDiagnosticTrace !== null && this.#currentDiagnosticToken !== null) {
      this.#finishDiagnostic(this.#currentDiagnosticToken, "Cancelled", "Runtime disposed.");
    }
    this.#preparedStructuralFireSeed = null;
  }
}

export const createSurfacePlayRuntime = (options: SurfacePlayRuntimeOptions): SurfacePlayRuntime =>
  new SurfacePlayRuntimeImpl(options);

export const advanceSurfacePlayRuntime = (
  runtime: SurfacePlayRuntime,
  elapsedSeconds: number,
  commandFactory: SurfaceFixedStepCommandFactory
): Readonly<SurfacePlayRuntimeAdvanceResult> => runtime.advance(elapsedSeconds, commandFactory);

export const readSurfacePlayRuntime = (
  runtime: SurfacePlayRuntime
): Readonly<SurfacePlayRuntimeSnapshot> => runtime.read();

export const materializeSurfacePlayBrick = (
  runtime: SurfacePlayRuntime,
  key: string
): Readonly<SurfaceRegionMaterializedVoxelBrick> | undefined => runtime.materializeBrick(key);
