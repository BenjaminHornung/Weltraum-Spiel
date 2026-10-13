import { canonicalSignature, canonicalSignatureOwnedSteps,canonicalSignaturePrivateSteps } from "./canonical";
import {
  isContentHash,
  compareAscii,
  validateRevision,
  validateRepresentationKey,
  validateSemanticId,
  type ArtifactRevision,
  type ContentHash,
  type FrameId,
  type RepresentationKey,
  type SourceRevision
} from "./ids";
import type { AxisAlignedBounds, MaterialRange, MeshArtifactAttributes } from "./types";
import {
  deepFreezeMetadata,
  invalidResult,
  isFiniteFloat32,
  issue,
  type ValidationIssue,
  type ValidationResult,
  validResult,
  throwIfInvalid
} from "./validation";

export type MeshIndexArray = Uint16Array | Uint32Array;
export type MeshArtifactOwnership = "SnapshotOwned" | "AdoptedExclusive";

export interface MeshArtifact {
  readonly representationKey: RepresentationKey;
  readonly sourceRevision: SourceRevision;
  readonly artifactRevision: ArtifactRevision;
  readonly algorithmVersion: string;
  readonly frameId: FrameId;
  readonly contentHash: ContentHash;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: MeshIndexArray;
  readonly attributes?: MeshArtifactAttributes;
  readonly materialRanges: readonly MaterialRange[];
  readonly bounds: AxisAlignedBounds;
  readonly ownership: MeshArtifactOwnership;
}

export interface MeshArtifactInput extends Omit<MeshArtifact, "contentHash" | "materialRanges" | "bounds" | "attributes" | "ownership"> {
  readonly attributes?: MeshArtifactAttributes;
  readonly materialRanges: readonly MaterialRange[];
  readonly bounds: AxisAlignedBounds;
}

type MeshArtifactContent = Omit<MeshArtifact, "contentHash" | "representationKey" | "sourceRevision" | "artifactRevision" | "ownership">;
const IntakeFloat32Array=Float32Array,IntakeUint16Array=Uint16Array,IntakeUint32Array=Uint32Array,intakeFreeze=Object.freeze,intakeDefine=Object.defineProperties,intakeSort=Array.prototype.sort;
const intakeTypedPrototype=Object.getPrototypeOf(Float32Array.prototype),intakeTag=Object.getOwnPropertyDescriptor(intakeTypedPrototype,Symbol.toStringTag)!.get!,
  intakeLength=Object.getOwnPropertyDescriptor(intakeTypedPrototype,"length")!.get!,intakeBuffer=Object.getOwnPropertyDescriptor(intakeTypedPrototype,"buffer")!.get!,
  intakeOffset=Object.getOwnPropertyDescriptor(intakeTypedPrototype,"byteOffset")!.get!,intakeBytes=Object.getOwnPropertyDescriptor(intakeTypedPrototype,"byteLength")!.get!,
  intakeBufferBytes=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,"byteLength")!.get!,intakeResizable=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,"resizable")?.get;
const intakeKind=(value:unknown):string=>{try{return intakeTag.call(value)??"";}catch{return "";}};

const vectorRecord = (vector: AxisAlignedBounds["min"]): AxisAlignedBounds["min"] =>
  Object.freeze({ x: vector.x, y: vector.y, z: vector.z });

const canonicalRanges = (ranges: readonly MaterialRange[]): readonly MaterialRange[] => Object.freeze(
  [...ranges]
    .map((range) => Object.freeze({
      materialProfileId: range.materialProfileId,
      startIndex: range.startIndex,
      indexCount: range.indexCount
    }))
    .sort((left, right) => left.startIndex - right.startIndex || compareAscii(left.materialProfileId, right.materialProfileId))
);

const canonicalAttributes = (attributes: MeshArtifactAttributes | undefined): MeshArtifactAttributes | undefined => {
  if (attributes === undefined) {
    return undefined;
  }
  return Object.freeze({ uv: attributes.uv, color: attributes.color });
};

