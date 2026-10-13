import { assertCurrent } from "../imported/rt01/src/validate.mjs";
const f = Math.fround, minimumNormal = 2 ** -126;
const owner = (q, d) => Math.floor(q) - (d < 0 && Number.isInteger(q) ? 1 : 0);
const outside = (o, d, size) => o.some((q, a) => q === 0 ? d[a] < 0 : q === size[a] ? d[a] >= 0 : q < 0 || q > size[a]);
export function sourcePrefixCertificate(s, ray, binding, packed, index = 0) {
    assertCurrent(s.binding, binding);
    if (!Number.isSafeInteger(index) || index < 0)
        throw new RangeError('Packed row index');
    const v = new DataView(packed, index * 48, 48), o = [0, 4, 8].map(a => v.getFloat32(a, true)), d = [16, 20, 24].map(a => v.getFloat32(a, true)), radius = v.getFloat32(12, true), steps = v.getUint32(32, true);
    const local = s.localRay(ray), frame = s.spatial, size = s.size;
    const originalO = local.origin.map((q, a) => (q - frame.origin[a]) / frame.cellMeters), originalD = local.direction.map(q => q / frame.cellMeters);
    const unproved = (reason) => ({ status: 'UNPROVEN', reason, branch: null, result: null });
    if (o.some((q, a) => !Object.is(q, f(originalO[a]))) || d.some((q, a) => !Object.is(q, f(originalD[a]))) ||
        radius !== f(ray.maxDistance) || steps !== ray.maxSteps || ![0, 1].includes(v.getUint32(36, true)) ||
        [28, 40, 44].some(a => v.getUint32(a, true) !== 0))
        throw new Error('Actual48-byte row/binding mismatch');
    if (radius !== ray.maxDistance)
        return unproved('HORIZON_PACKING_CHANGED');
    if ([...o, ...d, radius].some(q => q !== 0 && Math.abs(q) < minimumNormal))
        return unproved('SUBNORMAL_FTZ_MODEL_UNPROVEN');
    if (d.some((q, a) => (q === 0) !== (originalD[a] === 0) || Math.sign(q) !== Math.sign(originalD[a])))
        return unproved('DIRECTION_ZERO_OR_SIGN_CHANGED');
    // CPU near-boundary snapping is bounded by one-millionth of a grid cell.
    if (originalO.some(q => Math.abs(q - Math.round(q)) <= 1e-6))
        return unproved('ORIGINAL_NEAR_FACE_POLICY_UNPROVEN');
    const isOutside = outside(o, d, size), originalOutside = outside(originalO, originalD, size);
    const noLine = d.some((q, a) => q === 0 && (o[a] < 0 || o[a] >= size[a]));
    const originalNoLine = originalD.some((q, a) => q === 0 && (originalO[a] < 0 || originalO[a] >= size[a]));
    if (isOutside !== originalOutside || noLine !== originalNoLine)
        return unproved('INITIAL_BOUND_CLASSIFICATION_CHANGED');
    const proof = (branch, result, margin) => ({
        status: 'PROVED_SOURCE_PREFIX_UNDER_RNE_MODEL', reason: null, branch, result, margin,
        iterationsUpperBound: 1, admission: false, gpuQualified: false
    });
    if (frame.exteriorCoverage === 'Unknown' && isOutside)
        return proof('OUTSIDE_UNKNOWN', s.hitResult('Unknown', null, 0, [0, 0, 0]), null);
    if (noLine)
        return proof('ZERO_AXIS_NO_LINE_MISS', s.hitResult('Miss', null, radius, [0, 0, 0]), null);
    if (isOutside)
        return unproved('ENTRY_AND_SKIP_RECOMPOSITION_UNPROVEN');
    const cell = [owner(o[0], d[0]), owner(o[1], d[1]), owner(o[2], d[2])];
    if (cell.some((q, a) => q < 0 || q >= size[a]))
        return unproved('INITIAL_CELL_OUTSIDE');
    if (cell.some((q, a) => q !== owner(originalO[a], originalD[a])))
        return unproved('INITIAL_OWNER_CHANGED');
    const slot = s.slot(cell);
    if (steps > 0 && slot === 0)
        return unproved('NONCONSTANT_TRAVERSAL_PROGRESS_UNPROVEN');
    // Only the first interval is evaluated: no replacement traversal or renderer.
    const next = d.map((q, a) => q === 0 ? f(1e30) : f(f(cell[a] + (q > 0 ? 1 : 0) - o[a]) / q));
    const exits = d.map((q, a) => q === 0 ? f(1e30) : q > 0 ? f(f(size[a] - o[a]) / q) : f(-o[a] / q));
    const end = Math.min(radius, ...exits), crossing = Math.min(...next), width = Math.min(end, crossing);
    const epsilon = f(f(1e-10) * Math.max(1, Math.abs(width)));
    if (!Number.isFinite(width) || width <= 0 || width <= epsilon * 2)
        return unproved('FIRST_POSITIVE_INTERVAL_MARGIN_UNPROVEN');
    const kind = steps === 0 ? 'BudgetExceeded' : slot === -1 ? 'Unknown' : 'Hit';
    return proof('INITIAL_LEAF_' + kind.toUpperCase(), s.hitResult(kind, cell, 0, [0, 0, 0]), width - epsilon);
}
