# Surface Lab Generation Input Atomicity V1 — UI Run Summary

- Status: **PASS**
- Route: `/?surfaceLab=1`
- Generator: `apps/weltraum-browser/tests/e2e/hestia-microvoxel-surface-lab.spec.ts`
- Viewport and screenshot contract: `1920x1080`, PNG, `fullPage: false`

These five screenshots demonstrate the reachable **visible UI states** and the
telemetry published with those states. They do not purport to prove internal
pre-admission, post-admission, stale-result suppression, promise/epoch
atomicity, or failure semantics by appearance alone. Those internal paths are
proven by focused unit tests.

The four volatile performance timing values are asserted live before every
capture, but their value glyphs are omitted from retained PNG pixels for byte
reproducibility. The timing labels and rows remain visible, and pixels still do
not prove internal atomicity.

## State mappings

| State | Screenshot | Dimensions | Lifecycle | Seed | Voxel m | Extent | Planning epoch | Requested/ready/failed | Queue/running |
| --- | --- | --- | --- | --- | ---: | --- | ---: | --- | --- |
| initial-default-ready | `.devtoolbox/specs/changes/browser-surface-lab-generation-input-atomicity-v1/tests/screenshots/surface-lab-initial-default-ready-1920x1080.png` | 1920x1080 | Ready | hestia-surface-lab-v1 | 0.5 | 64x32x64 | 1 | 16/16/0 | 0/0
| same-seed-regeneration-ready | `.devtoolbox/specs/changes/browser-surface-lab-generation-input-atomicity-v1/tests/screenshots/surface-lab-same-seed-regeneration-ready-1920x1080.png` | 1920x1080 | Ready | hestia-surface-lab-v1 | 0.5 | 64x32x64 | 2 | 16/16/0 | 0/0
| changed-seed-ready-before-presentation-toggles | `.devtoolbox/specs/changes/browser-surface-lab-generation-input-atomicity-v1/tests/screenshots/surface-lab-changed-seed-ready-before-presentation-toggles-1920x1080.png` | 1920x1080 | Ready | hestia-surface-lab-v1-e2e-alt | 0.5 | 64x32x64 | 3 | 16/16/0 | 0/0
| changed-seed-wireframe-boundaries-camera | `.devtoolbox/specs/changes/browser-surface-lab-generation-input-atomicity-v1/tests/screenshots/surface-lab-changed-seed-wireframe-boundaries-camera-1920x1080.png` | 1920x1080 | Ready | hestia-surface-lab-v1-e2e-alt | 0.5 | 64x32x64 | 3 | 16/16/0 | 0/0
| quarter-meter-ready | `.devtoolbox/specs/changes/browser-surface-lab-generation-input-atomicity-v1/tests/screenshots/surface-lab-quarter-meter-ready-1920x1080.png` | 1920x1080 | Ready | hestia-surface-lab-v1-e2e-alt | 0.25 | 32x16x32 | 4 | 16/16/0 | 0/0

## Hashes and presentation observations

### initial-default-ready

- Brick hashes (ordered): `fnv1a64:0375478ce2549fc2`, `fnv1a64:081dedc5972ac1d1`, `fnv1a64:120de93b87290415`, `fnv1a64:1d3ae796ad129fec`, `fnv1a64:31f157a9d04c803a`, `fnv1a64:35884a4234c4edcf`, `fnv1a64:3f658b44de9432dd`, `fnv1a64:3fe76b82c6336b66`, `fnv1a64:408c80ee230178cb`, `fnv1a64:59e0b4d9ec807adc`, `fnv1a64:6519114ed3347b4e`, `fnv1a64:7473578a16aec865`, `fnv1a64:766a3db16a3ff9cb`, `fnv1a64:94192a572287300c`, `fnv1a64:cd4bccc91b193870`, `fnv1a64:d7aa2f32b280a4e8`
- Mesh hashes (ordered): `fnv1a64:1477953ae5cd7577`, `fnv1a64:190974e7e5c73d66`, `fnv1a64:2282d36373501375`, `fnv1a64:78a529de91cd6c45`, `fnv1a64:7d811ece7292d14c`, `fnv1a64:838358fd9cc6493a`, `fnv1a64:86e028563e7152bd`, `fnv1a64:8809d6f5ff59ce6b`, `fnv1a64:8c6663b717de43f8`, `fnv1a64:8cbd6cfa5c48e91e`, `fnv1a64:9ab657d8e15f561a`, `fnv1a64:bbd7f1218818c0c5`, `fnv1a64:c61202d1195029c9`, `fnv1a64:cada71a7f69d391b`, `fnv1a64:e45cee86e008a639`, `fnv1a64:f0cb45aae2155567`
- Camera/presentation: mode=Orbit, position=`46.0000, 34.0000, 52.0000`, target=`0.0000, -4.0000, 0.0000`, quaternion=`-0.231722, 0.343214, 0.087783, 0.905982`, wireframe=false, boundaries=false

