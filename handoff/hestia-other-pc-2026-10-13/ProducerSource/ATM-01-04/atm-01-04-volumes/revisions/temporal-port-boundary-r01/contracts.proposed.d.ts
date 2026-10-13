// SOURCE_CANDIDATE only. No implementation, imports, handles or available producer export.
// Existing AtmosphereFrame/WeatherResult stay in their frozen sources named in port-map.json.
export type BackendOption = 'WEBGL_ONLY' | 'DEFERRED_LANE_B_TSL';
export type Vec3 = readonly [number, number, number];
export type Matrix4Elements = readonly number[]; // Exactly 16 finite values; later runtime admission must validate.
export interface FrozenSourceRef {
  readonly sourceId: string;
  readonly absolutePath: string;
  readonly bytes: number;
  readonly sha256: string;
}
export interface PresentationFrameBinding {
  readonly viewSessionId: string;
  readonly frameId: string;
  readonly resourceGeneration: number;
  readonly cameraEpoch: number;
  readonly projectionEpoch: number;
  readonly sourcePresentationRevision: string;
  readonly weatherSnapshotId: string;
  readonly opticsDigest: string;
  readonly atlasDigest: string;
  readonly atlasEpoch: number;
  readonly originMeters: Vec3;
}
export interface BorrowedImageRef {
  readonly ownerId: string;
  readonly resourceKey: string; // Metadata only; no adopted private backend handle.
  readonly frame: PresentationFrameBinding;
  readonly backend: 'WebGL' | 'WebGPU';
  readonly width: number;
  readonly height: number;
  readonly sampleCount: 1;
  readonly format: string;
  readonly validUntil: 'FRAME_END_OR_OWNER_GENERATION_CHANGE';
  readonly disposalOwner: 'PRODUCER_ONLY';
}
export interface OpaqueDepthInput {
  readonly image: BorrowedImageRef;
  readonly projectionKind: 'Perspective' | 'Orthographic';
  readonly clipDepthRange: 'MinusOneToOne' | 'ZeroToOne';
  readonly nearMeters: number;
  readonly farMeters: number;
  readonly reversedZ: boolean;
  readonly logarithmicDepth: false;
  readonly encoding: 'NATIVE_SINGLE_SAMPLE_DEPTH_ATTACHMENT';
  readonly writers: 'OPAQUE_ONLY';
  readonly backgroundValidity: 'EXPLICIT_SKY_DISPOSITION';
  readonly currentProjectionUnjittered: Matrix4Elements;
  readonly currentView: Matrix4Elements;
}
export type VelocityInput =
  | { readonly availability: 'MISSING'; readonly reasons: readonly string[] }
  | {
      readonly availability: 'AVAILABLE';
      readonly image: BorrowedImageRef;
      readonly convention: 'UNJITTERED_NDC_CURRENT_MINUS_PREVIOUS';
      readonly previousFrameId: string;
      readonly previousProjectionUnjittered: Matrix4Elements;
      readonly previousView: Matrix4Elements;
      readonly geometryDeformationOracle: FrozenSourceRef;
      readonly disocclusionPolicy: 'NO_PREVIOUS_COLOR_FOR_NEW_SURFACE';
    };
export type ReactiveInput =
  | { readonly availability: 'MISSING'; readonly reasons: readonly string[] }
  | {
      readonly availability: 'AVAILABLE';
      readonly image: BorrowedImageRef;
      readonly channel: 'RED_0_TO_1';
      readonly includes: readonly ('Water' | 'Volume' | 'Rain' | 'Lightning' | 'NewSurface')[];
      readonly coverageOracle: FrozenSourceRef;
      readonly lighting: PresentedLightChange;
    };
export interface PresentedLightChange {
  readonly bindingRef: FrozenSourceRef; // Existing authority/event projection; does not invent an event.
  readonly revision: string;
  readonly eventId: string | null;
  readonly phase: 'STEADY' | 'BEGIN' | 'CHANGE' | 'END';
  readonly sourceStrength: number;
  readonly sunDirectionBody: Vec3;
  readonly shadowAtlasLightingDigest: string;
}
export interface PreToneVolumeContribution {
  readonly hdrColor: BorrowedImageRef;
  readonly colorSpace: 'LINEAR_HDR';
  readonly toneMapped: false;
  readonly depth: OpaqueDepthInput;
  readonly waterDepth: BorrowedImageRef | null;
  readonly waterStrategy: 'NEAREST_PLANAR_FRONT_BACK_ALPHA_PRESERVED';
  readonly velocity: VelocityInput;
  readonly reactive: ReactiveInput;
}
export interface CommonHistoryState {
  readonly generation: number;
  readonly valid: boolean;
  readonly inputResolution: readonly [number, number];
  readonly displayResolution: readonly [number, number];
  readonly cameraEpoch: number;
  readonly projectionEpoch: number;
  readonly sourceFrameId: string;
  readonly bufferOwner: 'SELECTED_TEMPORAL_PACKAGE_ONLY';
}
export type ResetDisposition =
  | { readonly action: 'KEEP'; readonly reason: 'PROVEN_COHERENT_MOTION_OR_STEADY_FRAME' }
  | { readonly action: 'REACTIVE'; readonly reason: 'PROVEN_SHADING_COVERAGE'; readonly input: ReactiveInput & { readonly availability: 'AVAILABLE' } }
  | { readonly action: 'RESET_ONCE'; readonly reasons: readonly string[] }
  | { readonly action: 'REFUSE'; readonly reasons: readonly string[] };
export type WeatherAdmission =
  | { readonly status: 'Known'; readonly frozenResult: FrozenSourceRef; readonly authoredMask: FrozenSourceRef | null }
  | { readonly status: 'NoAtmosphere'; readonly frozenResult: FrozenSourceRef }
  | { readonly status: 'Pending'; readonly frozenResult: FrozenSourceRef; readonly dependency: string }
  | { readonly status: 'UnknownCoverage' | 'Unsupported'; readonly frozenResult: FrozenSourceRef; readonly reasonCode: string };
