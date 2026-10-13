import { RawDebugRenderPipeline } from "../raw";
/**
 * The vertex and color buffers for debug-rendering the physics scene.
 */
export class DebugRenderBuffers {
    /**
     * The lines to render. This is a flat array containing all the lines
     * to render. Each line is described as two consecutive point. Each
     * point is described as two (in 2D) or three (in 3D) consecutive
     * floats. For example, in 2D, the array: `[1, 2, 3, 4, 5, 6, 7, 8]`
     * describes the two segments `[[1, 2], [3, 4]]` and `[[5, 6], [7, 8]]`.
     */
    vertices;
    /**
     * The color buffer. There is one color per vertex, and each color
     * has four consecutive components (in RGBA format).
     */
    colors;
    constructor(vertices, colors) {
        this.vertices = vertices;
        this.colors = colors;
    }
}
/**
 * A pipeline for rendering the physics scene.
 *
 * To avoid leaking WASM resources, this MUST be freed manually with `debugRenderPipeline.free()`
 * once you are done using it (and all the rigid-bodies it created).
 */
export class DebugRenderPipeline {
    raw;
    vertices;
    colors;
    /**
     * Release the WASM memory occupied by this serialization pipeline.
     */
    free() {
        if (!!this.raw) {
            this.raw.free();
        }
        this.raw = undefined;
        this.vertices = undefined;
        this.colors = undefined;
    }
    constructor(raw) {
        this.raw = raw || new RawDebugRenderPipeline();
    }
    render(bodies, colliders, soft_bodies, impulse_joints, multibody_joints, narrow_phase, filterFlags, filterPredicate) {
        this.raw.render(bodies.raw, colliders.raw, soft_bodies.raw, impulse_joints.raw, multibody_joints.raw, narrow_phase.raw, filterFlags, colliders.castClosure(filterPredicate));
        this.vertices = this.raw.vertices();
        this.colors = this.raw.colors();
    }
}
