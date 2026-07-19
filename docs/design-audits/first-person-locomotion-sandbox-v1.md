# First-Person Locomotion Sandbox V1 — Design Audit

## Audit purpose and status

This document began as the bounded Task 4 audit slice for `browser-first-person-locomotion-sandbox-v1`. It records the design contracts that must be reviewed before full verification and now also documents the approved, bounded UI/E2E review-fix pass.

The route is an **isolated browser proving ground** at `/prototypes/first-person-locomotion-sandbox-v1/`. It is **not a production first-person core**, **does not replace `SurfaceLocalFrame`**, and does not establish production movement, physics, surface-world, camera, or balance authority. Every number in the exported fixture inventory is a **UX fixture — not final balance**.

Original audit-authoring execution `9cccd8aa012d4aad99df016937ce9e2f` remains the historical record for the audit as first written; the prior review-fix pass does not relabel or rewrite that execution. Its approved parent record is `e790f26a906a422fa74a4b3475e66394`. The current evidence-truth correction uses parent record `46c6966c2e16498180a26db16077c27d`; no new DevToolbox execution, verification, review, task-toggle, or commit record is created because this bounded pass explicitly forbids those mutations.

## Boundaries

### Change write boundary

The approved change may write only:

- `.devtoolbox/specs/changes/browser-first-person-locomotion-sandbox-v1/**`
- `apps/weltraum-browser/prototypes/first-person-locomotion-sandbox-v1/**`
- `apps/weltraum-browser/tests/e2e/first-person-locomotion-sandbox.spec.ts`
- `apps/weltraum-browser/evidence/first-person-locomotion-sandbox-v1-*`
- `docs/design-audits/first-person-locomotion-sandbox-v1.md`

The original Task 4 audit-authoring slice owned **only this audit file**. The later approved review-fix pass owned only prototype `index.html`, `style.css`, `main.js`, `scene.js`, this audit, and `apps/weltraum-browser/tests/e2e/first-person-locomotion-sandbox.spec.ts`. The current evidence-truth correction owns only the E2E spec, active DevToolbox proposal/design/canonical spec/tasks, and this audit. It must not edit the prototype/model/source/config/evidence files, package or lockfile, CI, Git state, or any Unity path.

### Non-goals

- No production character controller or reusable physics framework.
- No `SurfaceLocalFrame` replacement or integration.
- No surface-world, terrain streaming, voxel, orbital, combat, cargo, economy, or gameplay-HUD integration.
- No final tuning or balance claim.
- No external asset pipeline or new dependency.
- No root Playwright/Vite configuration change and no port-5173 server in the focused run; unchanged root UI CI remains a separate 5173 run.
- No Unity project, scene, asset, package, or editor work.
- No PR, merge, commit, push, cleanup, or deletion.

## Architecture audit

### Ownership and data flow

1. `course-model.js` owns the immutable analytic course catalog and pure support, contact, and clearance queries.
2. `locomotion-model.js` owns authoritative fixed-step locomotion state, bounds, velocity, grounding, stance, contacts, preset parameters, reset, and finite telemetry.
3. `main.js` maps keyboard, visible automation, and the narrowly namespaced test API into one normalized intent controller; it advances the model and projects telemetry into diagnostics.
4. `scene.js` consumes cloned course descriptors and model telemetry to render Three.js geometry and a first-person camera.
5. `index.html` and `style.css` provide diagnostic controls and presentation only.
6. `first-person-locomotion-sandbox.spec.ts` drives the same normalized model-intent seam through `window.WeltraumFirstPersonLocomotionSandboxV1` in both configurations. It derives run mode from Playwright's actual project `baseURL`; only focused 5223 captures or writes prefix-approved canonical evidence.

### Model/render separation

- Three.js meshes, camera objects, labels, DOM state, CSS, head bob, and FOV kick do not own or mutate locomotion truth.
- Collision and rendering derive from the same immutable course catalog, but collision remains analytic model logic; meshes are not colliders.
- The scene receives telemetry and locomotion parameters as inputs. It returns camera presentation telemetry only.
- Camera yaw, pitch, FOV, and bob are presentation state. They do not affect model position, velocity, support, collision, or intent.
- The test API can reset, submit normalized intent, step, resume, read telemetry/health/camera/fixtures, and check finiteness; it cannot assign arbitrary position or bypass the solver.

