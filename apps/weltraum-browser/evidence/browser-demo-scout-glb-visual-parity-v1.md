# Browser Demo Scout GLB Visual Parity v1 Evidence

## Asset copy

- Source: `Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb`
- Browser path: `apps/weltraum-browser/public/ships/demo_scout_mk1.glb`
- Header/length check: source size `127108`, destination size `127108`, magic `glTF`, version `2`, declared length `127108`.
- `Assets/**` was read/copied only; source GLB was not edited.

## Runtime result

- GLB load result: `GLBLoaded` via `/ships/demo_scout_mk1.glb`.
- HUD line: `Ship visual: Demo Scout GLB`.
- Axis/scale metadata: render-only `rotation.y = -Math.PI / 2`, mapping `browserX=-glbZ,browserY=glbY,browserZ=glbX`, applied scale `3.2`.
- Descriptor validation: GLB manifest and runtime descriptor report hull/body identity, cockpit/front marker, one main engine, four RCS markers, muzzle placeholder, and camera anchor.
- Marker binding: cockpit/front, main engine, RCS hardpoints, and muzzle resolve from GLB node names; ChaseLocked camera anchor uses the manifest visual anchor because the GLB does not provide a camera-anchor node.
- Fallback: procedural fallback remains available as `ProceduralFallback`; forced malformed browser GLB bytes on `/ships/demo_scout_mk1.glb` report `GLBFailedFallback` with `fallbackReason` and keep the procedural ship visible.

## Verification

- `npm ci` (needed because `vitest` was not installed in the worktree) passed.
- `npm run test` passed: 9 files, 77 tests.
- `npm run build` passed. Vite emitted the existing large-chunk warning for the bundled app.
- `npm run test:e2e` first failed with bundled Chromium `spawn UNKNOWN`.
- `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" npm run test:e2e` passed: 9/9 tests.
- `git status --short -- Assets` reported no `Assets/**` changes.
- `git diff --check` passed.

## Screenshot evidence

- `apps/weltraum-browser/evidence/demo-scout-glb-loaded.png`
- `apps/weltraum-browser/evidence/demo-scout-main-thruster.png`
- `apps/weltraum-browser/evidence/demo-scout-rcs-puffs.png`
- `apps/weltraum-browser/evidence/demo-scout-chasecam.png`
- `apps/weltraum-browser/evidence/demo-scout-autopilot-arrival.png`

## Remaining gaps

- This is visual parity for the Demo Scout browser adapter only, not full Unity physics/RCS allocator/particle parity.
- Combat, ship builder, cargo/economy, missions/drones, and mobile manual flight controls remain out of scope.
