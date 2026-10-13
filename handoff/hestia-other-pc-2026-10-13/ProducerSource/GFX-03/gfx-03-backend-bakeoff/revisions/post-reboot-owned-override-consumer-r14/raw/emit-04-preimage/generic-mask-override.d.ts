import { NodeMaterial, type WebGPURenderer } from 'three/webgpu';
export declare const overrideRestoreKeys: readonly ["maskNode", "opacityNode", "alphaTestNode", "positionNode", "colorNode", "depthNode", "alphaTest", "alphaMap", "transparent", "side", "displacementMap", "displacementScale", "displacementBias"];
export declare function requireDefaultOverrideCache(material: NodeMaterial): void;
/** CPU object transaction used by the public hook; does not evaluate any node. */
export declare function withOwnedOverrideBinding<T>(source: NodeMaterial, target: NodeMaterial, consume: () => T): T;
export interface OverrideLease {
    readonly stats: {
        bindings: number;
        restores: number;
        failed: boolean;
    };
    release(): boolean;
}
/** Public synchronous hook, scoped to caller-owned generic overrides only. */
export declare function installOwnedGenericOverride(renderer: WebGPURenderer, owned: ReadonlySet<NodeMaterial>): OverrideLease;
