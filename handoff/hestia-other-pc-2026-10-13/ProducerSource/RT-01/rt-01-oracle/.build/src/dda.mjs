import { validateRay, validateVolume } from './validate.mjs';
/** Bound adaptation of fixed-base terrain/picking.ts; no product contract change. */
export function traceDda(v, ray) {
    validateVolume(v);
    validateRay(ray);
    const inverse = (p) => [0, 1, 2].map(a => v.rotation[a] * p[0] + v.rotation[3 + a] * p[1] + v.rotation[6 + a] * p[2]);
    const origin = inverse(ray.origin.map((n, a) => n - v.translation[a]));
    const direction = inverse(ray.direction);
    const normalWorld = (n) => [0, 1, 2].map(a => v.rotation[a * 3] * n[0] + v.rotation[a * 3 + 1] * n[1] + v.rotation[a * 3 + 2] * n[2]);
    const miss = () => ({ kind: 'Miss', distance: ray.maxDistance, normal: [0, 0, 0],
        cell: null, materialId: null, materialSource: null, owner: null, cellId: null,
        sourceRevision: null, sourceGeneration: null, transformGeneration: null, originEpoch: null });
    const exteriorUnknown = (distance) => ({ ...miss(), kind: 'Unknown', distance,
        owner: v.binding.owner, sourceRevision: v.binding.sourceRevision, sourceGeneration: v.binding.sourceGeneration,
        transformGeneration: v.binding.transformGeneration, originEpoch: v.binding.originEpoch });
    const startsOutside = origin.some((n, a) => {
        const lo = v.origin[a];
        const hi = lo + v.size[a] * v.cellMeters;
        return n < lo || n > hi || (n === lo && direction[a] < 0) || (n === hi && direction[a] >= 0);
    });
    if (v.exteriorCoverage === 'Unknown' && startsOutside)
        return exteriorUnknown(0);
    const epsilon = (a, b) => 1e-10 * Math.max(1, Math.abs(a), Math.abs(b));
    let entry = -Infinity;
    let exit = Infinity;
    let entryAxis = -1;
    for (let a = 0; a < 3; a++) {
        const lo = v.origin[a];
        const hi = lo + v.size[a] * v.cellMeters;
        const d = direction[a];
        if (d === 0) {
            if (origin[a] < lo || origin[a] >= hi)
                return miss();
            continue;
        }
        const t0 = (lo - origin[a]) / d;
        const t1 = (hi - origin[a]) / d;
        const near = Math.min(t0, t1);
        const far = Math.max(t0, t1);
        if (entryAxis < 0 || near > entry + epsilon(near, entry)) {
            entry = near;
            entryAxis = a;
        }
        exit = Math.min(exit, far);
    }
    let distance = Math.max(0, entry);
    const end = Math.min(exit, ray.maxDistance);
    const ended = () => v.exteriorCoverage === 'Unknown' && exit < ray.maxDistance ? exteriorUnknown(Math.max(0, exit)) : miss();
    if (end - distance <= epsilon(end, distance))
        return miss();
    const step = direction.map(Math.sign);
    const q = origin.map((n, a) => (n + distance * direction[a] - v.origin[a]) / v.cellMeters);
    const cell = q.map((n, a) => {
        const rounded = Math.round(n);
        const value = Math.abs(n - rounded) <= 1e-10 ? rounded : n;
        return Math.floor(value) - (direction[a] < 0 && Number.isInteger(value) ? 1 : 0);
    });
    const delta = direction.map(d => d === 0 ? Infinity : v.cellMeters / Math.abs(d));
    const next = direction.map((d, a) => d === 0 ? Infinity :
        (v.origin[a] + (cell[a] + (step[a] > 0 ? 1 : 0)) * v.cellMeters - origin[a]) / d);
    let normal = [0, 0, 0];
    if (entry > 0)
        normal[entryAxis] = -step[entryAxis];
    let visited = 0;
    while (distance < end) {
        if (cell.some((n, a) => n < 0 || n >= v.size[a]))
            return ended();
        const index = cell[0] + v.size[0] * (cell[1] + v.size[1] * cell[2]);
        const slot = v.cells[index];
        const result = (kind) => ({ kind, distance, normal: normalWorld(normal),
            cell: [...cell], materialId: kind === 'Hit' ? slot : null,
            materialSource: kind === 'Hit' ? v.materials.find(m => m.id === slot).source : null,
            owner: v.binding.owner, cellId: v.cellIds[index], sourceRevision: v.binding.sourceRevision,
            sourceGeneration: v.binding.sourceGeneration, transformGeneration: v.binding.transformGeneration,
            originEpoch: v.binding.originEpoch });
        if (visited >= ray.maxSteps)
            return result('BudgetExceeded');
        visited++;
        if (slot === -1)
            return result('Unknown');
        if (slot > 0)
            return result('Hit');
        const crossing = Math.min(...next);
        if (crossing >= end - epsilon(crossing, end))
            return ended();
        const tied = next.map((n, a) => Number.isFinite(n) && Math.abs(n - crossing) <= epsilon(n, crossing) ? a : -1).filter(a => a >= 0);
        normal = [0, 0, 0];
        normal[tied[0]] = -step[tied[0]];
        for (const a of tied) {
            cell[a] += step[a];
            next[a] += delta[a];
        }
        distance = crossing;
    }
    return ended();
}
