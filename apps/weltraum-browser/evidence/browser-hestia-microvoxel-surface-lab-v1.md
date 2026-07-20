# Browser Hestia Microvoxel Surface Lab V1 — Live Evidence

- Status: **PASS**
- Generated: 2026-07-16T06:01:10.268Z
- Route: `/?surfaceLab=1`
- Generator: `apps/weltraum-browser/tests/e2e/hestia-microvoxel-surface-lab.spec.ts`
- TestBridge absent: `true`
- Backend canvas count: `1`
- Readiness bound: `120000 ms` per generation

## Measured runtime facts

| Run | Seed | Voxel m | Extent | Ready/requested/failed | Queue/running | Vertices | Triangles | Mesh bytes | Generation ms | Meshing ms | Upload ms | Frame ms (settled samples) | Cache hit/miss/bypass | Stale/restarts | Readiness ms |
| --- | --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | ---: |
| initialDefault | hestia-surface-lab-v1 | 0.5 | 64x32x64 | 16/16/0 | 0/0 | 114036 | 38012 | 2964936 | 18089.099999904633 | 1416.7999999523163 | 297.4999997615814 | 17.22233333333333 (300) | 0/16/0 | 0/0 | 10107 |
| sameSeedCacheBypass | hestia-surface-lab-v1 | 0.5 | 64x32x64 | 16/16/0 | 0/0 | 114036 | 38012 | 2964936 | 18670.599999427795 | 698.7000000476837 | 279.30000042915344 | 16.888666666666662 (300) | 0/0/16 | 0/0 | 10475 |
| changedSeed | hestia-surface-lab-v1-e2e-alt | 0.5 | 64x32x64 | 16/16/0 | 0/0 | 115194 | 38398 | 2995044 | 19360.599999666214 | 660.1000001430511 | 280.30000042915344 | 17.222333333333335 (300) | 0/0/16 | 0/0 | 10542 |
| afterCameraAndPresentationControls | hestia-surface-lab-v1-e2e-alt | 0.5 | 64x32x64 | 16/16/0 | 0/0 | 115194 | 38398 | 2995044 | 19360.599999666214 | 660.1000001430511 | 280.30000042915344 | 17.110999999999997 (300) | 0/0/16 | 0/0 | n/a |
| quarterMeter | hestia-surface-lab-v1-e2e-alt | 0.25 | 32x16x32 | 16/16/0 | 0/0 | 113082 | 37694 | 2940132 | 17679.599999904633 | 555.2999999523163 | 248.30000019073486 | 17.22233333333335 (300) | 0/16/0 | 0/0 | 10065 |

### Initial default

- Brick hashes (ordered): `fnv1a64:0375478ce2549fc2`, `fnv1a64:081dedc5972ac1d1`, `fnv1a64:120de93b87290415`, `fnv1a64:1d3ae796ad129fec`, `fnv1a64:31f157a9d04c803a`, `fnv1a64:35884a4234c4edcf`, `fnv1a64:3f658b44de9432dd`, `fnv1a64:3fe76b82c6336b66`, `fnv1a64:408c80ee230178cb`, `fnv1a64:59e0b4d9ec807adc`, `fnv1a64:6519114ed3347b4e`, `fnv1a64:7473578a16aec865`, `fnv1a64:766a3db16a3ff9cb`, `fnv1a64:94192a572287300c`, `fnv1a64:cd4bccc91b193870`, `fnv1a64:d7aa2f32b280a4e8`
- Mesh hashes (ordered): `fnv1a64:1477953ae5cd7577`, `fnv1a64:190974e7e5c73d66`, `fnv1a64:2282d36373501375`, `fnv1a64:78a529de91cd6c45`, `fnv1a64:7d811ece7292d14c`, `fnv1a64:838358fd9cc6493a`, `fnv1a64:86e028563e7152bd`, `fnv1a64:8809d6f5ff59ce6b`, `fnv1a64:8c6663b717de43f8`, `fnv1a64:8cbd6cfa5c48e91e`, `fnv1a64:9ab657d8e15f561a`, `fnv1a64:bbd7f1218818c0c5`, `fnv1a64:c61202d1195029c9`, `fnv1a64:cada71a7f69d391b`, `fnv1a64:e45cee86e008a639`, `fnv1a64:f0cb45aae2155567`

