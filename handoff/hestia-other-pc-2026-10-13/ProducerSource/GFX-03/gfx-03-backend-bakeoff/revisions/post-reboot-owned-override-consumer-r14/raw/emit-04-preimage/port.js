import * as T from 'three';
export const FIXTURE_PIN = 'bc6e9be728c932b0fe6f88ea2d6024f61b2b53bc59d47aae0e941c499a34dbea';
export const lightDepthPolicy = Object.freeze({ sun: [-28, 42, -18], sunIntensity: 2.1, ambient: 0.65,
    linearHdr: true, exposure: 1.05, toneMapping: 'ACESFilmic once at final output', waterDepthWrite: false,
    waterStrategy: 'single planar DoubleSide forceSinglePass; opaque depth test; transparent back-to-front sort',
    volumeStrategy: 'bounded transparent single-layer optical candidate; not an ATM volume solver' });
export async function digest(bytes) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), b => b.toString(16).padStart(2, '0')).join('');
}
async function checked(url, sha256, byteLength) {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Fixture unavailable: ${url}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (byteLength !== undefined && bytes.length !== byteLength || await digest(bytes) !== sha256)
        throw new Error(`Fixture drift: ${url}`);
    return bytes;
}
export async function loadPort() {
    const manifestBytes = await checked('./fixtures/manifest.json', FIXTURE_PIN);
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    const load = async (name) => { const ref = manifest.files.find(r => r.path === name); if (!ref)
        throw new Error('Unbound fixture path'); return checked(`./fixtures/${name}`, ref.sha256, ref.byteLength); };
    const fixture = JSON.parse(new TextDecoder().decode(await load('meshes/F00-CONTROL/manifest.json')));
    const cameras = JSON.parse(new TextDecoder().decode(await load('cameras/presets.json')));
    const buffers = new Map();
    for (const ref of fixture.payloads) {
        const bytes = await load(`meshes/F00-CONTROL/${ref.path}`);
        if (bytes.length !== ref.byteLength || await digest(bytes) !== ref.sha256)
            throw new Error('Mesh payload drift');
        const data = bytes.slice().buffer;
        buffers.set(ref.id, ref.elementType === 'float32' ? new Float32Array(data) : new Uint32Array(data));
    }
    return { fixture, camera: cameras.rdCameras.find(c => c.id === 'near'), buffers, policy: lightDepthPolicy };
}
/** Same RD14 stable-ID/tick/owner-local response; only decoration gets this projection. */
export function windInputs(clusterId, tick, stiffness, wind, rotation, reducedMotion = false) {
    if (!clusterId || !Number.isSafeInteger(tick) || tick < 0 || !Number.isFinite(stiffness) || stiffness < 0 || stiffness > 1 ||
        !wind.every(Number.isFinite) || !rotation.every(Number.isFinite) || Math.abs(Math.hypot(...rotation) - 1) > 1e-6)
        throw new Error('Invalid wind inputs');
    let hash = 2166136261;
    for (let i = 0; i < clusterId.length; i++)
        hash = Math.imul(hash ^ clusterId.charCodeAt(i), 16777619);
    const phase = (hash >>> 0) / 0x100000000 * Math.PI * 2 + tick / 60 * 1.8;
    const local = new T.Vector3(...wind).applyQuaternion(new T.Quaternion(...rotation).invert());
    const response = reducedMotion ? 0 : (1 - stiffness) * (0.55 + 0.45 * Math.sin(phase)) * 0.035;
    const clamp = (v) => Math.max(-0.16, Math.min(0.16, v));
    return Object.freeze({ x: response === 0 ? 0 : clamp(local.z * response), z: response === 0 ? 0 : clamp(-local.x * response), phase });
}
export function assertOwner(current, expected) {
    if (current.owner !== expected.owner || current.generation !== expected.generation)
        throw new Error('Stale owner projection');
}
/** Borrowed presentation depth; caller owns no renderer/session and must re-read after epoch change. */
export function createDepthCameraPort(camera, depth, epoch, sourceBinding) {
    if (!Number.isSafeInteger(epoch) || epoch < 0 || !depth.isDepthTexture)
        throw new Error('Invalid presentation port');
    return Object.freeze({ epoch, sourceBinding: Object.freeze({ ...sourceBinding }), depth: depth,
        projection: Object.freeze(camera.projectionMatrix.elements.slice()), view: Object.freeze(camera.matrixWorldInverse.elements.slice()),
        materialProfiles: Object.freeze(['HVP-strata', 'HVP-stationary-water', 'RD14-rough-wet', 'RD14-owner-local-wind']),
        lightDepth: lightDepthPolicy, depthInterpretation: 'native renderer clip convention; WebGPU [0,1], WebGL [-1,1]; opaque-only writers' });
}