const contentFields = (artifact: MeshArtifactContent): unknown => ({
  version: 1,
  algorithmVersion: artifact.algorithmVersion,
  frameId: artifact.frameId,
  positions: artifact.positions,
  normals: artifact.normals,
  indices: artifact.indices,
  attributes: artifact.attributes,
  materialRanges: [...artifact.materialRanges]
    .map((range) => ({ ...range }))
    .sort((left, right) => left.startIndex - right.startIndex || compareAscii(left.materialProfileId, right.materialProfileId)),
  bounds: artifact.bounds
});

export const calculateMeshArtifactContentHash = (
  artifact: MeshArtifactContent
): ContentHash => canonicalSignature(contentFields(artifact));

const validateFullExclusiveBuffer = (
  value: ArrayBufferView,
  path: string,
  usedBuffers: Set<ArrayBufferLike>,
  issues: ValidationIssue[]
): void => {
  const buffer = value.buffer;
  if (!(buffer instanceof ArrayBuffer)) {
    issues.push(issue("SharedBufferUnsupported", path, "must use an unshared ArrayBuffer"));
    return;
  }
  if ((buffer as ArrayBuffer & { readonly resizable?: boolean }).resizable === true) {
    issues.push(issue("ResizableBufferUnsupported", path, "must use a fixed-length ArrayBuffer"));
  }
  if (value.byteOffset !== 0 || value.byteLength !== buffer.byteLength) {
    issues.push(issue("SubviewBufferUnsupported", path, "must be a full view over its backing buffer"));
  }
  if (usedBuffers.has(buffer)) {
    issues.push(issue("AliasedBufferUnsupported", path, "must not share a backing buffer with another attribute"));
  }
  usedBuffers.add(buffer);
};

function* validateFloatArraySteps(value: unknown, path: string, components: number, vertexCount: number | undefined, issues: ValidationIssue[], owned: boolean,intake=false): Generator<string, void, unknown> {
  if (intake?intakeKind(value)!=="Float32Array":!(value instanceof Float32Array)) {
    issues.push(issue("UnsupportedAttributeType", path, "must be a Float32Array"));
    return;
  }
  const array=value as Float32Array;
  if (array.length === 0 || array.length % components !== 0) {
    issues.push(issue("InvalidAttributeLength", path, `must contain complete ${components}-component values`));
  }
  if (vertexCount !== undefined && array.length !== vertexCount * components) {
    issues.push(issue("InconsistentAttributeLength", path, `must contain exactly ${components} values per vertex`));
  }
  for (let index = 0; index < array.length; index += 1) {
    if (!Number.isFinite(array[index])) {
      issues.push(issue("NonFiniteAttribute", `${path}[${index}]`, "must be finite"));
      break;
    }
    if (owned && (index + 1) % 1024 === 0) yield "artifactFloatScan";
  }
}

