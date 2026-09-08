import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  deepFreeze,
  hashAdaptiveCanonical as adaptiveHashCanonical,
  requireExactKeys as adaptiveRequireExactKeys,
  requireFinite as adaptiveRequireFinite,
  requirePlainRecord as adaptiveRequirePlainRecord,
  type MeterPoint
} from "../adaptive";
import { globalQuantumForStructuralCell } from "./coordinates";
import type {
  StructuralCellAddress,
  StructuralComponentClassification,
  StructuralFragmentId,
  StructuralObject
} from "./types";
import { normalizeAdaptiveAuthorityFunction } from "./validation";
import type {
  StructuralInstalledPhysicsTransition,
  StructuralParentMotionSource
} from "./physicsTransition";

const hashAdaptiveCanonical = normalizeAdaptiveAuthorityFunction(adaptiveHashCanonical);
const requireExactKeys = normalizeAdaptiveAuthorityFunction(adaptiveRequireExactKeys);
const requireFinite = normalizeAdaptiveAuthorityFunction(adaptiveRequireFinite);
const requirePlainRecord = normalizeAdaptiveAuthorityFunction(adaptiveRequirePlainRecord);

export const STRUCTURAL_PHYSICS_COMMIT_SCHEMA_VERSION = "structural-microvoxel-physics-commit-v1" as const;

export class StructuralPhysicsCommitError extends Error {
  readonly code: "InvalidStructuralState" | "CommitFailed";
  readonly path: string;
  readonly phase: "validate" | "create" | "remove";
  readonly worldRestored: boolean;

  constructor(
    code: "InvalidStructuralState" | "CommitFailed",
    path: string,
    message: string,
    phase: "validate" | "create" | "remove",
    worldRestored: boolean
  ) {
    super(message);
    this.name = "StructuralPhysicsCommitError";
    this.code = code;
    this.path = path;
    this.phase = phase;
    this.worldRestored = worldRestored;
  }
}

const fail = (
  code: "InvalidStructuralState" | "CommitFailed",
  path: string,
  message: string,
  phase: "validate" | "create" | "remove",
  worldRestored: boolean
): never => {
  throw new StructuralPhysicsCommitError(code, path, message, phase, worldRestored);
};

export interface StructuralWorldQuaternion {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export interface StructuralParentWorldPose {
  readonly translationMeters: MeterPoint;
  readonly rotation: StructuralWorldQuaternion;
}

export type StructuralColliderMassSpec =
  | { readonly kind: "massless" }
  | {
      readonly kind: "canonical-body";
      readonly massKg: number;
      readonly centerOfMassLocal: MeterPoint;
      readonly principalInertia: MeterPoint;
      readonly frame: StructuralWorldQuaternion;
    };

export interface StructuralWorldCuboid {
  readonly halfExtentsMeters: MeterPoint;
  readonly offsetWrtBodyMeters: MeterPoint;
}

export interface StructuralBodyPoseMotion {
  readonly dynamic: boolean;
  readonly translationMeters: MeterPoint;
  readonly rotation: StructuralWorldQuaternion;
  readonly linvelMetersPerSecond: MeterPoint;
  readonly angvelRadPerSecond: MeterPoint;
}

/**
 * Solver-neutrale Weltgrenze. Der Commit ruft niemals `step` auf (keine
 * Methode dafuer vorhanden): Ueberlappung zwischen altem Parent und neuen
 * Bodies ist ohne Step unbeobachtbar, der Tausch ist atomar im
 * Step-Zaehler-Sinn. Fehlererkennung nach Mutationsbeginn raeumt erstellte
 * Bodies wieder ab, bevor der Parent entfernt wurde — die Welt steht dann
 * exakt wie vor dem Commit.
 */
export interface StructuralPhysicsWorldPort<BodyRef> {
  bodiesLen(): number;
  collidersLen(): number;
  createBody(pose: StructuralBodyPoseMotion): BodyRef;
  addCollider(body: BodyRef, cuboid: StructuralWorldCuboid, mass: StructuralColliderMassSpec): void;
  bodyColliderCount(body: BodyRef): number;
  removeBody(body: BodyRef): void;
}

export interface StructuralPhysicsCommitRequest<BodyRef> {
  readonly port: StructuralPhysicsWorldPort<BodyRef>;
  readonly parentBody: BodyRef;
  readonly plan: StructuralInstalledPhysicsTransition;
  readonly live: StructuralObject;
  readonly classification: StructuralComponentClassification;
  readonly parentWorldPose?: StructuralParentWorldPose;
  readonly preCutCenterAuthorMeters?: MeterPoint;
}

export interface StructuralCommittedFragment {
  readonly fragmentId: StructuralFragmentId;
  readonly installedColliderCount: number;
  readonly translationMeters: MeterPoint;
  readonly linvelMetersPerSecond: MeterPoint;
}

export interface StructuralPhysicsCommitReceipt {
  readonly schemaVersion: typeof STRUCTURAL_PHYSICS_COMMIT_SCHEMA_VERSION;
  readonly childPoseSource: "author" | "live-parent-pose";
  readonly parentMotionSource: StructuralParentMotionSource;
  readonly bodiesBefore: number;
  readonly bodiesAfter: number;
  readonly collidersBefore: number;
  readonly collidersAfter: number;
  readonly anchoredColliderCount: number;
  readonly fragments: readonly StructuralCommittedFragment[];
}

const finiteNumber = (value: unknown, path: string): number => {
  if (typeof value !== "number") {
    throw new StructuralPhysicsCommitError("InvalidStructuralState", path, "Expected a finite number.", "validate", true);
  }
  return requireFinite(value, path);
};

const validateVector = (value: unknown, path: string): MeterPoint => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["x", "y", "z"], path);
  return deepFreeze({
    x: finiteNumber(record.x, `${path}/x`),
    y: finiteNumber(record.y, `${path}/y`),
    z: finiteNumber(record.z, `${path}/z`)
  });
};

