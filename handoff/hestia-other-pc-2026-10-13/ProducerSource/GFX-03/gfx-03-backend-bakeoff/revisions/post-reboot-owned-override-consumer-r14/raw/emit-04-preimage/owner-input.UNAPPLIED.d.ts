import type { UpscalerConfig, TemporalGuides } from '@pmndrs/upscaler';
import type { Texture } from 'three';
import type { BorrowedDepthCameraPort, DispatchCamera, ExistingMaterialOwner, TemporalDispatchInputs } from './upscaler-compatibility.js';
export interface TemporalFrameOwnerInputProposal {
    readonly disposition: 'UNAPPLIED_AUTHENTIC_FRAME_OWNER_MISSING';
    readonly borrowed: BorrowedDepthCameraPort;
    readonly camera: DispatchCamera;
    readonly materialOwners: readonly ExistingMaterialOwner[];
    readonly config: UpscalerConfig;
    readonly inputs: TemporalDispatchInputs;
    readonly frame: {
        readonly presentationGeneration: number;
        readonly renderFrameId: number;
        readonly worldRevision: number;
        readonly cameraEpoch: number;
        readonly projectionEpoch: number;
        readonly sceneContentEpoch: number;
        readonly deltaRenderSeconds: number;
        readonly internal: {
            readonly widthPx: number;
            readonly heightPx: number;
        };
        readonly display: {
            readonly widthPx: number;
            readonly heightPx: number;
        };
    };
    readonly normal: Texture | null;
    readonly guides: TemporalGuides | null;
}
