# WXG-07: finite cube-sphere transport

Research-only LOCAL_WINDOWS_ISOLATED candidate, product integration NO. Exclusive branch `feature/wxg-07-2026-10-09`, base `17b1db4201a28e7b607c30707bdc2b75e3484a10`. No product/A0/package/lock writes, commits, pushes or owner approval.

Hypothesis: a small donor-cell finite-volume kernel can conserve two passive areal densities on a closed gnomonic cube-sphere and replay exact state bytes, including offline catch-up. The prescribed solid-body rotation is divergence-free. This is a filtered transport model: no prognostic pressure, acoustic/gravity waves, precipitation, thermal feedback or GCM. One horizontal band; moisture/aerosol names describe passive test channels, not a calibrated atmosphere.

## Run

From this spike directory, using the verified Node22 binary:

```powershell
& C:\IFI_SourceCode\Utils\npm-tmp\opencode\node-v22.23.2-win-x64\node.exe scripts/repro.mjs local-<unique-label>
```

The finite script verifies frozen producer/input bytes, builds and typechecks with the copied pinned TypeScript 7.0.2 compiler (`--singleThreaded`), runs focused and historic tests with concurrency one, then runs 32/48/64 × 1h/24h/7d. Existing run folders are preserved. Expected duration on this concurrently used local machine: approximately 30 seconds; this is an operational estimate, not a reference performance promise. All output stays in the own spike or own spec tests directory. Windows sandbox may require approval to spawn Git/TypeScript; no installer is invoked.

All required runtime input/compiler bytes are already frozen under `inputs/`. Do not install into shared/A0 `node_modules`. `InputBindings.json` lists original/copy paths, sizes and hashes, supplied receipts/seals, imported source/compiled/fixture/lock files and licensed compiler closure. Upstream WASM bindings were verified; WASM is not executed by this transport model. There are no shaders, Rapier or Three dependencies. npm 10.9.8 and Python 3.12.13 were observed; neither is needed for reproduction. Browser/Rust tools are not used.

`src/grid.ts` uses WXG projection/tangent primitives and exact power-of-two area; the own 48² adapter is independently tested against spherical triangles. Shared integer cube endpoints pair every edge, including corners. Edge flux is an integrated solid-rotation streamfunction difference. Forward Euler upwind uses fixed per-cell order and double buffering. Stability uses minimum actual `2*area/perimeter`, maximum outgoing rate, maximum wind and sink rate at safety 0.8. Zero wave speed is the declared filtered spectrum. The selected finite dt is 600/300/300 s for 32/48/64, on the existing 120-Hz Universe clock.

## Bytes and checkpoint behavior

`fixtures/grid-*.coefficients.bin` and initial density bytes are pinned. Runtime coefficient regeneration must match them exactly; this is a same-toolchain local guarantee. The source/profile/compiled/fixture bindings define model identity. Earlier preliminary/r02 profile files are preserved; `profile-r03.json` files are the current candidate after the budget-overflow review fix. Canonical research checkpoints use PLT's NM/v1 LE header, strict finite nonnegative Float64 payload, ordered events, budgets and SHA256 checksum. Targets must lie on the declared fixed substep lattice. No product save format is introduced.

Checkpoint+Tail starts at 1h and advances through the three offline gaps; FullReplay starts at epoch zero. The matrix compares full canonical bytes, including source/sink budgets and event cursor. `CatchUp.read()` exposes Pending until ready. The real single worker test sends a newer response before an older one and rejects stale identity, wrong tick, corrupt bytes and duplicate acceptance. Rendering/terrain chunks and object timewarp never select another weather strategy.

Use `REPORT.md`, `HANDOFF.md`, `receipt.json`, `runner-profile.json` and `.runtime/final-seal/` for handoff. `scripts/seal.mjs --check` verifies the exact sealed dirty tree and ignored payload bindings; it does not grant Plannotator approval. Reference hardware, cross-device equality and product adoption remain separate open gates.
