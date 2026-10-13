import { validateVolume, validateRay, assertCurrent } from "../imported/rt01/src/validate.mjs";
import { packBytes, readByte, quoteResidency } from "./bytes.mjs";
export const KNOWN_EMPTY = 0, UNKNOWN = 1, OCCUPIED = 2, BRICK_EDGE = 8, ROOT_EDGE = 32;
const creationToken = Symbol('validated sparse snapshot');
const index = (c, s) => c[0] + s[0] * (c[1] + s[1] * c[2]);
const deepFreeze = (v) => { if (v && typeof v === 'object') {
    Object.values(v).forEach(deepFreeze);
    Object.freeze(v);
} return v; };
async function digest(v) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(v))); return [...new Uint8Array(b)].map(n => n.toString(16).padStart(2, '0')).join(''); }
export async function validateSnapshot(v, expected) {
    validateVolume(v);
    assertCurrent(v.binding, expected);
    if (v.cells.some(n => n > 254) || v.materials.some(m => m.id > 254))
        throw new RangeError('Material IDs must fit uint8, 255 is Unknown');
    if (v.cellIds.some(n => !n) || new Set(v.cellIds).size !== v.cellIds.length)
        throw new Error('Stable unique cell identities required');
    const source = { size: v.size, cellMeters: v.cellMeters, origin: v.origin, cells: v.cells, cellIds: v.cellIds, authorityLeafEdge: v.authorityLeafEdge, rayPageEdge: v.rayPageEdge, coverage: v.coverage, exteriorCoverage: v.exteriorCoverage };
    if (await digest(source) !== v.binding.sourceDigest || await digest(v.materials) !== v.binding.materialDigest)
        throw new Error('Source/material payload digest mismatch');
}
export function validateUpload(u) {
    if (new Uint8Array(new Uint32Array([1]).buffer)[0] !== 1)
        throw new Error('Unsupported host byte order');
    for (const a of [u.pages, u.roots, u.materials, u.metadata]) {
        new DataView(a.buffer, a.byteOffset, 0);
        if (a.byteLength === 0)
            throw new Error('Empty or detached upload buffer');
    }
    if (u.metadata.byteLength !== 128)
        throw new Error('Metadata layout mismatch');
}
export class SparseVolume {
    #v;
    #pages;
    #roots;
    #materials;
    #pageSize;
    #rootSize;
    #disposed = false;
    constructor(token, v, pages, roots, materials, pageSize, rootSize) {
        if (token !== creationToken)
            throw new Error('Use validated createSparseVolume');
        this.#v = v;
        this.#pages = pages;
        this.#roots = roots;
        this.#materials = materials;
        this.#pageSize = pageSize;
        this.#rootSize = rootSize;
    }
    #live() { if (this.#disposed)
        throw new Error('Disposed sparse projection'); }
    get binding() { this.#live(); return deepFreeze({ ...this.#v.binding }); }
    get size() { this.#live(); return [...this.#v.size]; }
    get spatial() { this.#live(); return deepFreeze({ origin: [...this.#v.origin], rotation: [...this.#v.rotation], translation: [...this.#v.translation], cellMeters: this.#v.cellMeters, exteriorCoverage: this.#v.exteriorCoverage }); }
    get occupiedIds() { this.#live(); return Object.freeze(this.#v.cellIds.filter((_, i) => this.#v.cells[i] > 0)); }
    localRay(ray) {
        this.#live();
        validateRay(ray);
        const v = this.#v;
        const inv = (p) => [0, 1, 2].map(a => v.rotation[a] * p[0] + v.rotation[3 + a] * p[1] + v.rotation[6 + a] * p[2]);
        return { origin: inv(ray.origin.map((n, a) => n - v.translation[a])), direction: inv(ray.direction) };
    }
    slot(cell) {
        this.#live();
        if (cell.some((n, a) => !Number.isSafeInteger(n) || n < 0 || n >= this.#v.size[a]))
            throw new RangeError('Cell outside coverage');
        const page = cell.map(n => Math.floor(n / BRICK_EDGE)), p = this.#pages[index(page, this.#pageSize)];
        return this.#read(cell, p);
    }
    #read(cell, p) {
        if (p === KNOWN_EMPTY)
            return 0;
        if (p === UNKNOWN)
            return -1;
        const local = cell.map(n => n % BRICK_EDGE), b = readByte(this.#materials, (p - OCCUPIED) * 512 + index(local, [8, 8, 8]));
        return b === 255 ? -1 : b;
    }
    traceFrozen(ray, expected, mode = 'flat') { return this.#trace(ray, expected, mode, false); }
    query(ray, expected, mode = 'flat') { return this.#trace(ray, expected, mode, true); }
    #trace(ray, expected, mode, strict) {
        this.#live();
        assertCurrent(this.#v.binding, expected);
        validateRay(ray);
        if (mode !== 'flat' && mode !== 'two-level')
            throw new Error('Unknown traversal mode');
        const v = this.#v, { origin, direction } = this.localRay(ray), counters = { pageLookups: 0, rootLookups: 0, cellTests: 0, emptySkips: 0 };
        if (![...origin, ...direction].every(Number.isFinite))
            throw new RangeError('Nonfinite local ray');
        const normalWorld = (n) => [0, 1, 2].map(a => v.rotation[a * 3] * n[0] + v.rotation[a * 3 + 1] * n[1] + v.rotation[a * 3 + 2] * n[2]);
        const miss = () => ({ kind: 'Miss', distance: ray.maxDistance, normal: [0, 0, 0], cell: null, materialId: null, materialSource: null, owner: null, cellId: null, sourceRevision: null, sourceGeneration: null, transformGeneration: null, originEpoch: null });
        const bound = (kind, distance) => ({ ...miss(), kind, distance, owner: v.binding.owner, sourceRevision: v.binding.sourceRevision, sourceGeneration: v.binding.sourceGeneration, transformGeneration: v.binding.transformGeneration, originEpoch: v.binding.originEpoch });
        const done = (result) => ({ result, counters });
        const near = (value, bound, width) => Math.abs(value - bound) <= Math.min(Number.EPSILON * 8 * Math.max(1, Math.abs(value), Math.abs(bound)), width * 1e-6);
        const eps = (a, b) => 1e-10 * Math.max(1, Math.abs(a), Math.abs(b));
        const outside = origin.some((n, a) => { const lo = v.origin[a], hi = lo + v.size[a] * v.cellMeters; if (near(n, lo, hi - lo))
            return direction[a] < 0; if (near(n, hi, hi - lo))
            return direction[a] >= 0; return n < lo || n > hi; });
        if (v.exteriorCoverage === 'Unknown' && outside)
            return done(bound('Unknown', 0));
        let entry = -Infinity, exit = Infinity, entryAxis = -1;
        for (let a = 0; a < 3; a++) {
            const lo = v.origin[a], hi = lo + v.size[a] * v.cellMeters, d = direction[a];
            if (d === 0) {
                if (origin[a] < lo && !near(origin[a], lo, hi - lo) || origin[a] >= hi || near(origin[a], hi, hi - lo))
                    return done(miss());
                continue;
            }
            const nearTime = Math.min((lo - origin[a]) / d, (hi - origin[a]) / d);
            if (entryAxis < 0 || nearTime > entry + eps(nearTime, entry)) {
                entry = nearTime;
                entryAxis = a;
            }
            exit = Math.min(exit, Math.max((lo - origin[a]) / d, (hi - origin[a]) / d));
        }
        let distance = outside ? Math.max(0, entry) : 0;
        const end = Math.min(exit, ray.maxDistance);
        const ended = () => v.exteriorCoverage === 'Unknown' && exit < ray.maxDistance - eps(exit, ray.maxDistance) ? bound('Unknown', Math.max(0, exit)) :
            strict && exit > ray.maxDistance + eps(exit, ray.maxDistance) ? bound('BudgetExceeded', ray.maxDistance) : miss();
        if (end - distance <= eps(end, distance))
            return done(strict && entry >= ray.maxDistance && exit > entry ? bound('BudgetExceeded', ray.maxDistance) : miss());
        const step = direction.map(Math.sign);
        const cellAt = (t) => origin.map((n, a) => {
            const q = (n + t * direction[a] - v.origin[a]) / v.cellMeters, rounded = Math.round(q);
            const value = near(n + t * direction[a], v.origin[a] + rounded * v.cellMeters, v.cellMeters) ? rounded : q;
            return (Math.floor(value) - (direction[a] < 0 && Number.isInteger(value) ? 1 : 0)) || 0;
        });
        let cell = cellAt(distance), normal = [0, 0, 0];
        if (outside && entry > 0)
            normal[entryAxis] = -step[entryAxis];
        const nextAt = () => direction.map((d, a) => d === 0 ? Infinity : (v.origin[a] + (cell[a] + (step[a] > 0 ? 1 : 0)) * v.cellMeters - origin[a]) / d);
        let next = nextAt(), visited = 0;
        // shortcut: small logical budgets traverse cells exactly; enable skipping only above the convex-grid worst-case cell count.
        const canSkip = ray.maxSteps >= v.size.reduce((a, b) => a + b, 0) + 3;
        let lastRoot = -1, rootEmpty = false, lastPage = -1, pageCode = 0;
        const emptyEdge = () => {
            if (mode === 'two-level' && canSkip) {
                const ri = index(cell.map(n => Math.floor(n / ROOT_EDGE)), this.#rootSize);
                if (ri !== lastRoot) {
                    counters.rootLookups++;
                    lastRoot = ri;
                    rootEmpty = this.#roots[ri] === KNOWN_EMPTY;
                }
                if (rootEmpty)
                    return ROOT_EDGE;
            }
            const pi = index(cell.map(n => Math.floor(n / BRICK_EDGE)), this.#pageSize);
            if (pi !== lastPage) {
                counters.pageLookups++;
                lastPage = pi;
                pageCode = this.#pages[pi];
            }
            return canSkip && pageCode === KNOWN_EMPTY ? BRICK_EDGE : 1;
        };
        while (distance < end) {
            if (cell.some((n, a) => n < 0 || n >= v.size[a]))
                return done(ended());
            const edge = emptyEdge();
            if (edge > 1) {
                const crossing = Math.min(...direction.map((d, a) => d === 0 ? Infinity :
                    (v.origin[a] + (step[a] > 0 ? Math.min(v.size[a], (Math.floor(cell[a] / edge) + 1) * edge) : Math.floor(cell[a] / edge) * edge) * v.cellMeters - origin[a]) / d));
                counters.emptySkips++;
                if (crossing >= end - eps(crossing, end))
                    return done(ended());
                distance = crossing;
                cell = cellAt(distance);
                normal = [0, 0, 0];
                for (let a = 0; a < 3; a++) {
                    if (direction[a] === 0)
                        continue;
                    const t = (v.origin[a] + (cell[a] + (step[a] < 0 ? 1 : 0)) * v.cellMeters - origin[a]) / direction[a];
                    if (Math.abs(t - distance) <= eps(t, distance)) {
                        normal[a] = -step[a];
                        break;
                    }
                }
                next = nextAt();
                continue;
            }
            const slot = this.#read(cell, pageCode), crossing = Math.min(...next), i = index(cell, v.size);
            const result = (kind) => ({ kind, distance, normal: normalWorld(normal), cell: [...cell], materialId: kind === 'Hit' ? slot : null, materialSource: kind === 'Hit' ? v.materials.find(m => m.id === slot).source : null, owner: v.binding.owner, cellId: v.cellIds[i], sourceRevision: v.binding.sourceRevision, sourceGeneration: v.binding.sourceGeneration, transformGeneration: v.binding.transformGeneration, originEpoch: v.binding.originEpoch });
            if (Math.min(crossing, end) - distance > eps(Math.min(crossing, end), distance)) {
                if (visited >= ray.maxSteps)
                    return done(result('BudgetExceeded'));
                visited++;
                counters.cellTests++;
                if (slot === -1)
                    return done(result('Unknown'));
                if (slot > 0)
                    return done(result('Hit'));
            }
            if (crossing >= end - eps(crossing, end))
                return done(ended());
            const tied = next.map((n, a) => Number.isFinite(n) && Math.abs(n - crossing) <= eps(n, crossing) ? a : -1).filter(a => a >= 0);
            normal = [0, 0, 0];
            normal[tied[0]] = -step[tied[0]];
            for (const a of tied) {
                cell[a] += step[a];
                next[a] += direction[a] === 0 ? Infinity : v.cellMeters / Math.abs(direction[a]);
            }
            distance = crossing;
        }
        return done(ended());
    }
    hitResult(kind, cell, distance, normal) {
        this.#live();
        const v = this.#v, slot = cell ? this.slot(cell) : 0, i = cell ? index(cell, v.size) : -1;
        if (kind === 'Hit' && slot <= 0 || kind === 'Unknown' && cell && slot !== -1)
            throw new Error('GPU hit does not match bound source');
        const src = kind !== 'Miss';
        return { kind, distance, normal, cell, materialId: kind === 'Hit' ? slot : null, materialSource: kind === 'Hit' ? v.materials.find(m => m.id === slot).source : null, owner: src ? v.binding.owner : null, cellId: i >= 0 ? v.cellIds[i] : null, sourceRevision: src ? v.binding.sourceRevision : null, sourceGeneration: src ? v.binding.sourceGeneration : null, transformGeneration: src ? v.binding.transformGeneration : null, originEpoch: src ? v.binding.originEpoch : null };
    }
    upload(mode) {
        this.#live();
        const metadata = new Uint32Array(32);
        metadata.set(this.#v.size, 0);
        metadata[3] = this.#v.exteriorCoverage === 'Unknown' ? 1 : 0;
        metadata.set(this.#pageSize, 4);
        metadata[7] = mode === 'two-level' ? 1 : 0;
        metadata.set(this.#rootSize, 8);
        return { pages: this.#pages.slice(), roots: mode === 'two-level' ? this.#roots.slice() : new Uint32Array(1), materials: this.#materials.length ? this.#materials.slice() : new Uint32Array(1), metadata, binding: this.binding, mode };
    }
    residency(mode, alignment, historyBytes = 0) { this.#live(); return quoteResidency({ payloadBytes: this.#materials.byteLength, pageTableBytes: this.#pages.byteLength, hierarchyBytes: mode === 'two-level' ? this.#roots.byteLength : 0, metadataBytes: 128, historyBytes }, alignment); }
    async move(next, expected) {
        this.#live();
        const copy = structuredClone(next);
        await validateSnapshot(copy, expected);
        this.#live();
        const old = this.#v;
        for (const k of Object.keys(old.binding))
            if (k !== 'transformGeneration' && old.binding[k] !== copy.binding[k])
                throw new Error('Motion may only change transform generation');
        if (copy.binding.transformGeneration <= old.binding.transformGeneration)
            throw new Error('Nonmonotonic transform generation');
        this.#v = deepFreeze(copy);
    }
    dispose() { this.#disposed = true; }
}
export async function createSparseVolume(volume, expected, signal) {
    if (signal?.aborted)
        throw new Error('Cancelled sparse build');
    const v = structuredClone(volume);
    await validateSnapshot(v, expected);
    if (signal?.aborted)
        throw new Error('Cancelled sparse build');
    const pageSize = v.size.map(n => Math.ceil(n / 8)), rootSize = v.size.map(n => Math.ceil(n / 32));
    const pages = new Uint32Array(pageSize.reduce((a, b) => a * b, 1)), roots = new Uint32Array(rootSize.reduce((a, b) => a * b, 1)), payload = [];
    for (let pz = 0; pz < pageSize[2]; pz++)
        for (let py = 0; py < pageSize[1]; py++)
            for (let px = 0; px < pageSize[0]; px++) {
                const bytes = new Uint8Array(512);
                let empty = true, unknown = true;
                for (let z = 0; z < 8; z++)
                    for (let y = 0; y < 8; y++)
                        for (let x = 0; x < 8; x++) {
                            const c = [px * 8 + x, py * 8 + y, pz * 8 + z];
                            if (c.some((n, a) => n >= v.size[a]))
                                continue;
                            const slot = v.cells[index(c, v.size)];
                            bytes[index([x, y, z], [8, 8, 8])] = slot === -1 ? 255 : slot;
                            empty &&= slot === 0;
                            unknown &&= slot === -1;
                        }
                const pi = index([px, py, pz], pageSize);
                if (empty)
                    pages[pi] = KNOWN_EMPTY;
                else if (unknown)
                    pages[pi] = UNKNOWN;
                else {
                    pages[pi] = OCCUPIED + payload.length / 512;
                    payload.push(...bytes);
                }
                if (!empty)
                    roots[index([Math.floor(px / 4), Math.floor(py / 4), Math.floor(pz / 4)], rootSize)] = OCCUPIED;
            }
    return new SparseVolume(creationToken, deepFreeze(v), pages, roots, packBytes(new Uint8Array(payload)), pageSize, rootSize);
}
export class ProjectionSet {
    #current = [];
    #epoch = 0;
    get epoch() { return this.#epoch; }
    replace(next, expected, epoch) {
        if (epoch !== this.#epoch || next.length !== expected.length)
            throw new Error('Stale/cancelled adoption');
        next.forEach((v, i) => assertCurrent(v.binding, expected[i]));
        const owned = new Set();
        for (const v of next)
            for (const id of v.occupiedIds) {
                if (owned.has(id))
                    throw new Error('Duplicate current terrain/fragment source ownership');
                owned.add(id);
            }
        const old = this.#current;
        this.#current = next.slice();
        old.filter(v => !next.includes(v)).forEach(v => v.dispose());
    }
    reset() { this.#current.forEach(v => v.dispose()); this.#current = []; this.#epoch++; }
}
export async function prepareDirty(current, nextVolume, currentBinding, nextBinding, dirtyPages, signal) {
    assertCurrent(current.binding, currentBinding);
    const candidate = await createSparseVolume(nextVolume, nextBinding, signal);
    try {
        assertCurrent(current.binding, currentBinding);
        for (const k of ['domain', 'world', 'session', 'epoch', 'owner', 'frame', 'originEpoch', 'transformGeneration', 'materialDigest'])
            if (currentBinding[k] !== nextBinding[k])
                throw new Error('Dirty update crossed owner/frame/session boundary');
        if (nextBinding.sourceGeneration <= currentBinding.sourceGeneration || nextBinding.sourceRevision <= currentBinding.sourceRevision)
            throw new Error('Dirty update requires newer source generation/revision');
        if (current.size.some((n, i) => n !== candidate.size[i]) || JSON.stringify(current.spatial) !== JSON.stringify(candidate.spatial))
            throw new Error('Dirty update changed coverage topology or transform');
        const size = current.size, ps = size.map(n => Math.ceil(n / 8)), changed = new Set();
        for (let z = 0; z < size[2]; z++)
            for (let y = 0; y < size[1]; y++)
                for (let x = 0; x < size[0]; x++) {
                    const c = [x, y, z];
                    if (current.slot(c) !== candidate.slot(c))
                        changed.add(index(c.map(n => Math.floor(n / 8)), ps));
                }
        if (new Set(dirtyPages).size !== dirtyPages.length || dirtyPages.some(n => !Number.isSafeInteger(n) || n < 0 || n >= ps.reduce((a, b) => a * b, 1)))
            throw new Error('Invalid dirty-page list');
        const sorted = [...changed].sort((a, b) => a - b);
        if (JSON.stringify(sorted) !== JSON.stringify([...dirtyPages].sort((a, b) => a - b)))
            throw new Error('Dirty pages do not match actual changed voxel bytes');
        const oldBytes = current.residency('two-level', 4).perGenerationBytes, newBytes = candidate.residency('two-level', 4).perGenerationBytes;
        const peak = Object.freeze({ currentGenerationBytes: oldBytes, nextGenerationBytes: newBytes, oldNewGenerationsBytes: oldBytes + newBytes, historyBytes: 0, peakBytes: oldBytes + newBytes });
        const atlasRepack = true;
        return Object.freeze({ candidate, sourceBinding: candidate.binding, dirtyPages: Object.freeze(sorted), atlasRepack,
            uploadStrategy: 'private next-generation atlas and tables; atomic swap only after current-binding adoption; compact offsets may change',
            peak });
    }
    catch (e) {
        candidate.dispose();
        throw e;
    }
}