### Course and scene architecture

- The course is deterministic and asset-free: named reset/start, flat ground, 10°/20°/35°/50° ramps, 0.16/0.30/0.50 m stair rises, crouch tunnel, narrow platform, slippery patch, and analytic uneven rock surface.
- `getCourseRenderDescriptors()` clones the immutable catalog before it reaches rendering.
- The course solver is deliberately bounded to named analytic regions. It is not a triangle mesh, BVH, rigid-body, or general-purpose capsule collider.
- Scene geometry, labels, lighting, and the support marker are diagnostic projections of those descriptors.

## Collision, support, slope, step, and clearance assumptions

- Player bounds are a vertical capsule-like shape represented by radius, total standing/crouched height, and derived cylinder height. Position is the foot position.
- Each fixed step is subdivided by intended travel distance, capped by `maxMicroStepDistance` and `maxMicroSteps`. Side-contact resolution is bounded by `collisionIterations`.
- Support candidates are analytic surfaces. The model selects highest height first, then explicit priority, then stable ID ordering.
- A support is walkable when its normal-derived slope angle is at or below the active preset's slope limit plus query epsilon.
- A positive support rise is a step candidate only while grounded. It is accepted only when the target support is walkable, the rise is within active step height, and standing/crouched clearance is available at the stepped position.
- A non-walkable rise reports `slope-blocked`; a too-high walkable rise reports `step-blocked`. Both use an explicit edge normal for velocity projection.
- Ground support may follow a downward surface change only within `supportAdhesionDistance`; a larger drop transitions to airborne state.
- Tunnel clearance is an explicit overhead query against the analytic ceiling. Releasing crouch under insufficient clearance keeps crouch authoritative and reports `standing-blocked` contacts.
- Side contacts currently come from stair boxes and the narrow platform; overhead contacts come from the tunnel; slopes and uneven ground are support queries.
- Landing is considered only while descending onto support. The position is resolved to support height and only the inward velocity component is removed through the explicit support normal.
- Traction scales ground acceleration/deceleration and is clamped to `[0, 2]`. Air movement uses separate acceleration/deceleration multiplied by `airControl`.

### No-hidden-snap / no-blanket-zero discipline

- Exact start placement and zero velocity are allowed only by named reset/spawn initialization.
- Support-follow, accepted step-up, landing, clearance correction, and side-penetration correction are explicit solver events with contacts or support rationale; they are not gameplay snaps.
- `projectVelocityOutOfContact()` removes only velocity moving into an explicit normal. It does not blanket-zero velocity.
- Landing does not zero the full velocity vector; horizontal motion remains unless constrained by a contact normal or later deceleration.
- Slippery release must decay through traction-aware deceleration and must never use a velocity-zero escape.

## Input, pointer lock, and test architecture

### One normalized intent path

- Keyboard mappings: `W/A/S/D`, left/right Shift, left/right Ctrl, `C`, and Space. `R` is the explicit reset command.
- Visible automation exposes the same controls through Select + Press/Hold/Release. Digital input sources are tracked independently, merged, and normalized.
- The test API uses an external source named `test-api`; it is merged with digital sources and passed through `normalizeLocomotionIntent()` before model stepping.
- Diagonal magnitude is normalized to at most 1; non-finite numeric input falls back to 0; digital booleans are strict booleans.
- Reset clears all input sources and pending visible-automation timers before resetting model and camera.
- Window blur clears keyboard sources to avoid stuck keys.

### Pointer-lock states

- **Inactive:** button enabled, `aria-pressed="false"`, keyboard and visible automation remain usable.
- **Requesting:** only an explicit button gesture calls `canvas.requestPointerLock()` and announces “Requesting pointer lock…”.
- **Active:** canvas is the lock owner, the button is disabled and marked pressed, mouse movement changes presentation yaw/pitch, and visible status says Escape releases.
- **Denied/exception:** status says pointer lock was not granted; keyboard and visible controls remain available.
- **Pointer-lock error:** status reports the failed request; keyboard and visible controls remain available.
- **Released:** the browser's native Escape behavior removes the lock and the `pointerlockchange` handler returns UI state to inactive. No synthetic Escape or permission bypass is required for automation.

