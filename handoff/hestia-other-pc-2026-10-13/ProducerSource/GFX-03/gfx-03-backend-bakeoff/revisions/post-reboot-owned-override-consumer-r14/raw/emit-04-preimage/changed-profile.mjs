/** Existing Bridge consumer, prepared for the sole Runner. Not executed here. */
export async function runChangedProfile(b) {
    const checks = [], captures = [];
    const check = (name, ok, detail) => checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
    for (const variant of ['historical-webgl', 'current-webgl', 'current-webgpu']) {
        const mounted = await b.mount(variant);
        check(`${variant}/actual-backend`, mounted.status === 'PASS' && mounted.actualBackend === (variant === 'current-webgpu' ? 'WebGPU' : 'WebGL2'), mounted);
        if (mounted.status !== 'PASS')
            continue;
        await b.setScene('alpha-wind');
        await b.setTick(120);
        const visible = await b.capture(), linear = await b.captureLinearTarget(), depth = await b.captureDepthPreview();
        captures.push({ variant, kind: 'beauty', visible, linear, depth });
        check(`${variant}/actual-half-float-bytes`, linear.type === 'HalfFloatType' && linear.bytes.length === (linear.height - 1) * linear.rowPitchBytes + linear.width * 8, linear);
        check(`${variant}/depth-is-preview`, depth.rawDepth === false && depth.pixels.length === depth.width * depth.height * 4, { encoding: depth.encoding });
        if (variant === 'current-webgpu') {
            for (const kind of ['coverage', 'geometric-normal']) {
                await b.setAttachmentMode(kind);
                const image = await b.capture(), raw = await b.captureLinearTarget();
                captures.push({ variant, kind, image, raw });
                const stats = b.facts().overrideLease;
                check(`${kind}/owned-hook-forwarded-restored`, stats && !stats.failed && stats.bindings > 0 && stats.bindings === stats.restores, stats);
            }
            await b.setAttachmentMode('beauty');
        }
        const expected = b.facts().owner;
        await b.transferOwner(expected);
        let stale = false;
        try {
            await b.transferOwner(expected);
        }
        catch {
            stale = true;
        }
        check(`${variant}/stale-owner-rejected`, stale, expected);
        const moved = await b.capture();
        await b.setTick(180);
        const wind = await b.capture();
        check(`${variant}/owner-visible`, visible.sha256 !== moved.sha256, { before: visible.sha256, after: moved.sha256 });
        check(`${variant}/wind-visible`, moved.sha256 !== wind.sha256, { tick120: moved.sha256, tick180: wind.sha256 });
        await b.dispose();
        check(`${variant}/own-lifecycle`, b.facts().liveRenderers === 0 && b.facts().liveLoops === 0 && b.facts().liveShadowTargets === 0, b.facts());
    }
    return { schema: 'hestia.gfx03.a69.changed-profile.v1', environment: 'DIAGNOSTIC_NOT_REFERENCE', checks, captures,
        result: checks.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL', qualifiedPerformance: 'NOT_RUN', referenceAcceptance: 'NOT_RUN',
        scalarBoundaryShaderProof: 'NOT_RUN', shadowPixelProof: 'NOT_RUN', temporalFrameOwner: 'MISSING', productAdoption: 'NO' };
}
