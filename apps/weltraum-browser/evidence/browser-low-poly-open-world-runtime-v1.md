# Browser Low-Poly Open-World Runtime v1 Evidence

Status: M6 foundation/test slice implemented. This is not gameplay open-world runtime.

## Implemented Contracts

- WORLD-001: `FrameDescriptor`, `WorldCoordinate`, `LocalCoordinate` and `FramedVelocity` separate durable absolute coordinates from local render/physics projections.
- WORLD-002: Three.js `DebugScene` consumes an externally built render-only `LowPolyInstanceBatch`; the render snapshot reports `sourceId: "proving-ground-world"` and `rendererOwnsWorldTruth: false`.
- WORLD-003: `determineSimulationBubbleMembership` assigns deterministic `Full`, `Snapshot` and `Dormant` update modes from absolute positions.
- WORLD-004: the debug asteroid field uses a Three.js `InstancedMesh` from a deterministic `LowPolyInstanceBatch` with `maxInstances: 64`.

## M6 Gate

- Floating-origin projection shifts move local coordinates only.
- Absolute entity position and absolute velocity remain unchanged.
- Velocity frame conversion/projection clones render-facing `Vec3` values so mutating projected local velocity cannot mutate durable absolute velocity.
- Relative local distances remain stable after the origin shift.

## Deferred Scope

- No terrain streaming, generated planets, orbital mechanics, surface runtime, save/load, economy, missions, cargo runtime or Unity asset edits.
- The low-poly field is fixed smoke evidence only; chunk/LOD streaming remains a later slice.

## Verification Log

- `npm ci`: passed; 58 packages installed/audited, 0 vulnerabilities.
- `npm run test -- tests/unit/worldFrames.test.ts tests/unit/lowPolyInstances.test.ts`: passed, 2 files / 6 tests.
- `npm run test`: passed, 8 files / 51 tests.
- `npm run build`: passed; existing Vite chunk-size warning remains.
- `npm run test:e2e`: failed only with known local `browserType.launch: spawn UNKNOWN` from bundled Playwright Chromium.
- `$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run test:e2e`: passed, 7 tests.
- `git status --short -- Assets`: no `Assets/**` changes.

DevToolbox MCP note: `workspace_discover` for this worktree returned `unauthorized_path`, so task checkboxes and evidence were updated directly in the worktree files.