## Diagnostic UI, accessibility, and reduced motion

- The UI is explicitly titled `PROVING GROUND / DIAGNOSTIC`; it is not a player HUD.
- Controls and diagnostics live in edge rails while the center viewport remains visually clear except for a small reticle and bounded status line.
- Styling is flat and opaque: no backdrop blur, decorative gradients, floating-card dashboard, or icon-heavy control vocabulary.
- The live diagnostic set includes speed, grounded, slope, traction, vertical velocity, fixed-step backlog, frame time, camera mode, contact count, position, stance/blocked standing, support ID, and tick.
- Active preset, active camera state, active input, course-region index, latest contacts, and Browser Health remain visible.
- Buttons use `aria-pressed` for presets, uniquely named camera toggles, pointer lock, and automation state. Desired and effective camera-presentation states are exposed separately. Groups and rails have labels; status and health surfaces update polite live regions only on meaningful transitions.
- Pointer lock has explicit help text and status. The canvas is keyboard-focusable and has fallback text.
- Pointer state and the next action remain visible in the viewport before interaction and at narrow widths; the focusable canvas has an explicit accessible name and description.
- Buttons, select, summary, and canvas receive visible `:focus-visible` outlines.
- Responsive layouts preserve viewport-first order at narrow widths, allow the course index to wrap, and raise coarse-pointer targets to at least 44 px; these remain unverified until the focused browser run.
- `prefers-reduced-motion` suppresses both head bob and FOV kick in the scene and reduces CSS animation/transition duration. Both effects remain independent explicit desired-state toggles and neither is model truth.

## Focused browser configuration and Browser Health

### Port-5223-only configuration

- Prototype-local config: `prototypes/first-person-locomotion-sandbox-v1/playwright.config.ts`.
- Repository E2E directory is resolved as `testDir`; `testMatch` is exactly `first-person-locomotion-sandbox.spec.ts`.
- Base URL and readiness URL are exactly `http://127.0.0.1:5223`.
- Web-server command is exactly `npm run dev -- --host 127.0.0.1 --port 5223 --strictPort`, with `cwd` set to `apps/weltraum-browser`.
- `reuseExistingServer: false`, `workers: 1`, `retries: 0`, `fullyParallel: false`, Chromium only.
- Test timeout is 30,000 ms, expectation timeout 5,000 ms, and server timeout 20,000 ms.
- Outputs are prototype-local `locomotion-sandbox-playwright-output` and `locomotion-sandbox-playwright-report`; automatic screenshots are off and traces are retained only on failure.
- The config does not import the root Playwright config and contains no port-5173 server.

### Configuration-derived execution and evidence split

- The shared spec reads the actual base URL from Playwright `testInfo.project.use.baseURL` and derives a run label from that configuration.
- Root-config UI CI at actual base URL `http://127.0.0.1:5173` executes all 11 tests and their behavioral/health assertions. The four canonical screenshot capture calls are disabled, and after-all returns before focused screenshot gates, evidence-directory creation, or canonical JSON/Markdown writes.
- Only the prototype-local actual base URL `http://127.0.0.1:5223` enables canonical screenshot capture. Its after-all still gates writes on all 11 required cases, four registered screenshots, 11 Browser Health samples, and actual `0/0/0/0` values.
- Focused telemetry writes the actual configured base URL and the `focused-evidence-5223` run label. The 5173 run cannot overwrite the six canonical files or claim isolated 5223 evidence.

### Browser Health order

Both the visible output and evidence contract use this exact order:

1. page/runtime errors
2. console errors
3. failed requests
4. non-finite simulation samples

The required healthy value is **`0/0/0/0`**. The app API exposes the corresponding object as `runtimeErrors`, `consoleErrors`, `failedRequests`, `nonFiniteSamples`; Playwright separately captures page errors, console errors, and failed requests and also recursively checks numeric telemetry finiteness.

## Screenshot and evidence matrix

