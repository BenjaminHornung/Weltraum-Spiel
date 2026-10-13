import * as T from 'three';
import type { MaterialData } from './port.ts';
export declare const materialUniforms: {
    wind: import("three/webgpu").UniformNode<"vec2", T.Vector2>;
    wetness: import("three/webgpu").UniformNode<"float", number>;
};
export declare const glUniforms: {
    wind: {
        value: T.Vector2;
    };
    wetness: {
        value: number;
    };
};
export declare function setWind(x: number, z: number): void;
/** Fixed-base shadeHvpSurface formula; extra AO/wetness/wind hooks are composed, not substituted. */
export declare function surfaceMaterial(api: typeof T, node: boolean, data: MaterialData, water?: boolean, leaf?: boolean): T.Material;
export declare function sky(api: typeof T, node: boolean): {
    mesh: T.Mesh<T.SphereGeometry, T.Material<T.MaterialEventMap>, T.Object3DEventMap>;
    map: T.DataTexture;
};