### same-seed-regeneration-ready

- Brick hashes (ordered): `fnv1a64:0375478ce2549fc2`, `fnv1a64:081dedc5972ac1d1`, `fnv1a64:120de93b87290415`, `fnv1a64:1d3ae796ad129fec`, `fnv1a64:31f157a9d04c803a`, `fnv1a64:35884a4234c4edcf`, `fnv1a64:3f658b44de9432dd`, `fnv1a64:3fe76b82c6336b66`, `fnv1a64:408c80ee230178cb`, `fnv1a64:59e0b4d9ec807adc`, `fnv1a64:6519114ed3347b4e`, `fnv1a64:7473578a16aec865`, `fnv1a64:766a3db16a3ff9cb`, `fnv1a64:94192a572287300c`, `fnv1a64:cd4bccc91b193870`, `fnv1a64:d7aa2f32b280a4e8`
- Mesh hashes (ordered): `fnv1a64:1477953ae5cd7577`, `fnv1a64:190974e7e5c73d66`, `fnv1a64:2282d36373501375`, `fnv1a64:78a529de91cd6c45`, `fnv1a64:7d811ece7292d14c`, `fnv1a64:838358fd9cc6493a`, `fnv1a64:86e028563e7152bd`, `fnv1a64:8809d6f5ff59ce6b`, `fnv1a64:8c6663b717de43f8`, `fnv1a64:8cbd6cfa5c48e91e`, `fnv1a64:9ab657d8e15f561a`, `fnv1a64:bbd7f1218818c0c5`, `fnv1a64:c61202d1195029c9`, `fnv1a64:cada71a7f69d391b`, `fnv1a64:e45cee86e008a639`, `fnv1a64:f0cb45aae2155567`
- Camera/presentation: mode=Orbit, position=`46.0000, 34.0000, 52.0000`, target=`0.0000, -4.0000, 0.0000`, quaternion=`-0.231722, 0.343214, 0.087783, 0.905982`, wireframe=false, boundaries=false

### changed-seed-ready-before-presentation-toggles

- Brick hashes (ordered): `fnv1a64:05e35ec81b2119f9`, `fnv1a64:05fe894a7b8bc638`, `fnv1a64:19dc66e54c7dc040`, `fnv1a64:201fbdf1c26ecabf`, `fnv1a64:288250e8d17e60a5`, `fnv1a64:2af59a259a591519`, `fnv1a64:3d67f3956580c953`, `fnv1a64:6525a6c1f4e46841`, `fnv1a64:84446580d06cfd43`, `fnv1a64:a8b3b13f78df6bfb`, `fnv1a64:b53cc04cccb566f7`, `fnv1a64:c67cf076e5ee318b`, `fnv1a64:dad303c5b215d93a`, `fnv1a64:de8efb1d0124e2f1`, `fnv1a64:fa24ea1c3d9b13aa`, `fnv1a64:fbc3a8bad3c773b3`
- Mesh hashes (ordered): `fnv1a64:139501bab5aa5d08`, `fnv1a64:25034414ec019afd`, `fnv1a64:3df4657fb080eee9`, `fnv1a64:7516fd4f08b0a94d`, `fnv1a64:787a50d2bc9d61f5`, `fnv1a64:82e7c7a355b1deba`, `fnv1a64:8452c8dcde6b6ac3`, `fnv1a64:89d2ac1c955f9535`, `fnv1a64:8a21fb6ab5ee05c8`, `fnv1a64:8b4776a0df85db9f`, `fnv1a64:8f4041c8dbf75ce4`, `fnv1a64:9142f27eba096dd5`, `fnv1a64:9144291ae681037e`, `fnv1a64:a9a3ce556eee9aec`, `fnv1a64:b9f529d9745021e9`, `fnv1a64:e307aee9b8abf552`
- Camera/presentation: mode=Orbit, position=`46.0000, 34.0000, 52.0000`, target=`0.0000, -4.0000, 0.0000`, quaternion=`-0.231722, 0.343214, 0.087783, 0.905982`, wireframe=false, boundaries=false

### changed-seed-wireframe-boundaries-camera

