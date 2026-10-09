import { canonicalSignature } from "./canonical";
import {
  compareAscii,
  validateRevision,
  validateRepresentationKey,
  validateSemanticId,
  type ContentHash,
  type FrameId,
  type FrameRevision,
  type RepresentationKey,
  type VisibilityPlanRevision
} from "./ids";
import type { QuaternionSnapshot, RepresentationTransformSnapshot, Vector3Snapshot } from "./types";
import { invalidResult, isFiniteFloat32, issue, type ValidationIssue, type ValidationResult, validResult, throwIfInvalid } from "./validation";

const ProjectionWeakSet=WeakSet,projectionAdd=WeakSet.prototype.add,projectionHas=WeakSet.prototype.has;
const projectionFreeze=Object.freeze,projectionIsFrozen=Object.isFrozen,projectionOwnKeys=Reflect.ownKeys,
  projectionDescriptor=Object.getOwnPropertyDescriptor,projectionOwn=Object.prototype.hasOwnProperty,projectionIsArray=Array.isArray,
  projectionFinite=Number.isFinite,projectionSafeInteger=Number.isSafeInteger;
const immutableFactoryProjections=new ProjectionWeakSet<object>();
const projectionFields=projectionFreeze(["frameId","frameRevision","cameraPositionRelative","cameraOrientation","projectionParameters","representationTransforms"]);
const parameterFields=projectionFreeze(["kind","verticalFovDegrees","aspect","near","far"]);
const transformFields=projectionFreeze(["representationKey","positionRelative","orientation","scale"]);
const vectorFields=projectionFreeze(["x","y","z"]),quaternionFields=projectionFreeze(["x","y","z","w"]);
const frozenDataRecord=(value:object,fields:readonly string[]):boolean=>{
  if(!projectionIsFrozen(value)||projectionOwnKeys(value).length!==fields.length){return false;}
  for(let i=0;i<fields.length;i++){
    const d=projectionDescriptor(value,fields[i]!);
    if(d===undefined||!projectionOwn.call(d,"value")||d.writable!==false||d.enumerable!==true){return false;}
  }
  return true;
};
const frozenNumbers=(value:object,fields:readonly string[]):boolean=>{
  if(!projectionIsFrozen(value)||projectionOwnKeys(value).length!==fields.length){return false;}
  for(let i=0;i<fields.length;i++){
    const d=projectionDescriptor(value,fields[i]!);
    if(d===undefined||!projectionOwn.call(d,"value")||d.writable!==false||d.enumerable!==true
      ||typeof d.value!=="number"||!projectionFinite(d.value)){return false;}
  }
  return true;
};
const immutableProjectionShape=(snapshot:FrameProjectionSnapshot):boolean=>{
  try{
    if(!frozenDataRecord(snapshot,projectionFields)||typeof snapshot.frameId!=="string"||!projectionSafeInteger(snapshot.frameRevision)||snapshot.frameRevision<0
      ||!frozenNumbers(snapshot.cameraPositionRelative,vectorFields)||!frozenNumbers(snapshot.cameraOrientation,quaternionFields)){return false;}
    const p=snapshot.projectionParameters;
    if(!frozenDataRecord(p,parameterFields)||typeof p.kind!=="string"||!projectionFinite(p.verticalFovDegrees)
      ||!projectionFinite(p.aspect)||!projectionFinite(p.near)||!projectionFinite(p.far)){return false;}
    const transforms=snapshot.representationTransforms;
    if(!projectionIsArray(transforms)||!projectionIsFrozen(transforms)||projectionOwnKeys(transforms).length!==transforms.length+1){return false;}
    for(let i=0;i<transforms.length;i++){
      const d=projectionDescriptor(transforms,`${i}`);
      if(d===undefined||!projectionOwn.call(d,"value")||d.writable!==false||d.enumerable!==true){return false;}
      const t=d.value as RepresentationTransformSnapshot;
      if(!frozenDataRecord(t,transformFields)||typeof t.representationKey!=="string"
        ||!frozenNumbers(t.positionRelative,vectorFields)||!frozenNumbers(t.orientation,quaternionFields)||!frozenNumbers(t.scale,vectorFields)){return false;}
    }
    return true;
  }catch{return false;}
};
/** Only this module's validated factory can grant immutable hash provenance. */
export const isFactoryOwnedFrameProjectionSnapshot=(snapshot:FrameProjectionSnapshot):boolean=>projectionHas.call(immutableFactoryProjections,snapshot);