### Explicit same-seed cache-bypass regeneration

- Brick hashes (ordered): `fnv1a64:0375478ce2549fc2`, `fnv1a64:081dedc5972ac1d1`, `fnv1a64:120de93b87290415`, `fnv1a64:1d3ae796ad129fec`, `fnv1a64:31f157a9d04c803a`, `fnv1a64:35884a4234c4edcf`, `fnv1a64:3f658b44de9432dd`, `fnv1a64:3fe76b82c6336b66`, `fnv1a64:408c80ee230178cb`, `fnv1a64:59e0b4d9ec807adc`, `fnv1a64:6519114ed3347b4e`, `fnv1a64:7473578a16aec865`, `fnv1a64:766a3db16a3ff9cb`, `fnv1a64:94192a572287300c`, `fnv1a64:cd4bccc91b193870`, `fnv1a64:d7aa2f32b280a4e8`
- Mesh hashes (ordered): `fnv1a64:1477953ae5cd7577`, `fnv1a64:190974e7e5c73d66`, `fnv1a64:2282d36373501375`, `fnv1a64:78a529de91cd6c45`, `fnv1a64:7d811ece7292d14c`, `fnv1a64:838358fd9cc6493a`, `fnv1a64:86e028563e7152bd`, `fnv1a64:8809d6f5ff59ce6b`, `fnv1a64:8c6663b717de43f8`, `fnv1a64:8cbd6cfa5c48e91e`, `fnv1a64:9ab657d8e15f561a`, `fnv1a64:bbd7f1218818c0c5`, `fnv1a64:c61202d1195029c9`, `fnv1a64:cada71a7f69d391b`, `fnv1a64:e45cee86e008a639`, `fnv1a64:f0cb45aae2155567`

### Changed seed

- Brick hashes (ordered): `fnv1a64:05e35ec81b2119f9`, `fnv1a64:05fe894a7b8bc638`, `fnv1a64:19dc66e54c7dc040`, `fnv1a64:201fbdf1c26ecabf`, `fnv1a64:288250e8d17e60a5`, `fnv1a64:2af59a259a591519`, `fnv1a64:3d67f3956580c953`, `fnv1a64:6525a6c1f4e46841`, `fnv1a64:84446580d06cfd43`, `fnv1a64:a8b3b13f78df6bfb`, `fnv1a64:b53cc04cccb566f7`, `fnv1a64:c67cf076e5ee318b`, `fnv1a64:dad303c5b215d93a`, `fnv1a64:de8efb1d0124e2f1`, `fnv1a64:fa24ea1c3d9b13aa`, `fnv1a64:fbc3a8bad3c773b3`
- Mesh hashes (ordered): `fnv1a64:139501bab5aa5d08`, `fnv1a64:25034414ec019afd`, `fnv1a64:3df4657fb080eee9`, `fnv1a64:7516fd4f08b0a94d`, `fnv1a64:787a50d2bc9d61f5`, `fnv1a64:82e7c7a355b1deba`, `fnv1a64:8452c8dcde6b6ac3`, `fnv1a64:89d2ac1c955f9535`, `fnv1a64:8a21fb6ab5ee05c8`, `fnv1a64:8b4776a0df85db9f`, `fnv1a64:8f4041c8dbf75ce4`, `fnv1a64:9142f27eba096dd5`, `fnv1a64:9144291ae681037e`, `fnv1a64:a9a3ce556eee9aec`, `fnv1a64:b9f529d9745021e9`, `fnv1a64:e307aee9b8abf552`

### Quarter-meter