| Evidence file | Capture | Intended claim | Task 4 status |
| --- | --- | --- | --- |
| `first-person-locomotion-sandbox-v1-course-overview.png` | 1440×900 full-page direct-route screenshot after exact Grounded reset | Numeric course regions, five presets, diagnostic layout, and route presentation are visible | Required by focused E2E; not generated or inspected in this static pass |
| `first-person-locomotion-sandbox-v1-crouch-blocked-standing.png` | 1440×900 `main.sandbox-layout` while crouched under the tunnel with standing blocked | Visible blocked-standing diagnostic and crouch-tunnel state | Required by focused E2E; not generated or inspected in this static pass |
| `first-person-locomotion-sandbox-v1-desktop-focus.png` | 1440×900 full-page exact-reset state with the visible Hold control focused | Deterministic desktop focus treatment | Required by focused E2E; not generated or inspected in this static pass |
| `first-person-locomotion-sandbox-v1-narrow-pointer-state.png` | 390×844 initial viewport | Narrow-layout pointer state, next action, and viewport-first order | Required by focused E2E; not generated or inspected in this static pass |
| `first-person-locomotion-sandbox-v1-telemetry.json` | Gated structured after-all payload | Actual completion status, route/base URL, run label, fixture notice, health samples, artifact list, and scenario results/tolerances | Written only by focused 5223 after all 11 cases, 11 health checks, and four screenshots complete |
| `first-person-locomotion-sandbox-v1-telemetry.md` | Gated human-readable after-all summary | Same actual status/evidence contract plus Browser Health and artifact index | Written only by focused 5223 after all 11 cases, 11 health checks, and four screenshots complete |

The telemetry evidence matrix retains the original eight behavior cases: named start/course catalog, walk versus sprint, crouch/blocked standing, jump/land, 35° versus 50° slopes, 0.30 m versus 0.50 m steps, normal versus slippery deceleration, and exact finite reset/Browser Health. It adds visible Press/Hold/Release versus real-keyboard convergence, pointer-lock/presentation accessibility, and a twice-replayed canonical mixed sequence with deep-equal authoritative telemetry/contacts. The bounded screenshot matrix now covers desktop overview, action, and focus plus one narrow/mobile state. It does not claim FHD/QHD, multiple browsers, or general responsive coverage.

## Complete provisional UX fixture inventory

All values in this section are **UX fixture — not final balance**. They are prototype measurements and solver/presentation tolerances, not production contracts.

### Locomotion model cadence and tolerances

| Fixture | Value |
| --- | ---: |
| `fixedDeltaSeconds` | `1 / 60` s |
| `maxFrameDeltaSeconds` | `0.25` s |
| `maxAccumulatedSeconds` | `0.25` s |
| `maxSubStepsPerAdvance` | `8` |
| `maxManualStepsPerCall` | `600` |
| `maxMicroSteps` | `12` |
| `maxMicroStepDistance` | `0.08` m |
| `collisionIterations` | `4` |
| `contactEpsilon` | `1e-7` |
| `inputDeadZone` | `1e-6` |

### Locomotion presets

| Parameter | Grounded | Heavy suit | Low gravity | Slippery | Precision |
| --- | ---: | ---: | ---: | ---: | ---: |
| radius (m) | 0.35 | 0.38 | 0.35 | 0.35 | 0.35 |
| standing height (m) | 1.80 | 1.82 | 1.80 | 1.80 | 1.80 |
| crouched height (m) | 1.18 | 1.22 | 1.18 | 1.18 | 1.18 |
| walk speed (m/s) | 4.0 | 3.2 | 4.2 | 4.0 | 2.2 |
| sprint speed (m/s) | 7.0 | 5.5 | 7.4 | 7.0 | 3.6 |
| crouch speed (m/s) | 2.2 | 1.8 | 2.3 | 2.1 | 1.5 |
| ground acceleration (m/s²) | 22 | 16 | 21 | 16 | 18 |
| ground deceleration (m/s²) | 26 | 21 | 24 | 7 | 30 |
| air acceleration (m/s²) | 8 | 5 | 7 | 8 | 6 |
| air deceleration (m/s²) | 1.5 | 1 | 1 | 0.8 | 2 |
| air control | 0.35 | 0.22 | 0.48 | 0.30 | 0.30 |
| gravity (m/s²) | -9.81 | -11.5 | -3.2 | -9.81 | -9.81 |
| jump speed (m/s) | 5.1 | 4.5 | 3.3 | 5.1 | 4.6 |
| max fall speed (m/s) | 45 | 48 | 22 | 45 | 40 |
| slope limit (°) | 35 | 32 | 35 | 35 | 38 |
| step height (m) | 0.36 | 0.32 | 0.36 | 0.36 | 0.28 |
| traction scale | 1.00 | 1.08 | 0.95 | 0.32 | 1.15 |
| support adhesion distance (m) | 0.12 | 0.10 | 0.14 | 0.10 | 0.10 |

