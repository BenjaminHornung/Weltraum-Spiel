import * as T from 'three';
export declare const FIXTURE_PIN = "bc6e9be728c932b0fe6f88ea2d6024f61b2b53bc59d47aae0e941c499a34dbea";
export type Variant = 'historical-webgl' | 'current-webgl' | 'current-webgpu';
export type SceneId = 'terrain-ao' | 'alpha-wind' | 'water-depth';
export type Defect = 'none' | 'vertex-colors' | 'ao' | 'emission' | 'water-assignment' | 'water-depth' | 'water-side';
export interface MaterialData {
    id: string;
    role: string;
    colorLinearRgb: [number, number, number];
}
export interface Payload {
    id: string;
    path: string;
    elementType: string;
    byteLength: number;
    length: number;
    sha256: string;
}
export interface MeshData {
    positions: string;
    normals: string;
    indices: string;
    materialId: string;
}
export interface Fixture {
    sourceBinding: Record<string, unknown>;
    materials: MaterialData[];
    objects: {
        ownerId: string;
        meshes: MeshData[];
    }[];
    payloads: Payload[];
}
export interface CameraData {
    id: string;
    positionMeters: [number, number, number];
    targetMeters: [number, number, number];
    up: [number, number, number];
    verticalFovDegrees: number;
}
export declare const lightDepthPolicy: Readonly<{
    sun: readonly [-28, 42, -18];
    sunIntensity: 2.1;
    ambient: 0.65;
    linearHdr: true;
    exposure: 1.05;
    toneMapping: "ACESFilmic once at final output";
    waterDepthWrite: false;
    waterStrategy: "single planar DoubleSide forceSinglePass; opaque depth test; transparent back-to-front sort";
    volumeStrategy: "bounded transparent single-layer optical candidate; not an ATM volume solver";
}>;
export declare function digest(bytes: Uint8Array | Uint8ClampedArray): Promise<string>;
export declare function loadPort(): Promise<{
    fixture: Fixture;
    camera: CameraData;
    buffers: Map<string, Uint32Array<ArrayBufferLike> | Float32Array<ArrayBufferLike>>;
    policy: Readonly<{
        sun: readonly [-28, 42, -18];
        sunIntensity: 2.1;
        ambient: 0.65;
        linearHdr: true;
        exposure: 1.05;
        toneMapping: "ACESFilmic once at final output";
        waterDepthWrite: false;
        waterStrategy: "single planar DoubleSide forceSinglePass; opaque depth test; transparent back-to-front sort";
        volumeStrategy: "bounded transparent single-layer optical candidate; not an ATM volume solver";
    }>;
}>;
/** Same RD14 stable-ID/tick/owner-local response; only decoration gets this projection. */
export declare function windInputs(clusterId: string, tick: number, stiffness: number, wind: [number, number, number], rotation: [number, number, number, number], reducedMotion?: boolean): Readonly<{
    x: number;
    z: number;
    phase: number;
}>;
export declare function assertOwner(current: {
    owner: string;
    generation: number;
}, expected: {
    owner: string;
    generation: number;
}): void;
/** Borrowed presentation depth; caller owns no renderer/session and must re-read after epoch change. */
export declare function createDepthCameraPort(camera: T.PerspectiveCamera, depth: T.DepthTexture, epoch: number, sourceBinding: Record<string, unknown>): Readonly<{
    epoch: number;
    sourceBinding: Readonly<{
        [x: string]: unknown;
    }>;
    depth: Readonly<T.DepthTexture>;
    projection: readonly number[];
    view: readonly number[];
    materialProfiles: readonly string[];
    lightDepth: Readonly<{
        sun: readonly [-28, 42, -18];
        sunIntensity: 2.1;
        ambient: 0.65;
        linearHdr: true;
        exposure: 1.05;
        toneMapping: "ACESFilmic once at final output";
        waterDepthWrite: false;
        waterStrategy: "single planar DoubleSide forceSinglePass; opaque depth test; transparent back-to-front sort";
        volumeStrategy: "bounded transparent single-layer optical candidate; not an ATM volume solver";
    }>;
    depthInterpretation: "native renderer clip convention; WebGPU [0,1], WebGL [-1,1]; opaque-only writers";
}>;