const validateQuaternion = (value: unknown, path: string): StructuralWorldQuaternion => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["x", "y", "z", "w"], path);
  const quat = deepFreeze({
    x: finiteNumber(record.x, `${path}/x`),
    y: finiteNumber(record.y, `${path}/y`),
    z: finiteNumber(record.z, `${path}/z`),
    w: finiteNumber(record.w, `${path}/w`)
  });
  const norm = Math.sqrt(quat.x * quat.x + quat.y * quat.y + quat.z * quat.z + quat.w * quat.w);
  if (Math.abs(norm - 1) > 1e-6) {
    fail("InvalidStructuralState", path, "Parent rotation must be a unit quaternion.", "validate", true);
  }
  return quat;
};

const cross = (a: MeterPoint, b: MeterPoint): MeterPoint =>
  deepFreeze({
    x: requireFinite(a.y * b.z - a.z * b.y, "commit/crossX"),
    y: requireFinite(a.z * b.x - a.x * b.z, "commit/crossY"),
    z: requireFinite(a.x * b.y - a.y * b.x, "commit/crossZ")
  });

/** Rotiert v mit Einheitsquaternion q (Weltabbildung starrer Parentbewegung). */
export const rotateStructuralWorldVector = (
  quatValue: StructuralWorldQuaternion,
  vectorValue: MeterPoint
): MeterPoint => {
  const quat = validateQuaternion(quatValue, "commit/rotation");
  const vector = validateVector(vectorValue, "commit/vector");
  const qv = deepFreeze({ x: quat.x, y: quat.y, z: quat.z });
  const uv = cross(qv, vector);
  const uuv = cross(qv, uv);
  return deepFreeze({
    x: requireFinite(vector.x + 2 * (quat.w * uv.x + uuv.x), "commit/rotatedX"),
    y: requireFinite(vector.y + 2 * (quat.w * uv.y + uuv.y), "commit/rotatedY"),
    z: requireFinite(vector.z + 2 * (quat.w * uv.z + uuv.z), "commit/rotatedZ")
  });
};

/**
 * Weltabbildung eines Autorpunkts: W(p) = T + R * (p - A).
 * Bezugspunkt A ist der tatsächliche Vor-Schnitt-COM in Autormetern
 * (nicht der Nach-Schnitt-COM des Plans).
 */
export const mapStructuralAuthorPointToWorld = (
  quatValue: StructuralWorldQuaternion,
  translationValue: MeterPoint,
  anchorAuthorValue: MeterPoint,
  pointAuthorValue: MeterPoint
): MeterPoint => {
  const translation = validateVector(translationValue, "commit/translation");
  const anchor = validateVector(anchorAuthorValue, "commit/preCutCenter");
  const point = validateVector(pointAuthorValue, "commit/authorPoint");
  const offset = deepFreeze({
    x: requireFinite(point.x - anchor.x, "commit/offsetX"),
    y: requireFinite(point.y - anchor.y, "commit/offsetY"),
    z: requireFinite(point.z - anchor.z, "commit/offsetZ")
  });
  const rotated = rotateStructuralWorldVector(quatValue, offset);
  return deepFreeze({
    x: requireFinite(translation.x + rotated.x, "commit/worldX"),
    y: requireFinite(translation.y + rotated.y, "commit/worldY"),
    z: requireFinite(translation.z + rotated.z, "commit/worldZ")
  });
};