Default preset: `Grounded`. Empty intent: `moveX=0`, `moveZ=0`, `sprint=false`, `crouch=false`, `jump=false`.

### Course constants

| Group | Fixture | Value |
| --- | --- | --- |
| World | X bounds | `-18 .. 18` m |
| World | Z bounds | `-10 .. 48` m |
| World | floor Y | `0` m |
| Start | position | `(0, 0, 0)` m |
| Start | yaw | `0` rad |
| Traction | normal | `1` |
| Traction | slippery | `0.16` |
| Traction | narrow platform | `0.86` |
| Traction | uneven rock | `0.72` |
| Ramp bank | Z bounds | `5 .. 11` m |
| Ramp bank | lane width | `4` m |
| Query | epsilon | `1e-9` |
| Query | default radius | `0` m |
| Query | default slope limit | `90°` |
| Priority | floor / traction / ramp / stairs / platform / uneven | `0 / 10 / 20 / 30 / 40 / 50` |

#### Ramp lanes

| ID | min X (m) | max X (m) | angle | min Z (m) | max Z (m) |
| --- | ---: | ---: | ---: | ---: | ---: |
| `ramp-10` | -14 | -10 | 10° | 5 | 11 |
| `ramp-20` | -7 | -3 | 20° | 5 | 11 |
| `ramp-35` | 0 | 4 | 35° | 5 | 11 |
| `ramp-50` | 7 | 11 | 50° | 5 | 11 |

#### Stairs

| ID | X bounds (m) | min Z (m) | rise (m) | depth (m) | count | derived max Z (m) | total rise (m) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `stairs-low` | `-10 .. -7` | 14 | 0.16 | 1 | 4 | 18 | 0.64 |
| `stairs-passable` | `-3 .. 0` | 14 | 0.30 | 1 | 4 | 18 | 1.20 |
| `stairs-blocked` | `4 .. 7` | 14 | 0.50 | 1 | 3 | 17 | 1.50 |

#### Other course regions

| Region | Fixtures |
| --- | --- |
| Crouch tunnel | ID `crouch-tunnel`; X `-2 .. 2` m; Z `22 .. 30` m; ceiling Y `1.42` m; ceiling thickness `0.22` m |
| Narrow platform | ID `narrow-platform`; X `6 .. 7` m; Z `24 .. 34` m; top Y `1.1` m; traction `0.86` |
| Slippery patch | ID `slippery-patch`; X `-12 .. -6` m; Z `24 .. 32` m; height `0` m; traction `0.16` |
| Uneven rock | ID `uneven-rock-surface`; X `-3 .. 3` m; Z `36 .. 44` m; base `0.08` m; X/Z/cross amplitudes `0.10 / 0.07 / 0.04` m; X/Z/cross frequencies `1.7 / 1.25 / 0.65`; traction `0.72` |

### Camera presentation fixtures

| Fixture | Value |
| --- | ---: |
| base FOV | 72° |
| maximum FOV kick | 5° |
| FOV response | 9 /s |
| standing eye-height ratio | 0.92 |
| crouched eye-height ratio | 0.88 |
| bob amplitude | 0.045 m |
| bob horizontal ratio | 0.45 |
| bob frequency at full speed | 1.85 Hz |
| mouse sensitivity | 0.0022 rad/px |
| pitch limit | 85° |
| initial pitch | -4° |
| near clip | 0.05 m |
| far clip | 140 m |

### Scene presentation fixtures