function* validateMeshArtifactSteps(artifact: MeshArtifact, owned: boolean,intake=false): Generator<string, ValidationResult, unknown> {
  const issues: ValidationIssue[] = [];
  const add = (result: ValidationResult): void => {
    if (!result.valid) issues.push(...result.issues);
  };
  add(validateRepresentationKey(artifact.representationKey, "representationKey"));
  add(validateRevision(artifact.sourceRevision, "sourceRevision"));
  add(validateRevision(artifact.artifactRevision, "artifactRevision"));
  add(validateSemanticId(artifact.algorithmVersion, "algorithmVersion"));
  add(validateSemanticId(artifact.frameId, "frameId"));
  if (artifact.ownership !== "SnapshotOwned" && artifact.ownership !== "AdoptedExclusive") {
    issues.push(issue("InvalidOwnershipMode", "ownership", "must be SnapshotOwned or AdoptedExclusive"));
  }
  if (!isContentHash(artifact.contentHash)) {
    issues.push(issue("InvalidContentHash", "contentHash", "must use the canonical fnv1a64 format"));
  }

  yield* validateFloatArraySteps(artifact.positions, "positions", 3, undefined, issues, owned,intake);
  const vertexCount = (intake?intakeKind(artifact.positions)==="Float32Array":artifact.positions instanceof Float32Array) ? artifact.positions.length / 3 : 0;
  if (!Number.isInteger(vertexCount) || vertexCount < 3) {
    issues.push(issue("EmptyMeshUnsupported", "positions", "must contain at least three vertices"));
  }
  yield* validateFloatArraySteps(artifact.normals, "normals", 3, Number.isInteger(vertexCount) ? vertexCount : undefined, issues, owned,intake);
  if (intake?(intakeKind(artifact.indices)!=="Uint16Array"&&intakeKind(artifact.indices)!=="Uint32Array"):(!(artifact.indices instanceof Uint16Array) && !(artifact.indices instanceof Uint32Array))) {
    issues.push(issue("UnsupportedIndexWidth", "indices", "must be Uint16Array or Uint32Array"));
  } else {
    if (artifact.indices.length < 3 || artifact.indices.length % 3 !== 0) {
      issues.push(issue("InvalidIndexLength", "indices", "must contain one or more complete triangles"));
    }
    for (let index = 0; index < artifact.indices.length; index += 1) {
      if (artifact.indices[index] >= vertexCount) {
        issues.push(issue("IndexOutOfRange", `indices[${index}]`, "must reference an existing vertex"));
        break;
      }
      if (owned && (index + 1) % 1024 === 0) yield "artifactIndexScan";
    }
  }

  if (artifact.attributes?.uv !== undefined) {
    yield* validateFloatArraySteps(artifact.attributes.uv, "attributes.uv", 2, vertexCount, issues, owned,intake);
  }
  if (artifact.attributes?.color !== undefined) {
    yield* validateFloatArraySteps(artifact.attributes.color, "attributes.color", 3, vertexCount, issues, owned,intake);
  }

  if(!intake){const usedBuffers = new Set<ArrayBufferLike>();
  const arrays: readonly (readonly [ArrayBufferView, string])[] = [
    [artifact.positions, "positions"],
    [artifact.normals, "normals"],
    [artifact.indices, "indices"],
    ...(artifact.attributes?.uv === undefined ? [] : [[artifact.attributes.uv, "attributes.uv"]] as const),
    ...(artifact.attributes?.color === undefined ? [] : [[artifact.attributes.color, "attributes.color"]] as const)
  ];
  for (const [array, path] of arrays) {
    if (ArrayBuffer.isView(array)) validateFullExclusiveBuffer(array, path, usedBuffers, issues);
  }} // Intake buffers were independently allocated after fixed/full/no-alias input checks.

  if (artifact.materialRanges.length === 0) {
    issues.push(issue("MissingMaterialCoverage", "materialRanges", "must cover the full index buffer"));
  }
  let expectedStart = 0;
  for (let index = 0; index < artifact.materialRanges.length; index += 1) {
    const range = artifact.materialRanges[index];
    add(validateSemanticId(range.materialProfileId, `materialRanges[${index}].materialProfileId`));
    if (!Number.isSafeInteger(range.startIndex) || range.startIndex < 0 || range.startIndex % 3 !== 0) {
      issues.push(issue("InvalidMaterialRange", `materialRanges[${index}].startIndex`, "must be a non-negative triangle-aligned integer"));
    }
    if (!Number.isSafeInteger(range.indexCount) || range.indexCount <= 0 || range.indexCount % 3 !== 0) {
      issues.push(issue("InvalidMaterialRange", `materialRanges[${index}].indexCount`, "must be a positive triangle-aligned integer"));
    }
    if (range.startIndex !== expectedStart) {
      issues.push(issue("MaterialCoverageGap", `materialRanges[${index}]`, "ranges must be sorted, non-overlapping, and gapless"));
    }
    expectedStart = range.startIndex + range.indexCount;
  }
  if (intake?(intakeKind(artifact.indices)==="Uint16Array"||intakeKind(artifact.indices)==="Uint32Array"):(artifact.indices instanceof Uint16Array || artifact.indices instanceof Uint32Array)) {
    if (expectedStart !== artifact.indices.length) {
      issues.push(issue("IncompleteMaterialCoverage", "materialRanges", "must cover the complete index buffer"));
    }
  }

  const boundsValues = [
    artifact.bounds.min.x, artifact.bounds.min.y, artifact.bounds.min.z,
    artifact.bounds.max.x, artifact.bounds.max.y, artifact.bounds.max.z
  ];
  if (!boundsValues.every(isFiniteFloat32)) {
    issues.push(issue("NonFiniteBounds", "bounds", "must contain finite Float32-compatible values"));
  }
  if (artifact.bounds.min.x > artifact.bounds.max.x || artifact.bounds.min.y > artifact.bounds.max.y || artifact.bounds.min.z > artifact.bounds.max.z) {
    issues.push(issue("InvalidBoundsOrder", "bounds", "min must not exceed max"));
  }
  if (intake?intakeKind(artifact.positions)==="Float32Array":artifact.positions instanceof Float32Array) {
    for (let index = 0; index + 2 < artifact.positions.length; index += 3) {
      const x = artifact.positions[index];
      const y = artifact.positions[index + 1];
      const z = artifact.positions[index + 2];
      if (x < artifact.bounds.min.x || x > artifact.bounds.max.x || y < artifact.bounds.min.y || y > artifact.bounds.max.y || z < artifact.bounds.min.z || z > artifact.bounds.max.z) {
        issues.push(issue("BoundsExcludeVertex", `positions[${index / 3}]`, "bounds must contain every vertex"));
        break;
      }
      if (owned && (index / 3 + 1) % 341 === 0) yield "artifactBoundsScan";
    }
  }

  if (issues.length === 0&&!intake) {
    const claimedHash = artifact.contentHash;
    const hash = owned ? yield* canonicalSignatureOwnedSteps(contentFields(artifact)) : calculateMeshArtifactContentHash(artifact);
    if (claimedHash !== hash) issues.push(issue("ContentHashMismatch", "contentHash", "does not match canonical mesh content"));
  }
  return issues.length === 0 ? validResult() : invalidResult(issues);
}