- Brick hashes (ordered): `fnv1a64:05e35ec81b2119f9`, `fnv1a64:05fe894a7b8bc638`, `fnv1a64:19dc66e54c7dc040`, `fnv1a64:201fbdf1c26ecabf`, `fnv1a64:288250e8d17e60a5`, `fnv1a64:2af59a259a591519`, `fnv1a64:3d67f3956580c953`, `fnv1a64:6525a6c1f4e46841`, `fnv1a64:84446580d06cfd43`, `fnv1a64:a8b3b13f78df6bfb`, `fnv1a64:b53cc04cccb566f7`, `fnv1a64:c67cf076e5ee318b`, `fnv1a64:dad303c5b215d93a`, `fnv1a64:de8efb1d0124e2f1`, `fnv1a64:fa24ea1c3d9b13aa`, `fnv1a64:fbc3a8bad3c773b3`
- Mesh hashes (ordered): `fnv1a64:139501bab5aa5d08`, `fnv1a64:25034414ec019afd`, `fnv1a64:3df4657fb080eee9`, `fnv1a64:7516fd4f08b0a94d`, `fnv1a64:787a50d2bc9d61f5`, `fnv1a64:82e7c7a355b1deba`, `fnv1a64:8452c8dcde6b6ac3`, `fnv1a64:89d2ac1c955f9535`, `fnv1a64:8a21fb6ab5ee05c8`, `fnv1a64:8b4776a0df85db9f`, `fnv1a64:8f4041c8dbf75ce4`, `fnv1a64:9142f27eba096dd5`, `fnv1a64:9144291ae681037e`, `fnv1a64:a9a3ce556eee9aec`, `fnv1a64:b9f529d9745021e9`, `fnv1a64:e307aee9b8abf552`
- Camera/presentation: mode=Orbit, position=`16.0324, 48.5316, 56.9859`, target=`0.0000, -4.0000, 0.0000`, quaternion=`-0.351655, 0.127793, 0.048525, 0.926095`, wireframe=true, boundaries=true

### quarter-meter-ready

- Brick hashes (ordered): `fnv1a64:0087ef5a6b5d6044`, `fnv1a64:043e954b10f09bb0`, `fnv1a64:04f2030860ece2ae`, `fnv1a64:07c604bec4db9af2`, `fnv1a64:0a630ab31efc6842`, `fnv1a64:29c21dfdae840e85`, `fnv1a64:5499cb86ca99b6ba`, `fnv1a64:6510b1828c658c14`, `fnv1a64:6b3cf70dfc7b8949`, `fnv1a64:7be5d0d4562b723c`, `fnv1a64:9944dface7eae2c6`, `fnv1a64:a47b3f18c343e71b`, `fnv1a64:b0a99a24518b8236`, `fnv1a64:e0f50c23a2445685`, `fnv1a64:e74f65366af30114`, `fnv1a64:f90231d99b281a4e`
- Mesh hashes (ordered): `fnv1a64:083129252b7f463f`, `fnv1a64:11268d6a04293e6f`, `fnv1a64:124021e2750b154b`, `fnv1a64:3df74c13db075685`, `fnv1a64:63d30131628b7007`, `fnv1a64:74f14b4d22717313`, `fnv1a64:8193a345fbb2a358`, `fnv1a64:9a1f65a98bdfff46`, `fnv1a64:aba54b0504d768cb`, `fnv1a64:cebb8a1d9606cd8c`, `fnv1a64:d14e042714d13249`, `fnv1a64:d5280c064e38f815`, `fnv1a64:dd8bc6bd4b962f2a`, `fnv1a64:de00cf7358d2dd3b`, `fnv1a64:e73334966a54741e`, `fnv1a64:fcf7380229f1b6c1`
- Camera/presentation: mode=Orbit, position=`16.0324, 48.5316, 56.9859`, target=`0.0000, -4.0000, 0.0000`, quaternion=`-0.351655, 0.127793, 0.048525, 0.926095`, wireframe=false, boundaries=false

## Browser health counters asserted by the test

- Console errors: **0**
- Console warnings: **0**
- Known Rajdhani/OTS warnings: **0**
- Unexpected warnings: **0**
- Page errors: **0**
- Failed requests: **0**
- HTTP responses >= 400: **0**

## Nonvisual atomicity mapping

The existing focused unit-test groups, rather than screenshots, prove stopped
pool rejection; preparation/setup/validation failure; ticket rejection;
cleanup/worker failure; stale/rapid regeneration; and replacement failure.
The UI captures intentionally remain limited to successful, visibly reachable
Ready states.
