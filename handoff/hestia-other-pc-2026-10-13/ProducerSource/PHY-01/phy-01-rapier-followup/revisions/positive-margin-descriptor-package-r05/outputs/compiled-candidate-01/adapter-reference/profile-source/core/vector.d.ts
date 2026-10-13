export interface Vec3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}
export declare const vec3: (x?: number, y?: number, z?: number) => Vec3;
export declare const add: (a: Vec3, b: Vec3) => Vec3;
export declare const sub: (a: Vec3, b: Vec3) => Vec3;
export declare const scale: (v: Vec3, factor: number) => Vec3;
export declare const dot: (a: Vec3, b: Vec3) => number;
export declare const cross: (a: Vec3, b: Vec3) => Vec3;
export declare const magnitude: (v: Vec3) => number;
export declare const distance: (a: Vec3, b: Vec3) => number;
export declare const normalize: (v: Vec3) => Vec3;
export declare const clamp: (value: number, min: number, max: number) => number;
export declare const projectPointOnSegment: (point: Vec3, start: Vec3, end: Vec3) => Vec3;
export declare const roundVec: (v: Vec3, decimals?: number) => Vec3;