export const validateMeshArtifact = (artifact: MeshArtifact): ValidationResult => validateMeshArtifactSteps(artifact, false).next().value as ValidationResult;

export function* validateMeshArtifactOwnedSteps(artifact: MeshArtifact): Generator<string, ValidationResult, unknown> {
  return yield* validateMeshArtifactSteps(artifact, true);
}

const invalidInput = (path: string, message: string): never => {
  throwIfInvalid("MeshArtifactInput", invalidResult([issue("InvalidMeshArtifactInput", path, message)]));
  throw new Error("unreachable");
};

const requireFloat32Array = (value: unknown, path: string): Float32Array =>
  value instanceof Float32Array ? value : invalidInput(path, "must be a Float32Array");

const requireMeshIndexArray = (value: unknown, path: string): MeshIndexArray =>
  value instanceof Uint16Array || value instanceof Uint32Array
    ? value
    : invalidInput(path, "must be a Uint16Array or Uint32Array");

const copyFloat32Array = (value: unknown, path: string): Float32Array =>
  new Float32Array(requireFloat32Array(value, path));

const copyMeshIndexArray = (value: unknown, path: string): MeshIndexArray => {
  const typed = requireMeshIndexArray(value, path);
  return typed instanceof Uint16Array ? new Uint16Array(typed) : new Uint32Array(typed);
};

interface MeshArtifactBuffers {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: MeshIndexArray;
  readonly attributes?: MeshArtifactAttributes;
}

const snapshotBuffers = (input: MeshArtifactInput): MeshArtifactBuffers => ({
  positions: copyFloat32Array(input.positions, "positions"),
  normals: copyFloat32Array(input.normals, "normals"),
  indices: copyMeshIndexArray(input.indices, "indices"),
  attributes: input.attributes === undefined
    ? undefined
    : {
        uv: input.attributes.uv === undefined ? undefined : copyFloat32Array(input.attributes.uv, "attributes.uv"),
        color: input.attributes.color === undefined ? undefined : copyFloat32Array(input.attributes.color, "attributes.color")
      }
});

