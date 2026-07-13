# Browser Playable Ship Flight Polish v1 Evidence

Date: 2026-06-30

> Repository cleanup note (2026-07-13): `Assets/**` below is the original
> capture-time path. The immutable Unity snapshot is available at
> `unity-legacy-final-2026-07:Assets/**`; the retained source copy is under
> `art/source/ships/prototype-ship-kit/`.

## Scope

Bounded follow-up to `browser-playable-ship-flight-v1`: optional Demo Scout GLB evaluation, procedural fallback/marker validation, HUD readability, desktop/mobile wording, VFX scale polish and cancel-path naming cleanup.

## GLB decision

- Candidate: `Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb`.
- Read-only validation: exists, size `127108` bytes, binary magic `glTF`, version `2`, declared length `127108`.
- Decision: not copied to `apps/weltraum-browser/public/ships/` and not loaded in runtime for this slice.
- Reason: Three.js GLB loading uses the asynchronous `GLTFLoader` addon path; adopting it here would add loader/timing and marker-parity risk without proving authored sockets. The procedural fallback remains deterministic and now exposes explicit `GLBUnavailableFallback` visual source state.
- `Assets/**` mutation: forbidden and not performed.

## Marker/socket validation

`shipVisual.ts` now validates descriptor coverage for:

- hull/body identity (`main-hull`),
- cockpit/front marker,
- main engine marker,
- at least four RCS markers,
- muzzle placeholder,
- camera anchor.

The procedural visual throws if required descriptors are weakened, and render snapshots include both `visualSource` and `descriptorValidation` metadata for gated TestBridge evidence.

## HUD/help/VFX/naming polish

- Default player HUD velocity text now shows scalar `Speed N.NN m/s` and no raw `(x, y, z)` component triple.
- Full velocity vectors remain available in telemetry/TestBridge snapshots.
- Help text states desktop keyboard/mouse manual flight and mobile target selection/autopilot-only limitation for this slice.
- Main thruster flame scale now uses acceleration magnitude, so off-axis acceleration still scales the VFX.
- The misleading cancel-path local `stoppedShip` was renamed to `driftPreservingShip` while preserving no idle/cancel drift-zero behavior.

## Verification

Commands run from `apps/weltraum-browser` unless noted otherwise:

- `npm ci` - PASS; 58 packages installed/audited, 0 vulnerabilities. npm reported pre-existing unknown `always-auth`/`email` config warnings.
- `npm run test` - PASS; 9 test files, 73 tests passed.
- `npm run build` - PASS; TypeScript and Vite production build completed. Vite reported the pre-existing large chunk warning for the main bundle.
- `npm run test:e2e` - KNOWN ENV FAILURE ONLY; 8/8 Playwright tests failed at browser launch with `browserType.launch: spawn UNKNOWN` for bundled Chromium.
- `$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run test:e2e` - PASS; 8/8 Playwright tests passed.
- From worktree root, `git status --short -- Assets` - PASS; no `Assets/**` changes reported.
- From worktree root, `git diff --check` - PASS.

## Remaining limitations

- Production GLB parity remains deferred until a separate slice can prove authored marker/socket mapping without weakening descriptor validation.
- No mobile touch/manual flight controls were added; mobile remains target/autopilot-only.