/** v_kind im Weltraum nach Parenttransformation: v = v_p + omega x (W(c) - T). */
export const deriveStructuralWorldSplitVelocity = (
  linvelValue: MeterPoint,
  angvelValue: MeterPoint,
  parentTranslationValue: MeterPoint,
  childTranslationValue: MeterPoint
): MeterPoint => {
  const linvel = validateVector(linvelValue, "commit/linvel");
  const angvel = validateVector(angvelValue, "commit/angvel");
  const parent = validateVector(parentTranslationValue, "commit/parentTranslation");
  const child = validateVector(childTranslationValue, "commit/childTranslation");
  const arm = deepFreeze({
    x: requireFinite(child.x - parent.x, "commit/armX"),
    y: requireFinite(child.y - parent.y, "commit/armY"),
    z: requireFinite(child.z - parent.z, "commit/armZ")
  });
  const swirl = cross(angvel, arm);
  return deepFreeze({
    x: requireFinite(linvel.x + swirl.x, "commit/splitX"),
    y: requireFinite(linvel.y + swirl.y, "commit/splitY"),
    z: requireFinite(linvel.z + swirl.z, "commit/splitZ")
  });
};

const voxelCuboidForCell = (
  address: Parameters<typeof globalQuantumForStructuralCell>[0],
  center: MeterPoint
): StructuralWorldCuboid => {
  const global = globalQuantumForStructuralCell(address);
  const side = MICROVOXEL_BASE_QUANTUM_METERS;
  const boxCenter = {
    x: (global.x + 0.5) * side,
    y: (global.y + 0.5) * side,
    z: (global.z + 0.5) * side
  };
  return deepFreeze({
    halfExtentsMeters: deepFreeze({ x: side / 2, y: side / 2, z: side / 2 }),
    offsetWrtBodyMeters: deepFreeze({
      x: requireFinite(boxCenter.x - center.x, "commit/cuboidOffsetX"),
      y: requireFinite(boxCenter.y - center.y, "commit/cuboidOffsetY"),
      z: requireFinite(boxCenter.z - center.z, "commit/cuboidOffsetZ")
    })
  });
};

const identityRotation = (): StructuralWorldQuaternion => deepFreeze({ x: 0, y: 0, z: 0, w: 1 });
const zeroVector = (): MeterPoint => deepFreeze({ x: 0, y: 0, z: 0 });