const adoptedBuffers = (input: MeshArtifactInput): MeshArtifactBuffers => ({
  positions: requireFloat32Array(input.positions, "positions"),
  normals: requireFloat32Array(input.normals, "normals"),
  indices: requireMeshIndexArray(input.indices, "indices"),
  attributes: input.attributes === undefined
    ? undefined
    : {
        uv: input.attributes.uv === undefined ? undefined : requireFloat32Array(input.attributes.uv, "attributes.uv"),
        color: input.attributes.color === undefined ? undefined : requireFloat32Array(input.attributes.color, "attributes.color")
      }
});

function* buildMeshArtifactSteps(input: MeshArtifactInput, ownership: MeshArtifactOwnership, buffers: MeshArtifactBuffers, owned: boolean,intake=false): Generator<string, MeshArtifact, unknown> {
  let materialRanges:readonly MaterialRange[];
  if(intake){const ranges:MaterialRange[]=[];for(let i=0;i<input.materialRanges.length;i++){const r=input.materialRanges[i]!;ranges[i]=intakeFreeze({materialProfileId:r.materialProfileId,startIndex:r.startIndex,indexCount:r.indexCount});}
    intakeSort.call(ranges,(left:MaterialRange,right:MaterialRange)=>left.startIndex-right.startIndex||compareAscii(left.materialProfileId,right.materialProfileId));materialRanges=intakeFreeze(ranges);
  }else{materialRanges=canonicalRanges(input.materialRanges);}
  const attributes = intake?(buffers.attributes===undefined?undefined:intakeFreeze({uv:buffers.attributes.uv,color:buffers.attributes.color})):canonicalAttributes(buffers.attributes);
  const bounds = intake?intakeFreeze({min:intakeFreeze({x:input.bounds.min.x,y:input.bounds.min.y,z:input.bounds.min.z}),max:intakeFreeze({x:input.bounds.max.x,y:input.bounds.max.y,z:input.bounds.max.z})})
    :Object.freeze({ min: vectorRecord(input.bounds.min), max: vectorRecord(input.bounds.max) });
  const content = {
    algorithmVersion: input.algorithmVersion,
    frameId: input.frameId,
    positions: buffers.positions,
    normals: buffers.normals,
    indices: buffers.indices,
    attributes,
    materialRanges,
    bounds
  } satisfies MeshArtifactContent;
  const withoutHash = {
    representationKey: input.representationKey,
    sourceRevision: input.sourceRevision,
    artifactRevision: input.artifactRevision,
    ...content,
    ownership
  };
  const artifact: MeshArtifact = (intake?intakeFreeze:Object.freeze)({
    ...withoutHash,
    contentHash: intake?yield* canonicalSignaturePrivateSteps(contentFields(content)):owned ? yield* canonicalSignatureOwnedSteps(contentFields(content)) : calculateMeshArtifactContentHash(content)
  });
  throwIfInvalid("MeshArtifact", yield* validateMeshArtifactSteps(artifact, owned,intake));
  return intake?artifact:deepFreezeMetadata(artifact);
}

const buildMeshArtifact = (input: MeshArtifactInput, ownership: MeshArtifactOwnership, buffers: MeshArtifactBuffers): MeshArtifact =>
  buildMeshArtifactSteps(input, ownership, buffers, false).next().value as MeshArtifact;

function* copyOwnedArraySteps<T extends Float32Array | MeshIndexArray>(value: T): Generator<string, T, unknown> {
  const copy = (value instanceof Float32Array ? new Float32Array(value.length)
    : value instanceof Uint16Array ? new Uint16Array(value.length) : new Uint32Array(value.length)) as T;
  const perChunk = value instanceof Uint16Array ? 2048 : 1024;
  for (let start = 0; start < value.length; start += perChunk) {
    const end = Math.min(start + perChunk, value.length);
    for (let index = start; index < end; index += 1) copy[index] = value[index]!;
    yield "artifactCopy";
  }
  return copy;
}