| Fixture | Value |
| --- | ---: |
| maximum pixel ratio | 2 |
| floor thickness | 0.08 m |
| surface overlay offset | 0.012 m |
| label vertical offset | 0.62 m |
| label height | 0.42 m |
| label minimum width | 2.5 m |
| label width per character | 0.105 m |
| uneven X segments | 24 |
| uneven Z segments | 32 |
| start marker radius | 0.52 m |
| start direction length | 1.45 m |
| support marker radius | 0.22 m |
| hemisphere-light intensity | 1.25 |
| directional-light intensity | 2.1 |

### Interaction fixtures

| Fixture | Value |
| --- | ---: |
| visible automation press duration | 180 ms |
| maximum visible contact rows | 6 |

### Focused E2E acceptance fixtures

| Scenario | Provisional tolerance |
| --- | --- |
| Exact reset | Position epsilon `1e-7`; tick/time/position/velocity exactly reset; flat-ground reset-support contact |
| Walk/sprint | 120 fixed 60 Hz steps; walk `7.4 .. 7.9` m, sprint `12.6 .. 13.3` m; reference smoke values `7.669` m and `12.944` m; sprint exceeds walk by more than `4` m |
| Crouch tunnel | aligned X `-1.7 .. -0.7`; enter Z `>= 23` m crouched; standing clears only beyond capsule edge Z `> 30.35` m |
| Jump/land | initial vertical velocity `4.7 .. 5.2` m/s; peak `1.15 .. 1.40` m; grounded landing within `80` fixed steps |
| Slope | 35° ramp reaches Y `> 4.0` m and Z `> 11` m; 50° lane stays below Y `0.25` m and Z `5.25` m and reports `slope-blocked` |
| Steps | 0.30 m × 4 reaches Y `> 1.15` m and Z `> 18` m; 0.50 m first rise blocks at Z `13.5 .. 13.8` m |
| Traction release | normal stops in `<= 12` steps and `< 0.5` m; slippery stops in `>= 50` steps and `> 1.5` m; slippery measured deceleration `< 30%` of normal; six-step slippery speed exceeds normal by `> 1.5` m/s |
| Health/finite | stop threshold `< 0.1` m/s; all numeric telemetry finite; Browser Health `0/0/0/0` in the required order |

## Known limitations and unverified behavior

- The original audit and this bounded review-fix pass used static file/path/content inspection only. No test, server, install, build, browser, screenshot, port, process, or Browser Health check ran.
- The six required evidence files were not generated or inspected in this pass; no runtime or visual claim is accepted yet. The focused 5223 mode now gates JSON/Markdown writes on completion of all eleven cases, four screenshots, and eleven healthy Browser Health samples. Root 5173 runs all assertions without canonical capture or evidence writes.
- Nested Vite route serving, strict port-5223 startup, shutdown, port release, process ownership, and the requirement that 5173 remain untouched are unverified until Task 5.
- Pointer-lock request transitions and the Chromium-dependent active/denied outcome, native Escape release when active, and the deterministic error-event fallback are authored in E2E but unverified in a real browser.
- Camera feel, head bob, FOV kick, reticle, lighting, fog, numeric/non-color course cues, course readability, responsive layouts, 44 px coarse-pointer targets, visible focus, live-region transition behavior, and reduced-motion effective state require visual/manual or browser evidence.
- Only Grounded behavior is exercised broadly by the focused scenario suite. Heavy suit, Low gravity, Slippery preset-wide behavior, and Precision remain primarily fixture-presence/UI contracts; the slippery course patch is tested separately under Grounded.
- The focused spec now clicks visible Press/Hold/Release, changes selection while held, and sends a real `W` keyboard event before comparing authoritative fixed-step outcomes; this authored coverage has not run in this pass.
- The 10° and 20° ramps, 0.16 m stairs, narrow platform, and uneven rock are present in the catalog/render index but do not receive dedicated locomotion acceptance cases.
- The screenshot matrix has three 1440×900 Desktop Chrome states and one 390×844 narrow state. Cross-browser, FHD, QHD, and high-DPI presentation are not claimed.
- The analytic floor is always the fallback support candidate; world bounds describe the course/render extent but do not create a fall-off or boundary wall.
- Side collisions are limited to stair boxes and the narrow platform. Ramp sides, tunnel walls, arbitrary meshes, moving geometry, rotating gravity frames, dynamic bodies, and general continuous collision are outside this solver.
- Support and step selection use analytic overlap and bounded micro-steps, not a production swept-capsule implementation. Extreme frame stalls are clamped and may leave reported backlog.
- Tunnel clearance models one rectangular ceiling region. Complex overhead geometry and multi-contact stance transitions are not covered.
- Fixture immutability and exported fixture completeness are statically visible. A canonical mixed sequence now runs twice after reset and deep-compares telemetry/contacts in the authored E2E, but runtime determinism remains unverified until that suite runs.
- **Resolved inventory blocker:** the user approved a one-line `apps/weltraum-browser/package.json` exception that appends exactly `tests/e2e/first-person-locomotion-sandbox.spec.ts` to `test:e2e:ui`, assigning the spec exactly once. Aggregate `test:e2e`, core/live groups, `package-lock.json`, root Playwright/Vite config, and the CI workflow remain unchanged. The focused config still starts only 5223; normal UI CI executes all assertions separately under unchanged root 5173 but cannot capture/write canonical focused evidence or encounter focused screenshot gates. Runtime execution remains deferred to Task 5.
- Internal renderer implementation numbers such as palette values, label-raster resolution, fog/shadow setup, and marker tessellation are presentation implementation details, not exported balance fixtures; they are not production contracts.

