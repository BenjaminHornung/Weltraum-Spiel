import type {
  Upscaler, UpscalerConfig, UpscalerOptions, UpscalerNodeOptions, UpscalePass,
  TemporalGuides, DispatchInputs, GuideDispatchInputs,
} from '@pmndrs/upscaler';
import type { WebGPURenderer, Texture } from 'three/webgpu';
import type {
  BorrowedDepthCameraPort, DispatchCamera, TemporalDispatchInputs, SceneNodeFactory,
  ExplicitNodeFactory,
} from '../build-input/dist/src/upscaler-compatibility.js';
import type { TemporalFrameOwnerInputProposal } from '../build-input/dist/src/owner-input.UNAPPLIED.js';
import type * as Materials from '../build-input/dist/src/b2-materials.js';
import type * as Port from '../build-input/dist/src/port.js';

type Check<T extends true> = T;
type Assignable<A, B> = [A] extends [B] ? true : false;
type PublicRenderer = Check<Assignable<WebGPURenderer, UpscalerOptions['renderer']>>;
type RawConfig = Check<Assignable<UpscalerConfig, Parameters<Upscaler['configure']>[0]>>;
type BorrowedDepth = Check<Assignable<BorrowedDepthCameraPort['depth'], NonNullable<DispatchInputs['depth']>>>;
type RequiredTemporal = Check<Assignable<TemporalDispatchInputs, DispatchInputs>>;
type GuideInputs = Check<Assignable<Pick<TemporalDispatchInputs, 'depth' | 'velocity'>, GuideDispatchInputs>>;
type Camera = Check<Assignable<DispatchCamera, Parameters<Upscaler['beginFrame']>[0]>>;
type Guides = Check<Assignable<TemporalGuides, Upscaler['guides']>>;
type NodeOptions = Check<Assignable<UpscalerNodeOptions, NonNullable<Parameters<SceneNodeFactory>[2]>>>;
type ExplicitFactory = Check<Assignable<ExplicitNodeFactory, typeof import('@pmndrs/upscaler').upscale>>;
type PassCamera = Check<Assignable<DispatchCamera, Parameters<UpscalePass['draw']>[1]>>;
type ReviewInputs = Check<Assignable<TemporalFrameOwnerInputProposal['inputs'], DispatchInputs>>;
type NormalSeparate = Check<Assignable<TemporalFrameOwnerInputProposal['normal'], Texture | null>>;

export type GenuineCompatibilityChecks = [
  PublicRenderer, RawConfig, BorrowedDepth, RequiredTemporal, GuideInputs, Camera,
  Guides, NodeOptions, ExplicitFactory, PassCamera, ReviewInputs, NormalSeparate,
];
export type ExistingMaterialApi = Pick<typeof Materials, 'surfaceMaterial' | 'sky' | 'setWind'>;
export type ExistingPortApi = Pick<typeof Port, 'createDepthCameraPort' | 'assertOwner' | 'windInputs' | 'lightDepthPolicy'>;
