export function packRays(s, rays, strict) {
    if (new Set(rays.map(r => r.id)).size !== rays.length)
        throw new Error('Duplicate ray identity');
    const data = new ArrayBuffer(rays.length * 48), view = new DataView(data), frame = s.spatial;
    rays.forEach((ray, i) => {
        if (ray.maxSteps > 0xffffffff)
            throw new RangeError('GPU maxSteps must fit u32');
        const local = s.localRay(ray), o = local.origin.map((n, a) => (n - frame.origin[a]) / frame.cellMeters), d = local.direction.map(n => n / frame.cellMeters);
        // shortcut: finite local volume rays only; preclip farther rays in an owner-bound f64 port before extending this GPU contract.
        if ([...o, ...d, ray.maxDistance].some(n => !Number.isFinite(n) || Math.abs(n) > 65536))
            throw new RangeError('GPU relative-frame precision envelope exceeded');
        o.forEach((n, a) => view.setFloat32(i * 48 + a * 4, n, true));
        view.setFloat32(i * 48 + 12, ray.maxDistance, true);
        d.forEach((n, a) => view.setFloat32(i * 48 + 16 + a * 4, n, true));
        view.setUint32(i * 48 + 32, ray.maxSteps, true);
        view.setUint32(i * 48 + 36, Number(strict), true);
    });
    return data;
}
