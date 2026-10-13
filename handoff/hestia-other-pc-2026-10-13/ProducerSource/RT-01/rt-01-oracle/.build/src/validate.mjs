export function validateRay(ray) {
    if (!ray.id || ray.origin.length !== 3 || ray.direction.length !== 3
        || ![...ray.origin, ...ray.direction, ray.maxDistance].every(Number.isFinite)
        || ray.maxDistance <= 0 || Math.abs(Math.hypot(...ray.direction) - 1) > 1e-9
        || !Number.isSafeInteger(ray.maxSteps) || ray.maxSteps < 0) {
        throw new RangeError('Invalid bounded normalized ray');
    }
}
export function validateVolume(v) {
    const count = v.size.reduce((a, b) => a * b, 1);
    if (v.size.length !== 3 || v.origin.length !== 3 || v.translation.length !== 3 || v.rotation.length !== 9
        || !v.size.every(n => Number.isSafeInteger(n) && n > 0 && n <= 64)
        || ![...v.origin, ...v.rotation, ...v.translation].every(Number.isFinite)
        || ![0.125, 0.25].includes(v.cellMeters) || v.cells.length !== count || v.cellIds.length !== count
        || v.authorityLeafEdge !== 16 || !Number.isSafeInteger(v.rayPageEdge) || v.rayPageEdge <= 0
        || !['complete', 'partial'].includes(v.coverage)
        || !['KnownEmpty', 'Unknown'].includes(v.exteriorCoverage)
        || !['ANALYTICAL', 'RD_SYNTHETIC', 'PRODUCT_EXPORT'].includes(v.provenance)) {
        throw new RangeError('Invalid compact fixture layout');
    }
    const materialIds = new Set(v.materials.map(m => m.id));
    if (materialIds.size !== v.materials.length || v.materials.some(m => !Number.isSafeInteger(m.id) || m.id <= 0 || !m.role || !m.source)
        || v.cells.some(n => !Number.isSafeInteger(n) || n < -1 || (n > 0 && !materialIds.has(n)))
        || (v.coverage === 'complete' && v.cells.includes(-1))) {
        throw new RangeError('Invalid material or coverage payload');
    }
    if (['domain', 'world', 'session', 'epoch', 'owner', 'frame', 'algorithm'].some(key => typeof v.binding[key] !== 'string' || v.binding[key] === '')
        || ['sourceRevision', 'sourceGeneration', 'originEpoch', 'transformGeneration'].some(key => !Number.isSafeInteger(v.binding[key]) || Number(v.binding[key]) < 0)
        || !/^[a-f0-9]{64}$/.test(v.binding.sourceDigest) || !/^[a-f0-9]{64}$/.test(v.binding.materialDigest)) {
        throw new RangeError('Invalid source binding');
    }
    for (let a = 0; a < 3; a++)
        for (let b = 0; b < 3; b++) {
            let dot = 0;
            for (let i = 0; i < 3; i++)
                dot += v.rotation[i * 3 + a] * v.rotation[i * 3 + b];
            if (Math.abs(dot - Number(a === b)) > 1e-9)
                throw new RangeError('Frame rotation must be orthonormal');
        }
    const r = v.rotation;
    const det = r[0] * (r[4] * r[8] - r[5] * r[7]) - r[1] * (r[3] * r[8] - r[5] * r[6]) + r[2] * (r[3] * r[7] - r[4] * r[6]);
    if (Math.abs(det - 1) > 1e-9)
        throw new RangeError('Frame rotation must be proper');
}
/** The caller supplies its current binding, never a key from a delayed projection. */
export function assertCurrent(actual, expected) {
    const keys = ['domain', 'world', 'session', 'epoch', 'owner', 'sourceRevision', 'sourceGeneration',
        'sourceDigest', 'frame', 'originEpoch', 'transformGeneration', 'materialDigest', 'algorithm'];
    if (keys.some(key => actual[key] === undefined || actual[key] === null || actual[key] === ''
        || actual[key] !== expected[key]))
        throw new Error('Stale projection binding');
}
export function assertExclusiveOwners(volumes) {
    const owned = new Set();
    for (const volume of volumes) {
        validateVolume(volume);
        volume.cells.forEach((slot, index) => {
            if (slot <= 0)
                return;
            const id = volume.cellIds[index];
            if (!id || owned.has(id))
                throw new Error('Occupied source cell has duplicate current ownership');
            owned.add(id);
        });
    }
}
