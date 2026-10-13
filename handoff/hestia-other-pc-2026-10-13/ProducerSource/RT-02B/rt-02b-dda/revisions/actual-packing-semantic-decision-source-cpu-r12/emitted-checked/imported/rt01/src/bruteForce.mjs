import { validateRay, validateVolume } from "./validate.mjs";
function timeTolerance(a, b) {
    return 1e-10 * Math.max(1, Number.isFinite(a) ? Math.abs(a) : 0, Number.isFinite(b) ? Math.abs(b) : 0);
}
function sameTime(a, b) {
    return Math.abs(a - b) <= timeTolerance(a, b);
}
function nearBoundary(value, bound, min, max) {
    const roundoff = Number.EPSILON * 8 * Math.max(1, Math.abs(value), Math.abs(bound));
    return Math.abs(value - bound) <= Math.min(roundoff, (max - min) * 1e-6);
}
function insideOwnedBounds(origin, direction, min, max) {
    if (direction === 0) {
        if (origin >= max || nearBoundary(origin, max, min, max))
            return false;
        return origin > min || nearBoundary(origin, min, min, max);
    }
    if (nearBoundary(origin, min, min, max))
        return direction > 0;
    if (nearBoundary(origin, max, min, max))
        return direction < 0;
    return origin > min && origin < max;
}
function toLocalPoint(volume, world) {
    const x = world[0] - volume.translation[0];
    const y = world[1] - volume.translation[1];
    const z = world[2] - volume.translation[2];
    const r = volume.rotation;
    return [r[0] * x + r[3] * y + r[6] * z, r[1] * x + r[4] * y + r[7] * z, r[2] * x + r[5] * y + r[8] * z];
}
function toLocalDirection(volume, world) {
    const r = volume.rotation;
    return [r[0] * world[0] + r[3] * world[1] + r[6] * world[2], r[1] * world[0] + r[4] * world[1] + r[7] * world[2], r[2] * world[0] + r[5] * world[1] + r[8] * world[2]];
}
function toWorldNormal(volume, local) {
    const r = volume.rotation;
    return [r[0] * local[0] + r[1] * local[1] + r[2] * local[2], r[3] * local[0] + r[4] * local[1] + r[5] * local[2], r[6] * local[0] + r[7] * local[1] + r[8] * local[2]];
}
function intersectCell(volume, origin, direction, min, max, maxDistance) {
    const nearTimes = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
    const farTimes = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    const startsInside = min.every((edge, axis) => insideOwnedBounds(origin[axis], direction[axis], edge, max[axis]));
    for (let axis = 0; axis < 3; axis++) {
        const o = origin[axis];
        const d = direction[axis];
        if (d === 0) {
            if (!insideOwnedBounds(o, d, min[axis], max[axis]))
                return null;
            continue;
        }
        const a = (min[axis] - o) / d;
        const b = (max[axis] - o) / d;
        nearTimes[axis] = Math.min(a, b);
        farTimes[axis] = Math.max(a, b);
    }
    const rawEntry = Math.max(...nearTimes);
    const rawExit = Math.min(...farTimes);
    const entry = startsInside ? 0 : Math.max(0, rawEntry);
    const exit = Math.min(maxDistance, rawExit);
    if (entry >= maxDistance || exit - entry <= timeTolerance(entry, exit))
        return null;
    if (startsInside)
        return { entry, exit, normal: [0, 0, 0] };
    const entryAxis = nearTimes.findIndex(t => sameTime(t, rawEntry));
    const localNormal = [0, 0, 0];
    localNormal[entryAxis] = direction[entryAxis] > 0 ? -1 : 1;
    return { entry, exit, normal: toWorldNormal(volume, localNormal) };
}
export function traceBruteForce(volume, ray) {
    validateVolume(volume);
    validateRay(ray);
    const min = [...volume.origin];
    const max = volume.size.map((size, axis) => min[axis] + size * volume.cellMeters);
    if (max.some((edge, axis) => !Number.isFinite(edge) || edge <= min[axis]))
        throw new RangeError('Volume bounds are not representable');
    const localOrigin = toLocalPoint(volume, ray.origin);
    const localDirection = toLocalDirection(volume, ray.direction);
    if (![...localOrigin, ...localDirection].every(Number.isFinite))
        throw new RangeError('Ray frame transform is not finite');
    const startsInsideVolume = min.every((edge, axis) => insideOwnedBounds(localOrigin[axis], localDirection[axis], edge, max[axis]));
    const revisions = {
        owner: volume.binding.owner,
        sourceRevision: volume.binding.sourceRevision,
        sourceGeneration: volume.binding.sourceGeneration,
        transformGeneration: volume.binding.transformGeneration,
        originEpoch: volume.binding.originEpoch,
    };
    if (volume.exteriorCoverage === 'Unknown' && !startsInsideVolume) {
        return { kind: 'Unknown', distance: 0, normal: [0, 0, 0], cell: null, materialId: null, materialSource: null, cellId: null, ...revisions };
    }
    const intervals = [];
    const [sizeX, sizeY, sizeZ] = volume.size;
    for (let z = 0; z < sizeZ; z++)
        for (let y = 0; y < sizeY; y++)
            for (let x = 0; x < sizeX; x++) {
                const cell = [x, y, z];
                const index = x + sizeX * (y + sizeY * z);
                const cellMin = [min[0] + x * volume.cellMeters, min[1] + y * volume.cellMeters, min[2] + z * volume.cellMeters];
                const cellMax = cellMin.map(edge => edge + volume.cellMeters);
                const interval = intersectCell(volume, localOrigin, localDirection, cellMin, cellMax, ray.maxDistance);
                if (interval)
                    intervals.push({ ...interval, cell, index });
            }
    intervals.sort((a, b) => a.entry - b.entry || a.cell[0] - b.cell[0] || a.cell[1] - b.cell[1] || a.cell[2] - b.cell[2]);
    let visited = 0;
    for (const interval of intervals) {
        const cellId = volume.cellIds[interval.index];
        if (visited >= ray.maxSteps) {
            return { kind: 'BudgetExceeded', distance: interval.entry, normal: interval.normal, cell: interval.cell, materialId: null, materialSource: null, cellId, ...revisions };
        }
        visited++;
        const slot = volume.cells[interval.index];
        if (slot === -1) {
            return { kind: 'Unknown', distance: interval.entry, normal: interval.normal, cell: interval.cell, materialId: null, materialSource: null, cellId, ...revisions };
        }
        if (slot > 0) {
            const material = volume.materials.find(candidate => candidate.id === slot);
            return { kind: 'Hit', distance: interval.entry, normal: interval.normal, cell: interval.cell, materialId: slot, materialSource: material.source, cellId, ...revisions };
        }
    }
    if (volume.exteriorCoverage === 'Unknown' && startsInsideVolume) {
        let volumeExit = Number.POSITIVE_INFINITY;
        for (let axis = 0; axis < 3; axis++) {
            const d = localDirection[axis];
            if (d > 0)
                volumeExit = Math.min(volumeExit, (max[axis] - localOrigin[axis]) / d);
            else if (d < 0)
                volumeExit = Math.min(volumeExit, (min[axis] - localOrigin[axis]) / d);
        }
        if (volumeExit < ray.maxDistance - timeTolerance(volumeExit, ray.maxDistance)) {
            return { kind: 'Unknown', distance: volumeExit, normal: [0, 0, 0], cell: null, materialId: null, materialSource: null, cellId: null, ...revisions };
        }
    }
    return { kind: 'Miss', distance: ray.maxDistance, normal: [0, 0, 0], cell: null, materialId: null, materialSource: null, cellId: null, owner: null, sourceRevision: null, sourceGeneration: null, transformGeneration: null, originEpoch: null };
}