export function* createMeshArtifactOwnedSteps(input: MeshArtifactInput): Generator<string, MeshArtifact, unknown> {
  const buffers: MeshArtifactBuffers = {
    positions: yield* copyOwnedArraySteps(requireFloat32Array(input.positions, "positions")),
    normals: yield* copyOwnedArraySteps(requireFloat32Array(input.normals, "normals")),
    indices: yield* copyOwnedArraySteps(requireMeshIndexArray(input.indices, "indices")),
    attributes: input.attributes === undefined ? undefined : {
      uv: input.attributes.uv === undefined ? undefined : yield* copyOwnedArraySteps(requireFloat32Array(input.attributes.uv, "attributes.uv")),
      color: input.attributes.color === undefined ? undefined : yield* copyOwnedArraySteps(requireFloat32Array(input.attributes.color, "attributes.color"))
    }
  };
  return yield* buildMeshArtifactSteps(input, "SnapshotOwned", buffers, true);
}

function* copyIntakeArraySteps(value:Float32Array|MeshIndexArray):Generator<string,typeof value,unknown>{
  const kind=intakeKind(value),length=intakeLength.call(value),ctor=kind==="Float32Array"?IntakeFloat32Array:kind==="Uint16Array"?IntakeUint16Array:IntakeUint32Array;
  const copy=new ctor(length),buffer=intakeBuffer.call(copy),bytes=intakeBytes.call(copy);
  intakeDefine(buffer,{byteLength:{value:bytes},resizable:{value:false}});
  intakeDefine(copy,{length:{value:length},byteLength:{value:bytes},byteOffset:{value:0},buffer:{value:buffer},constructor:{value:ctor}});
  for(let start=0;start<length;start+=1024){
    if(intakeLength.call(value)!==length){throw new Error("Intake buffer changed during copy");}
    for(let i=start;i<Math.min(start+1024,length);i+=1){copy[i]=value[i]!;}yield "privateArtifactCopy";
  }
  if(intakeLength.call(value)!==length){throw new Error("Intake buffer changed during copy");}return copy;
}
/** Module-only factory: no witness is minted here; the backend retains this exact copied result privately. */
export const meshArtifactIntakeBytes=(input:MeshArtifactInput):number=>{
  const arrays=[input.positions,input.normals,input.indices,input.attributes?.uv,input.attributes?.color],buffers:ArrayBuffer[]=[];let total=0;
  for(let i=0;i<arrays.length;i++){const array=arrays[i];if(array===undefined){continue;}const kind=intakeKind(array);
    if(i===2?(kind!=="Uint16Array"&&kind!=="Uint32Array"):kind!=="Float32Array"){throw new Error("Invalid private intake attribute type");}
    const buffer=intakeBuffer.call(array) as ArrayBuffer;let bytes:number;
    try{bytes=intakeBufferBytes.call(buffer);}catch{throw new Error("Shared private intake buffer unsupported");}
    if(intakeResizable?.call(buffer)===true||intakeOffset.call(array)!==0||intakeBytes.call(array)!==bytes){throw new Error("Fixed full private intake buffer required");}
    for(let j=0;j<buffers.length;j++){if(buffers[j]===buffer){throw new Error("Aliased private intake buffers unsupported");}}buffers[i]=buffer;total+=bytes;
  }
  if(!Number.isSafeInteger(total)||total<=0){throw new Error("Invalid private mesh allocation size");}return total;
};
export const captureMeshArtifactIntakeInput=(input:MeshArtifactInput):MeshArtifactInput&{readonly contentHash?:ContentHash}=>{
  const claim=(input as MeshArtifact).contentHash;
  const positions=input.positions,normals=input.normals,indices=input.indices,uv=input.attributes?.uv,color=input.attributes?.color;
  if(!Array.isArray(input.materialRanges)||input.materialRanges.length>256){throw new Error("Invalid private material ranges");}
  const ranges:MaterialRange[]=[];for(let i=0;i<input.materialRanges.length;i+=1){const r=input.materialRanges[i]!;ranges[i]=intakeFreeze({materialProfileId:r.materialProfileId,startIndex:r.startIndex,indexCount:r.indexCount});}
  const snapshot:MeshArtifactInput={representationKey:input.representationKey,sourceRevision:input.sourceRevision,artifactRevision:input.artifactRevision,
    algorithmVersion:input.algorithmVersion,frameId:input.frameId,positions,normals,indices,attributes:uv===undefined&&color===undefined?undefined:intakeFreeze({uv,color}),
    materialRanges:intakeFreeze(ranges),bounds:intakeFreeze({min:intakeFreeze({x:input.bounds.min.x,y:input.bounds.min.y,z:input.bounds.min.z}),max:intakeFreeze({x:input.bounds.max.x,y:input.bounds.max.y,z:input.bounds.max.z})})};
  return intakeFreeze({...snapshot,...(claim===undefined?{}:{contentHash:claim})});
};
export function* createMeshArtifactIntakeSteps(input:MeshArtifactInput):Generator<string,MeshArtifact,unknown>{
  const snapshot=captureMeshArtifactIntakeInput(input),claim=snapshot.contentHash;
  meshArtifactIntakeBytes(snapshot);
  const {positions,normals,indices}=snapshot,uv=snapshot.attributes?.uv,color=snapshot.attributes?.color;
  const copied:MeshArtifactBuffers={positions:(yield* copyIntakeArraySteps(positions)) as Float32Array,normals:(yield* copyIntakeArraySteps(normals)) as Float32Array,
    indices:(yield* copyIntakeArraySteps(indices)) as MeshIndexArray,attributes:uv===undefined&&color===undefined?undefined:{
      uv:uv===undefined?undefined:(yield* copyIntakeArraySteps(uv)) as Float32Array,color:color===undefined?undefined:(yield* copyIntakeArraySteps(color)) as Float32Array}};
  const artifact=yield* buildMeshArtifactSteps(snapshot,"SnapshotOwned",copied,true,true);
  if(claim!==undefined&&claim!==artifact.contentHash){throw new Error("Private intake content hash mismatch");}return artifact;
}
/** Backend-local caller only: copy already validated custody to mutable scene storage, preserving scalar receipts. */
export function* copyMeshArtifactSceneSteps(artifact:MeshArtifact):Generator<string,MeshArtifact,unknown>{
  return intakeFreeze({...artifact,positions:(yield* copyIntakeArraySteps(artifact.positions)) as Float32Array,
    normals:(yield* copyIntakeArraySteps(artifact.normals)) as Float32Array,indices:(yield* copyIntakeArraySteps(artifact.indices)) as MeshIndexArray,
    attributes:artifact.attributes===undefined?undefined:intakeFreeze({
      uv:artifact.attributes.uv===undefined?undefined:(yield* copyIntakeArraySteps(artifact.attributes.uv)) as Float32Array,
      color:artifact.attributes.color===undefined?undefined:(yield* copyIntakeArraySteps(artifact.attributes.color)) as Float32Array})});
}