- Brick hashes (ordered): `fnv1a64:0087ef5a6b5d6044`, `fnv1a64:043e954b10f09bb0`, `fnv1a64:04f2030860ece2ae`, `fnv1a64:07c604bec4db9af2`, `fnv1a64:0a630ab31efc6842`, `fnv1a64:29c21dfdae840e85`, `fnv1a64:5499cb86ca99b6ba`, `fnv1a64:6510b1828c658c14`, `fnv1a64:6b3cf70dfc7b8949`, `fnv1a64:7be5d0d4562b723c`, `fnv1a64:9944dface7eae2c6`, `fnv1a64:a47b3f18c343e71b`, `fnv1a64:b0a99a24518b8236`, `fnv1a64:e0f50c23a2445685`, `fnv1a64:e74f65366af30114`, `fnv1a64:f90231d99b281a4e`
- Mesh hashes (ordered): `fnv1a64:083129252b7f463f`, `fnv1a64:11268d6a04293e6f`, `fnv1a64:124021e2750b154b`, `fnv1a64:3df74c13db075685`, `fnv1a64:63d30131628b7007`, `fnv1a64:74f14b4d22717313`, `fnv1a64:8193a345fbb2a358`, `fnv1a64:9a1f65a98bdfff46`, `fnv1a64:aba54b0504d768cb`, `fnv1a64:cebb8a1d9606cd8c`, `fnv1a64:d14e042714d13249`, `fnv1a64:d5280c064e38f815`, `fnv1a64:dd8bc6bd4b962f2a`, `fnv1a64:de00cf7358d2dd3b`, `fnv1a64:e73334966a54741e`, `fnv1a64:fcf7380229f1b6c1`

## Determinism and visible controls

- Explicit regenerate used the same seed and cache bypass, producing identical ordered brick and mesh hash sets.
- Visible seed editing plus Regenerate produced valid different ordered brick and mesh hash sets.
- Fly mode plus real keyboard W input changed camera position from `46.0000, 34.0000, 52.0000` to `41.2922, 30.1110, 46.6782`.
- Orbit pointer input changed camera quaternion from `-0.231722, 0.343214, 0.087783, 0.905982` to `-0.351655, 0.127793, 0.048525, 0.926095`.
- Wireframe and chunk-boundary controls were enabled through visible buttons and preserved canonical hashes.
- The visible 0.25 m selector settled at `32x16x32` (default `64x32x64`).

## Browser health and technical screenshots

- Console errors: `0`
- Page errors: `0`
- Failed requests: `0`
- HTTP >=400 responses: `0`
- Console warnings (recorded, not normalized away): `4`
- Known Rajdhani/OTS warnings: `Failed to decode downloaded font: http://127.0.0.1:5173/fonts/rajdhani/Rajdhani-Regular.ttf @ http://127.0.0.1:5173/?surfaceLab=1:0:0`; `OTS parsing error: invalid sfntVersion: 1986359923 @ http://127.0.0.1:5173/?surfaceLab=1:0:0`; `Failed to decode downloaded font: http://127.0.0.1:5173/fonts/rajdhani/Rajdhani-SemiBold.ttf @ http://127.0.0.1:5173/?surfaceLab=1:0:0`; `OTS parsing error: invalid sfntVersion: 1986359923 @ http://127.0.0.1:5173/?surfaceLab=1:0:0`
- Unexpected warnings: none
- default: `apps/weltraum-browser/evidence/hestia-surface-lab-default-1920x1080.png` — 1920x1080
- wireframe-and-boundaries: `apps/weltraum-browser/evidence/hestia-surface-lab-wireframe-1920x1080.png` — 1920x1080
- quarter-meter: `apps/weltraum-browser/evidence/hestia-surface-lab-quarter-meter-1920x1080.png` — 1920x1080

## Explicit visual-fidelity boundary

Visual fidelity is **deferred and known-failing**. These captures are technical runtime evidence only; they do not assert concept parity, pixel parity, acceptable final art direction, or visual acceptance. Follow-up owner: `browser-hestia-surface-lab-visual-fidelity-v1`.
