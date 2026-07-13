# Tasks: Browser Graphics Settings Foundation V1

## 1. Specification

- [ ] 1.1 Finalize proposal, design, normative spec, protocol, and browser architecture note.
- [ ] 1.2 Validate scope, presets, capability truth, and presentation-only boundaries.

## 2. Settings domain

- [ ] 2.1 Add schema/types/defaults/presets and strict unknown-value validation.
- [ ] 2.2 Add feature-detected capability mapping and immutable snapshots.
- [ ] 2.3 Add LocalStorage adapter, store, controller, Apply/Cancel/Reset, and Custom derivation.
- [ ] 2.4 Add focused schema, preset, storage, and capability tests.

## 3. Renderer integration

- [ ] 3.1 Add the narrow Three.js graphics adapter and presentation scheduler.
- [ ] 3.2 Load persisted AA before renderer creation and apply live settings after creation.
- [ ] 3.3 Add camera-only render distance, safe DPR/scale resize, tone/exposure, anisotropy refresh, and render-only decor scaling.
- [ ] 3.4 Generalize modal input blocking without pausing simulation.
- [ ] 3.5 Add adapter/gameplay-isolation/FPS-tick tests.

## 4. Player UI

- [ ] 4.1 Add the visible Settings action and accessible native Graphics dialog.
- [ ] 4.2 Add pending/applied/restart/capability presentation and namespaced responsive styling.
- [ ] 4.3 Verify focus, Escape/Back, disabled reasons, Planner exclusion, and input restoration.

## 5. Runtime tests and evidence

- [ ] 5.1 Add normal `/` Playwright coverage with no TestBridge and console/network failure collection.
- [ ] 5.2 Capture panel, Low, and High screenshots at 1920x1080.
- [ ] 5.3 Generate JSON/Markdown runtime evidence and visually inspect the screenshot matrix.

## 6. Verification and completion

- [ ] 6.1 Run focused typecheck/unit/E2E commands.
- [ ] 6.2 Run full browser tests/build/E2E and repository .NET gates without starting Unity.
- [ ] 6.3 Complete independent review, scope audit, and `git diff --check`.
- [ ] 6.4 Run DevToolbox verification and completion preflight, then close tasks only with evidence.
- [ ] 6.5 Commit and push the feature branch without merging to main.