export const commitStructuralPhysicsTransition = <BodyRef>(
  request: StructuralPhysicsCommitRequest<BodyRef>
): StructuralPhysicsCommitReceipt => {
  const { port, parentBody, plan, live, classification, parentWorldPose, preCutCenterAuthorMeters } = request;
  const restored = true;
  if (plan.status !== "Installed") {
    fail("InvalidStructuralState", "plan/status", "Commit requires an installed plan (no debris fallback).", "validate", restored);
  }
  if (plan.objectRevision !== live.objectRevision || plan.sourceContentHash !== live.contentHash) {
    fail(
      "InvalidStructuralState",
      "plan/binding",
      "Stale plan: revision or content hash does not match the live object. Commit refused before touching the world.",
      "validate",
      restored
    );
  }
  // Plan-Integritaet: contentHash ueber alles ausser sich selbst nachrechnen.
  const { contentHash: planHash, ...unsigned } = plan as unknown as {
    contentHash: unknown;
  } & Record<string, unknown>;
  if (hashAdaptiveCanonical(unsigned) !== planHash) {
    fail("InvalidStructuralState", "plan/contentHash", "Plan content hash mismatch.", "validate", restored);
  }

  const useLivePose = parentWorldPose !== undefined;
  const childPoseSource = useLivePose ? ("live-parent-pose" as const) : ("author" as const);
  if (useLivePose && plan.parentMotionSource !== "live-parent-body") {
    fail(
      "InvalidStructuralState",
      "plan/parentMotionSource",
      "A live parent pose requires a live-parent-body motion source (origin label must match).",
      "validate",
      restored
    );
  }
  if (useLivePose && preCutCenterAuthorMeters === undefined) {
    fail(
      "InvalidStructuralState",
      "preCutCenterAuthorMeters",
      "A live parent pose requires the actual pre-cut center of mass in author meters.",
      "validate",
      restored
    );
  }
  const pose = useLivePose
    ? {
        translationMeters: validateVector(parentWorldPose.translationMeters, "parentWorldPose/translationMeters"),
        rotation: validateQuaternion(parentWorldPose.rotation, "parentWorldPose/rotation")
      }
    : { translationMeters: zeroVector(), rotation: identityRotation() };
  const anchor = useLivePose
    ? validateVector(preCutCenterAuthorMeters, "preCutCenterAuthorMeters")
    : zeroVector();
  const mapPoint = (authorPoint: MeterPoint): MeterPoint =>
    useLivePose
      ? mapStructuralAuthorPointToWorld(pose.rotation, pose.translationMeters, anchor, authorPoint)
      : validateVector(authorPoint, "commit/authorPoint");

  // Explizite kanonische Masseneigenschaften verlangen diagonale Tensoren
  // (alle bisherigen Fragmente); Nebendiagonalen wuerden eine
  // Hauptachsentransformation verlangen und werden fail-closed abgewiesen.
  for (let index = 0; index < plan.dynamicBodies.length; index += 1) {
    const tensor = plan.dynamicBodies[index].inertiaTensorKgMetersSquared;
    if (Math.abs(tensor.xy) + Math.abs(tensor.xz) + Math.abs(tensor.yz) > 1e-9) {
      fail(
        "InvalidStructuralState",
        `dynamicBodies/${index}/inertiaTensor`,
        "Explicit canonical install supports diagonal inertia tensors only.",
        "validate",
        restored
      );
    }
    if (!(plan.dynamicBodies[index].massKg > 0)) {
      fail("InvalidStructuralState", `dynamicBodies/${index}/massKg`, "Fragment mass must be positive.", "validate", restored);
    }
  }

  const parentMotion = plan.parentMotion;
  const bodiesBefore = port.bodiesLen();
  const collidersBefore = port.collidersLen();
  const created: BodyRef[] = [];
  const removeCreated = (): void => {
    for (let index = created.length - 1; index >= 0; index -= 1) {
      try {
        port.removeBody(created[index]);
      } catch {
        // Best effort: weiter abräumen, Fehlerkontext bleibt der Auslöser.
      }
    }
  };

  try {
    // 1) Verankerten Rest statisch installieren (Kontakt-Cuboids, masselos —
    //    fixe Bodies tragen keine Masseneigenschaften).
    const anchoredCells = classification.anchoredComponents.flatMap((component) => component.occupiedCells);
    const anchoredBody = port.createBody({
      dynamic: false,
      translationMeters: zeroVector(),
      rotation: identityRotation(),
      linvelMetersPerSecond: zeroVector(),
      angvelRadPerSecond: zeroVector()
    });
    created.push(anchoredBody);
    for (const address of anchoredCells) {
      const cellCenter = {
        x: (globalQuantumForStructuralCell(address).x + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
        y: (globalQuantumForStructuralCell(address).y + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
        z: (globalQuantumForStructuralCell(address).z + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS
      };
      const worldCenter = mapPoint(validateVector(cellCenter, "commit/anchoredCell"));
      port.addCollider(
        anchoredBody,
        {
          halfExtentsMeters: deepFreeze({
            x: MICROVOXEL_BASE_QUANTUM_METERS / 2,
            y: MICROVOXEL_BASE_QUANTUM_METERS / 2,
            z: MICROVOXEL_BASE_QUANTUM_METERS / 2
          }),
          offsetWrtBodyMeters: worldCenter
        },
        { kind: "massless" }
      );
    }
    const anchoredColliderCount = port.bodyColliderCount(anchoredBody);
    if (anchoredColliderCount !== anchoredCells.length) {
      fail(
        "CommitFailed",
        "anchored/colliders",
        `Anchored install incomplete: ${anchoredColliderCount} of ${anchoredCells.length} colliders present.`,
        "create",
        true
      );
    }

    // 2) Jedes Fragment dynamisch installieren: Kontakt als Voxel-Cuboids,
    //    kanonische Masse/Tensor explizit auf dem ersten Collider am Body-COM
    //    (Offset null -> Aggregationspfad trivial, kein Dichte-Shift).
    const fragments: StructuralCommittedFragment[] = [];
    for (const bodyPlan of plan.dynamicBodies) {
      const fragment = classification.fragments.find((entry) => entry.fragmentId === bodyPlan.fragmentId);
      if (fragment === undefined) {
        fail("InvalidStructuralState", "classification/fragments", "Plan fragment missing in classification.", "validate", true);
      }
      const center = mapPoint(validateVector(bodyPlan.centerOfMassMeters, "commit/fragmentCenter"));
      const authorCenter = validateVector(bodyPlan.centerOfMassMeters, "commit/fragmentCenterAuthor");
      const linvel = useLivePose
        ? deriveStructuralWorldSplitVelocity(
            parentMotion.velocityMetersPerSecond,
            parentMotion.angularVelocityRadPerSecond,
            pose.translationMeters,
            center
          )
        : validateVector(bodyPlan.initialVelocityMetersPerSecond, "commit/plannedVelocity");
      const angvel = validateVector(parentMotion.angularVelocityRadPerSecond, "commit/angvel");
      const body = port.createBody({
        dynamic: true,
        translationMeters: center,
        rotation: useLivePose ? pose.rotation : identityRotation(),
        linvelMetersPerSecond: linvel,
        angvelRadPerSecond: angvel
      });
      created.push(body);
      // Collider-Offsets sind IMMER body-lokal = Autorframe (Boxmitte - COM):
      // Die Engine rotiert sie mit dem Body (R). Welt-Offsets waeren unter
      // R != Identitaet falsch (Kontakt-/Massen-Geometrie wuerde verdreht).
      const fragmentCells = (fragment as { occupiedCells: readonly StructuralCellAddress[] }).occupiedCells;
      const boxes = fragmentCells.map((address) => voxelCuboidForCell(address, authorCenter));
      if (boxes.length === 0) {
        fail("InvalidStructuralState", "fragment/cells", "Fragment must contain at least one cell.", "validate", true);
      }
      boxes.forEach((box, boxIndex) => {
        if (boxIndex === 0) {
          const tensor = bodyPlan.inertiaTensorKgMetersSquared;
          port.addCollider(
            body,
            box,
            {
              kind: "canonical-body",
              massKg: bodyPlan.massKg,
              centerOfMassLocal: deepFreeze({
                x: requireFinite(-box.offsetWrtBodyMeters.x, "commit/comLocalX"),
                y: requireFinite(-box.offsetWrtBodyMeters.y, "commit/comLocalY"),
                z: requireFinite(-box.offsetWrtBodyMeters.z, "commit/comLocalZ")
              }),
              principalInertia: deepFreeze({ x: tensor.xx, y: tensor.yy, z: tensor.zz }),
              frame: identityRotation()
            }
          );
        } else {
          port.addCollider(body, box, { kind: "massless" });
        }
      });
      const installed = port.bodyColliderCount(body);
      if (installed !== boxes.length) {
        fail(
          "CommitFailed",
          `fragments/${bodyPlan.fragmentId}/colliders`,
          `Fragment install incomplete: ${installed} of ${boxes.length} colliders present.`,
          "create",
          true
        );
      }
      fragments.push(
        deepFreeze({
          fragmentId: bodyPlan.fragmentId,
          installedColliderCount: installed,
          translationMeters: center,
          linvelMetersPerSecond: linvel
        })
      );
    }

    // 3) Erst wenn alles steht: Parent entfernen. Kein Step dazwischen —
    //    weder Doppelbelegung noch Luecke sind je beobachtbar.
    try {
      port.removeBody(parentBody);
    } catch (error) {
      removeCreated();
      fail(
        "CommitFailed",
        "parent/remove",
        `Parent removal failed (${error instanceof Error ? error.message : String(error)}); created bodies rolled back.`,
        "remove",
        false
      );
    }

    return deepFreeze({
      schemaVersion: STRUCTURAL_PHYSICS_COMMIT_SCHEMA_VERSION,
      childPoseSource,
      parentMotionSource: plan.parentMotionSource,
      bodiesBefore,
      bodiesAfter: port.bodiesLen(),
      collidersBefore,
      collidersAfter: port.collidersLen(),
      anchoredColliderCount,
      fragments: deepFreeze(fragments.slice())
    });
  } catch (error) {
    if (error instanceof StructuralPhysicsCommitError && error.phase === "remove") throw error;
    if (error instanceof StructuralPhysicsCommitError) throw error;
    removeCreated();
    throw new StructuralPhysicsCommitError(
      "CommitFailed",
      "commit/create",
      `Install failed after mutation began (${error instanceof Error ? error.message : String(error)}); created bodies rolled back, parent untouched.`,
      "create",
      true
    );
  }
};
