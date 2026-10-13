import { packRays } from "./pack-rays.mjs";
export { packRays };
import { assertCurrent } from "../imported/rt01/src/validate.mjs";
import { validateUpload } from "./sparse.mjs";
import { admitAdapter } from '../imported/gfx03/src/capability.mjs';
import { primitiveHit } from "./port.mjs";
export const GPU_DISTANCE_TOLERANCE = 1e-5; // f32 grid-relative functional tolerance; original f64 goldens remain unchanged.
export function requiredLimits(s, rayCount, mode) {
    if (!Number.isSafeInteger(rayCount) || rayCount < 1 || rayCount > 4096)
        throw new Error('Finite GPU profile requires 1..4096 rays');
    const u = s.upload(mode);
    validateUpload(u);
    const max = Math.max(u.pages.byteLength, u.roots.byteLength, u.materials.byteLength, u.metadata.byteLength, rayCount * 64);
    return { maxStorageBufferBindingSize: max, maxBufferSize: max, maxStorageBuffersPerShaderStage: 6, maxComputeInvocationsPerWorkgroup: 64, maxComputeWorkgroupSizeX: 64, maxComputeWorkgroupsPerDimension: Math.ceil(rayCount / 64) };
}
export function admission(adapter, s, rayCount, mode) { return admitAdapter(adapter, [], requiredLimits(s, rayCount, mode)); }
export class GpuDdaBackend {
    #lost = false;
    #disposed = false;
    #pipeline;
    #device;
    constructor(device, pipeline) { this.#device = device; this.#pipeline = pipeline; void device.lost.then(() => { this.#lost = true; }); }
    static async create(device, source) {
        device.pushErrorScope('validation');
        let pipeline;
        let fault;
        try {
            const shader = device.createShaderModule({ code: source, label: 'RT02B flat/two-level packed DDA' }), info = await shader.getCompilationInfo();
            if (info.messages.some(m => m.type === 'error'))
                throw new Error(info.messages.map(m => m.type + ':' + m.message).join('\n'));
            pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module: shader, entryPoint: 'main' } });
        }
        catch (e) {
            fault = e;
        }
        const error = await device.popErrorScope();
        if (error || fault || !pipeline)
            throw fault ?? new Error(error?.message ?? 'Pipeline unavailable');
        return new GpuDdaBackend(device, pipeline);
    }
    async traceFrozen(s, rays, current, mode, signal) { return this.#run(s, rays, current, mode, false, signal); }
    async query(s, rays, current, mode, signal) { return this.#run(s, rays, current, mode, true, signal); }
    async #run(s, rays, current, mode, strict, signal) {
        const submittedBinding = s.binding, submittedRotation = s.spatial.rotation;
        const live = () => { if (this.#disposed || this.#lost || signal?.aborted)
            throw new Error('Cancelled/disposed/lost GPU projection'); assertCurrent(s.binding, submittedBinding); assertCurrent(current(), submittedBinding); };
        live();
        const device = this.#device, limits = requiredLimits(s, rays.length, mode);
        for (const [k, n] of Object.entries(limits))
            if (device.limits[k] < n)
                throw new Error('Requested device limit unavailable ' + k);
        const upload = s.upload(mode);
        validateUpload(upload);
        const rayData = packRays(s, rays, strict), buffers = [];
        const buffer = (data, usage) => {
            const byteLength = data.byteLength;
            if (!byteLength)
                throw new Error('Detached/empty GPU input');
            const b = device.createBuffer({ size: Math.max(4, byteLength), usage: usage | GPUBufferUsage.COPY_DST });
            buffers.push(b);
            device.queue.writeBuffer(b, 0, data);
            return b;
        };
        device.pushErrorScope('validation');
        let failure;
        let output;
        try {
            const bound = [upload.pages, upload.roots, upload.materials, upload.metadata, rayData].map(d => buffer(d, GPUBufferUsage.STORAGE));
            const result = device.createBuffer({ size: rays.length * 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
            buffers.push(result);
            bound.push(result);
            const read = device.createBuffer({ size: rays.length * 64, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
            buffers.push(read);
            const group = device.createBindGroup({ layout: this.#pipeline.getBindGroupLayout(0), entries: bound.map((b, binding) => ({ binding, resource: { buffer: b } })) });
            const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
            pass.setPipeline(this.#pipeline);
            pass.setBindGroup(0, group);
            pass.dispatchWorkgroups(Math.ceil(rays.length / 64));
            pass.end();
            encoder.copyBufferToBuffer(result, 0, read, 0, rays.length * 64);
            device.queue.submit([encoder.finish()]);
            await read.mapAsync(GPUMapMode.READ);
            live();
            const data = read.getMappedRange().slice(0), v = new DataView(data), rotation = submittedRotation;
            output = rays.map((_, i) => {
                const p = i * 64, kind = ['Miss', 'Hit', 'Unknown', 'BudgetExceeded'][v.getInt32(p + 12, true)];
                if (!kind)
                    throw new Error('Invalid GPU result classification');
                const coords = [0, 1, 2].map(a => v.getInt32(p + a * 4, true)), cell = coords.every(n => n === -1) ? null : coords;
                if (cell && cell.some((n, a) => n < 0 || n >= s.size[a]))
                    throw new Error('Invalid GPU hit cell');
                const normal = [0, 1, 2].map(a => v.getFloat32(p + 16 + a * 4, true)), worldNormal = [0, 1, 2].map(a => rotation[a * 3] * normal[0] + rotation[a * 3 + 1] * normal[1] + rotation[a * 3 + 2] * normal[2]);
                const distance = v.getFloat32(p + 28, true);
                if (!Number.isFinite(distance) || distance < 0)
                    throw new Error('Invalid GPU distance');
                const r = s.hitResult(kind, cell, distance, worldNormal);
                if (kind === 'Hit' && r.materialId !== v.getUint32(p + 32, true))
                    throw new Error('GPU material mismatch');
                return primitiveHit(r, submittedBinding, { pageLookups: v.getUint32(p + 48, true), rootLookups: v.getUint32(p + 52, true), cellTests: v.getUint32(p + 56, true), emptySkips: v.getUint32(p + 60, true) });
            });
            read.unmap();
        }
        catch (e) {
            failure = e;
        }
        finally {
            buffers.forEach(b => b.destroy());
        }
        const error = await device.popErrorScope();
        if (failure || error)
            throw failure ?? new Error(error.message);
        live();
        return output;
    }
    dispose() { this.#disposed = true; }
}