export interface VisibilityPlan {
  readonly planRevision: VisibilityPlanRevision;
  readonly visibleRepresentationKeys: readonly RepresentationKey[];
  readonly fallbackRepresentationKeys: readonly RepresentationKey[];
  readonly hiddenRepresentationKeys: readonly RepresentationKey[];
}

export interface PerspectiveProjectionParameters {
  readonly kind: "Perspective";
  readonly verticalFovDegrees: number;
  readonly aspect: number;
  readonly near: number;
  readonly far: number;
}

export interface FrameProjectionSnapshot {
  readonly frameId: FrameId;
  readonly frameRevision: FrameRevision;
  readonly cameraPositionRelative: Vector3Snapshot;
  readonly cameraOrientation: QuaternionSnapshot;
  readonly projectionParameters: PerspectiveProjectionParameters;
  readonly representationTransforms: readonly RepresentationTransformSnapshot[];
}

export interface ResolvedVisibility {
  readonly visibleRepresentationKeys: readonly RepresentationKey[];
  readonly pinnedFallbackRepresentationKeys: readonly RepresentationKey[];
  readonly allRequestedPrimariesReady: boolean;
}

const sortedUniqueKeys = (values: readonly RepresentationKey[]): readonly RepresentationKey[] =>
  Object.freeze([...new Set(values)].sort(compareAscii));

const copyVector = (value: Vector3Snapshot): Vector3Snapshot => Object.freeze({ x: value.x, y: value.y, z: value.z });
const copyQuaternion = (value: QuaternionSnapshot): QuaternionSnapshot => Object.freeze({ x: value.x, y: value.y, z: value.z, w: value.w });

export const validateVisibilityPlan = (plan: VisibilityPlan): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const revisionValidation = validateRevision(plan.planRevision, "planRevision");
  if (!revisionValidation.valid) issues.push(...revisionValidation.issues);
  const sets = [
    ["visibleRepresentationKeys", plan.visibleRepresentationKeys],
    ["fallbackRepresentationKeys", plan.fallbackRepresentationKeys],
    ["hiddenRepresentationKeys", plan.hiddenRepresentationKeys]
  ] as const;
  const owners = new Map<string, string>();
  for (const [name, keys] of sets) {
    let previous: string | undefined;
    keys.forEach((key, index) => {
      const idValidation = validateRepresentationKey(key, `${name}[${index}]`);
      if (!idValidation.valid) issues.push(...idValidation.issues);
      if (previous !== undefined && previous >= key) {
        issues.push(issue("NonCanonicalKeySet", name, "must be sorted and contain no duplicates"));
      }
      previous = key;
      const owner = owners.get(key);
      if (owner !== undefined && owner !== name) {
        issues.push(issue("OverlappingVisibilityKey", `${name}[${index}]`, `is already present in ${owner}`));
      }
      owners.set(key, name);
    });
  }
  return issues.length === 0 ? validResult() : invalidResult(issues);
};

export const createVisibilityPlan = (input: VisibilityPlan): VisibilityPlan => {
  const plan = Object.freeze({
    planRevision: input.planRevision,
    visibleRepresentationKeys: sortedUniqueKeys(input.visibleRepresentationKeys),
    fallbackRepresentationKeys: sortedUniqueKeys(input.fallbackRepresentationKeys),
    hiddenRepresentationKeys: sortedUniqueKeys(input.hiddenRepresentationKeys)
  });
  throwIfInvalid("VisibilityPlan", validateVisibilityPlan(plan));
  return plan;
};

export const visibilityPlanSignature = (plan: VisibilityPlan): ContentHash => canonicalSignature({ version: 1, ...plan });

const validateVector = (value: Vector3Snapshot, path: string, issues: ValidationIssue[], requirePositive = false): void => {
  for (const component of ["x", "y", "z"] as const) {
    if (!isFiniteFloat32(value[component]) || (requirePositive && value[component] <= 0)) {
      issues.push(issue("InvalidRelativeVector", `${path}.${component}`, requirePositive ? "must be a positive Float32-compatible value" : "must be Float32-compatible and finite"));
    }
  }
};

const validateQuaternion = (value: QuaternionSnapshot, path: string, issues: ValidationIssue[]): void => {
  const components = [value.x, value.y, value.z, value.w];
  if (!components.every(isFiniteFloat32)) {
    issues.push(issue("InvalidQuaternion", path, "must contain finite Float32-compatible values"));
    return;
  }
  const magnitude = Math.hypot(...components);
  if (Math.abs(magnitude - 1) > 1e-4) {
    issues.push(issue("NonUnitQuaternion", path, "must be normalized within 1e-4"));
  }
};

