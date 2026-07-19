# First-Person Locomotion Sandbox

## Requirement: Isolated deterministic route
The system SHALL serve `/prototypes/first-person-locomotion-sandbox-v1/` without production/config changes. Simulation truth SHALL remain in pure prototype-local JavaScript and not Three.js/DOM/camera objects. Reset SHALL reproduce the named initial state.

## Requirement: Deterministic course
The course SHALL include flat ground; 10°, 20°, 35°, 50° ramps; multiple stair heights; low crouch passage; narrow platform; slippery patch; uneven rock surface; named start/reset. Collision and render descriptors SHALL derive from deterministic constants and require no external assets.

## Requirement: Pure fixed-step locomotion
The model SHALL use fixed steps and capsule/cylinder-like vertical bounds for walk, sprint, crouch, blocked standing, jump, grounded support, gravity, slope limit, step height, acceleration/deceleration, air control, and traction. It SHALL NOT use arbitrary position snaps except reset or blanket velocity-zero escapes; explicit contact/support resolution must explain corrections.

### Scenario: Walk and sprint
Identical timed forward input after reset SHALL land within documented distance bands, with sprint farther than walk.

### Scenario: Crouch clearance
Crouched bounds SHALL traverse the tunnel; releasing crouch under insufficient clearance SHALL stay crouched until clearance exists.

### Scenario: Jump and land
Grounded jump SHALL produce positive vertical velocity, gravity-driven descent, and finite grounded landing.

### Scenario: Slope limit
A ramp over the active limit SHALL not be climbed and diagnostics SHALL report the blocking slope/contact.

### Scenario: Step height
A rise within step height SHALL be traversed via explicit step/contact logic; a higher rise SHALL block.

### Scenario: Slippery traction
After identical input release, slippery ground SHALL decelerate measurably less/longer than normal ground without silently zeroing velocity.

## Requirement: Inputs and camera
Support WASD, Shift, Ctrl/C, Space, pointer lock, Escape, R, and visible automation buttons sharing the keyboard intent path. Head Bob and FOV Kick SHALL be independent presentation toggles and never mutate simulation truth. Pointer lock SHALL require explicit gesture; automation SHALL not require pointer-lock permission.

## Requirement: Diagnostics and presets
The visibly labeled proving-ground layer SHALL show speed, grounded, slope, traction, vertical velocity, fixed-step backlog, frame time, camera mode, and contact count. It SHALL expose `Grounded`, `Heavy suit`, `Low gravity`, `Slippery`, `Precision`; active preset remains visible and all numbers are explicitly provisional UX fixtures. Focus/accessibility/reduced motion SHALL be supported.

## Requirement: Focused Playwright port 5223
Prototype-local config SHALL use repository E2E testDir, only `first-person-locomotion-sandbox.spec.ts`, base URL 127.0.0.1:5223, exact strict-port Vite webServer command, no reuse, one worker, zero retries, Chromium only, locomotion-prefixed outputs/reports, root config unchanged, no 5173 server.

Repository E2E inventory SHALL assign exactly `tests/e2e/first-person-locomotion-sandbox.spec.ts` once by appending it to the existing `test:e2e:ui` package script. Aggregate `test:e2e`, core/live groups, `package-lock.json`, root Playwright/Vite config, and the CI workflow SHALL remain unchanged. The spec SHALL derive its actual base URL and run mode from Playwright `testInfo.project.use.baseURL`. Normal UI CI at actual base URL `http://127.0.0.1:5173` SHALL execute every behavioral assertion but SHALL NOT capture, gate, write, or overwrite canonical `first-person-locomotion-sandbox-v1-*` screenshots, JSON, or Markdown and SHALL NOT claim isolated 5223 evidence. The focused run SHALL start only port 5223 and SHALL NOT start both servers.

### Scenario: Focused run
Tests SHALL cover all 11 required cases: start, walk/sprint, crouch/blocked stand, jump/land, steep slope, step height, slippery deceleration, reset/finite state, visible automation/keyboard convergence, pointer-lock/presentation accessibility, and deterministic replay. Only when the actual configured base URL is exactly `http://127.0.0.1:5223` SHALL after-all require all 11 cases, four canonical screenshots, and 11 actual Browser Health `0/0/0/0` samples before writing short telemetry with the truthful actual base URL and focused run label. At any other base URL, including root UI CI on 5173, after-all SHALL return without focused screenshot/evidence gates or writes while the tests remain unskipped assertions. Afterward 5223 SHALL be free, 5173 untouched, and no run-owned process remain.

## Requirement: Documentation
Audit and final report SHALL state this is not a production first-person core and does not replace SurfaceLocalFrame; they SHALL list all UX fixtures and limitations. Evidence uses only the approved prefix.