## Review checklist

Review must remain findings-first, severity ordered, and inside the approved change boundary.

- [ ] Confirm the audit and implementation consistently say isolated proving ground, not production first-person core, and not `SurfaceLocalFrame` replacement.
- [ ] Confirm no write escaped the approved change paths and no production `src/**`, package change beyond the one-line `test:e2e:ui` exception, lockfile, root config, CI, or Unity path changed.
- [ ] Confirm all six exported fixture groups are immutable/collectable and every number remains labeled `UX fixture — not final balance` in UI and evidence.
- [ ] Confirm course collision descriptors and render descriptors derive from one deterministic catalog without Three.js ownership of truth.
- [ ] Confirm fixed-step, accumulator, micro-step, support, clearance, slope, step, landing, and finite-state logic is deterministic and bounded.
- [ ] Confirm every position correction has reset/support/contact/clearance rationale and no hidden gameplay snap exists.
- [ ] Confirm contact response removes only inward velocity components and no blanket velocity-zero escape exists.
- [ ] Confirm crouch cannot stand through the tunnel ceiling and accepted step-up requires grounded, walkable, within-height, clear conditions.
- [ ] Confirm keyboard, visible automation, and test API converge through the same normalized intent path without arbitrary-position or solver-bypass authority.
- [ ] Confirm pointer lock requires an explicit gesture, Escape only releases it, and denial/error leaves keyboard and visible automation usable.
- [ ] Confirm head bob and FOV kick remain presentation-only; reduced motion suppresses both effects and CSS motion while exposing desired versus effective state.
- [ ] Confirm diagnostic UI remains clearly non-player-facing, center-clear, flat, readable, focus-visible, and semantically labeled.
- [ ] Confirm Browser Health order is page/runtime, console, request, non-finite and both UI/evidence require `0/0/0/0`.
- [ ] Confirm prototype-local Playwright config matches only the sandbox spec, starts strict port 5223 only, never reuses a server, and does not load root config or start 5173.
- [ ] Confirm actual base URL and run label derive from `testInfo.project.use.baseURL`; root 5173 executes all assertions without canonical evidence capture/writes, while only focused 5223 runs the four-screenshot/11-case/health evidence gate.
- [ ] Confirm screenshots and telemetry use only the `first-person-locomotion-sandbox-v1-` prefix and exactly the six documented filenames.
- [ ] Confirm every focused E2E case resets deterministically and the after-all evidence does not overstate untested presets, course regions, visuals, or port cleanup.
- [ ] Confirm known limitations remain explicit and no Foundation/prototype behavior is represented as production-ready.
- [ ] Keep browser execution, evidence generation, port/process checks, full verification, task toggling, commit, and push deferred to separately authorized stages; statically verify the approved package-script inventory assignment here.