export const validateFrameProjectionSnapshot = (snapshot: FrameProjectionSnapshot): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const frameValidation = validateSemanticId(snapshot.frameId, "frameId");
  if (!frameValidation.valid) issues.push(...frameValidation.issues);
  const revisionValidation = validateRevision(snapshot.frameRevision, "frameRevision");
  if (!revisionValidation.valid) issues.push(...revisionValidation.issues);
  validateVector(snapshot.cameraPositionRelative, "cameraPositionRelative", issues);
  validateQuaternion(snapshot.cameraOrientation, "cameraOrientation", issues);
  const projection = snapshot.projectionParameters;
  if (projection.kind !== "Perspective") {
    issues.push(issue("UnsupportedProjection", "projectionParameters.kind", "V1 supports only Perspective"));
  }
  if (!isFiniteFloat32(projection.verticalFovDegrees) || projection.verticalFovDegrees <= 0 || projection.verticalFovDegrees >= 180) {
    issues.push(issue("InvalidProjection", "projectionParameters.verticalFovDegrees", "must be between 0 and 180 degrees"));
  }
  if (!isFiniteFloat32(projection.aspect) || projection.aspect <= 0) {
    issues.push(issue("InvalidProjection", "projectionParameters.aspect", "must be positive and finite"));
  }
  if (!isFiniteFloat32(projection.near) || projection.near <= 0 || !isFiniteFloat32(projection.far) || projection.far <= projection.near) {
    issues.push(issue("InvalidProjection", "projectionParameters", "requires 0 < near < far"));
  }
  let previous: string | undefined;
  snapshot.representationTransforms.forEach((transform, index) => {
    const keyValidation = validateRepresentationKey(transform.representationKey, `representationTransforms[${index}].representationKey`);
    if (!keyValidation.valid) issues.push(...keyValidation.issues);
    if (previous !== undefined && previous >= transform.representationKey) {
      issues.push(issue("NonCanonicalTransformSet", "representationTransforms", "must be sorted and contain unique keys"));
    }
    previous = transform.representationKey;
    validateVector(transform.positionRelative, `representationTransforms[${index}].positionRelative`, issues);
    validateQuaternion(transform.orientation, `representationTransforms[${index}].orientation`, issues);
    validateVector(transform.scale, `representationTransforms[${index}].scale`, issues, true);
  });
  return issues.length === 0 ? validResult() : invalidResult(issues);
};

export const createFrameProjectionSnapshot = (input: FrameProjectionSnapshot): FrameProjectionSnapshot => {
  const transforms = Object.freeze([...input.representationTransforms]
    .map((transform) => Object.freeze({
      representationKey: transform.representationKey,
      positionRelative: copyVector(transform.positionRelative),
      orientation: copyQuaternion(transform.orientation),
      scale: copyVector(transform.scale)
    }))
    .sort((left, right) => compareAscii(left.representationKey, right.representationKey)));
  const snapshot = Object.freeze({
    frameId: input.frameId,
    frameRevision: input.frameRevision,
    cameraPositionRelative: copyVector(input.cameraPositionRelative),
    cameraOrientation: copyQuaternion(input.cameraOrientation),
    projectionParameters: Object.freeze({ ...input.projectionParameters }),
    representationTransforms: transforms
  });
  throwIfInvalid("FrameProjectionSnapshot", validateFrameProjectionSnapshot(snapshot));
  if(immutableProjectionShape(snapshot)){projectionAdd.call(immutableFactoryProjections,snapshot);}
  return snapshot;
};

export const frameProjectionSignature = (snapshot: FrameProjectionSnapshot): ContentHash => canonicalSignature({ version: 1, ...snapshot });

export const resolveVisibility = (
  plan: VisibilityPlan,
  residentRepresentationKeys: ReadonlySet<RepresentationKey>,
  projectedRepresentationKeys: ReadonlySet<RepresentationKey>
): ResolvedVisibility => {
  const isReady = (key: RepresentationKey): boolean => residentRepresentationKeys.has(key) && projectedRepresentationKeys.has(key);
  const readyPrimaries = plan.visibleRepresentationKeys.filter(isReady);
  const allReady = readyPrimaries.length === plan.visibleRepresentationKeys.length;
  const readyFallbacks = allReady ? [] : plan.fallbackRepresentationKeys.filter(isReady);
  return Object.freeze({
    visibleRepresentationKeys: Object.freeze([...readyPrimaries, ...readyFallbacks].sort(compareAscii)),
    pinnedFallbackRepresentationKeys: Object.freeze([...plan.fallbackRepresentationKeys]),
    allRequestedPrimariesReady: allReady
  });
};