/**
 * Creates the normal public MeshArtifact snapshot. Every caller Typed Array is
 * copied exactly once; the returned artifact never observes later caller
 * mutations. The backend may reference the snapshot arrays directly.
 */
export const createMeshArtifact = (input: MeshArtifactInput): MeshArtifact =>
  buildMeshArtifact(input, "SnapshotOwned", snapshotBuffers(input));

/**
 * Trusted worker-result move path. This function never copies mesh buffers.
 * It accepts only fully validated, exclusive, unshared, non-resizable full
 * ArrayBuffer views. Successful return transfers logical ownership to the
 * artifact/backend; callers must not mutate, detach, transfer, or reuse the
 * accepted buffers. Rejection leaves ownership with the caller.
 */
export const adoptMeshArtifactBuffers = (input: MeshArtifactInput): MeshArtifact =>
  buildMeshArtifact(input, "AdoptedExclusive", adoptedBuffers(input));

export const meshArtifactOwnedBuffers = (artifact: MeshArtifact): readonly ArrayBuffer[] => Object.freeze([
  artifact.positions.buffer as ArrayBuffer,
  artifact.normals.buffer as ArrayBuffer,
  artifact.indices.buffer as ArrayBuffer,
  ...(artifact.attributes?.uv === undefined ? [] : [artifact.attributes.uv.buffer as ArrayBuffer]),
  ...(artifact.attributes?.color === undefined ? [] : [artifact.attributes.color.buffer as ArrayBuffer])
]);

export const estimateMeshArtifactBytes = (artifact: MeshArtifact): number =>
  meshArtifactOwnedBuffers(artifact).reduce((total, buffer) => total + buffer.byteLength, 0);
