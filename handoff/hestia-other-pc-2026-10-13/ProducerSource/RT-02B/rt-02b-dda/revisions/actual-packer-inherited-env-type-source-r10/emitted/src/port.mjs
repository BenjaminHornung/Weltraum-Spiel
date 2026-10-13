import { assertCurrent } from "../imported/rt01/src/validate.mjs";
import { assertOwner, createDepthCameraPort, lightDepthPolicy } from "../imported/gfx03/src/port.js";
export { createDepthCameraPort, lightDepthPolicy };
export const measurementSchema = 'hestia.rt-telemetry.v1';
export function validatePresentation(port, binding, epoch) {
    if (port.epoch !== epoch)
        throw new Error('Stale borrowed depth epoch');
    assertCurrent(port.sourceBinding, binding);
    assertOwner({ owner: binding.owner, generation: binding.sourceGeneration }, { owner: String(port.sourceBinding.owner), generation: Number(port.sourceBinding.sourceGeneration) });
    if (port.projection.length !== 16 || port.view.length !== 16 || ![...port.projection, ...port.view].every(Number.isFinite))
        throw new Error('Invalid copied camera');
    return port;
}
export function primitiveHit(result, binding, counters, simulationTick = null) {
    if (simulationTick !== null && (!Number.isSafeInteger(simulationTick) || simulationTick < 0))
        throw new Error('Invalid 120Hz simulation tick');
    return Object.freeze({ result, sourceBinding: Object.freeze({ ...binding }),
        surface: result.kind === 'Hit' ? Object.freeze({ cellId: result.cellId, owner: result.owner, cell: result.cell, normal: result.normal, materialId: result.materialId, materialSource: result.materialSource }) : null,
        classification: result.kind === 'Hit' ? 'OCCUPIED' : result.kind === 'Unknown' ? 'UNKNOWN' : result.kind === 'Miss' ? 'KNOWN_EMPTY' : 'UNRESOLVED_BUDGET',
        simulationTick, tickHz: 120, telemetry: Object.freeze({ schema: measurementSchema, t_authority_commit: null, t_mesh_visible: null, t_ray_projection_accepted: null, t_lighting_current_visible: null }),
        counters: Object.freeze({ ...counters }), cpuMilliseconds: null, gpuMilliseconds: null });
}
export class DdaBackend {
    sparse;
    constructor(sparse) { this.sparse = sparse; }
    query(ray, current, mode, simulationTick = null, borrowed) {
        if (borrowed)
            validatePresentation(borrowed.port, current, borrowed.currentEpoch);
        const { result, counters } = this.sparse.query(ray, current, mode);
        return primitiveHit(result, current, counters, simulationTick);
    }
    dispose() { this.sparse.dispose(); }
}
