# Test Protocol: browser-ship-builder-compatibility-mass-core-v1

## Scope

Verify deterministic connection compatibility, structural graph/reporting, enabled dry mass, grid/meter COM, yaw-aware bounds, immutability, canonical signatures, normal-route browser import, and strict path isolation.

## Baseline

Refreshed `origin/main` at `547577a2d88387b70ebdbe2547821ac9983f868b`:

- `npm run test`: 28 files, 340 tests passed.
- `npm run build`: passed with the pre-existing >500 kB Vite chunk warning.
- existing `ship-builder-domain-catalog.spec.ts`: 1/1 passed.
- existing E2E rewrites its old evidence through line-ending/output generation; those baseline-only changes were restored and are not part of this change.

## Required commands

Run npm/Playwright from `apps/weltraum-browser`; dotnet/git from repository root.

```powershell
npm run test -- tests/unit/shipBuilderCatalog.test.ts
npm run test -- tests/unit/shipBuilderBlueprint.test.ts
npm run test -- tests/unit/shipBuilderSerialization.test.ts
npm run test -- tests/unit/shipBuilderCompatibility.test.ts
npm run test -- tests/unit/shipBuilderValidation.test.ts
npm run test -- tests/unit/shipBuilderMassProperties.test.ts
npm run test
npm run build
npm run test:e2e -- tests/e2e/ship-builder-domain-catalog.spec.ts
npm run test:e2e -- tests/e2e/ship-builder-compatibility-mass-core.spec.ts

dotnet build "Weltraum Spiel.sln" --no-restore
dotnet test "Weltraum Spiel.sln" --no-build
git diff --check
git diff --cached --check
```

## Required unit scenarios

1. Scout compatible and connected.
2. Cargo compatible and connected.
3. Weapon compatible and connected with explicit Shared structural endpoint.
4. Unknown connection instance rejected as schema error.
5. Unknown part definition rejected as schema error.
6. Unknown endpoint socket rejected as schema error.
7. Incompatible socket types rejected.
8. Bilateral category restriction enforced.
9. Exclusive socket double occupancy rejected deterministically.
10. Identical endpoint pair rejected.
11. Duplicate connection ID rejected as schema error.
12. Disconnected subgraphs reported.
13. Insertion order does not change report/signature.
14. Dry mass equals definition sum.
15. Symmetric COM is centered.
16. Asymmetric mass shifts COM.
17. Yaw changes X/Z bounds but not mass.
18. Zero mass diagnostic; negative/nonfinite catalog mass rejected; overflow fails closed.
19. Results and nested arrays/objects are frozen.
20. Canonical roundtrip preserves validation and mass results.
21. Enabled connection to disabled instance is invalid.
22. Missing policy socket pair fails closed.
23. Connection type and capacity mismatches.
24. Opposed directions are compared after yaw transform.
25. Required socket Error/Warning/Info severity.
26. Empty blueprint fail-closed.
27. Existing catalog signature and fixture hashes unchanged.

## Fixture invariants

| Fixture | Root | Dry mass | Grid COM | Grid bounds min..max | Occupied |
| --- | --- | ---: | --- | --- | ---: |
| Scout | `scout-cockpit` | 1450 | `(0,-3/145,63/145)` | `(-2,-3,-5)..(2,2.5,4.5)` | 8 |
| Cargo | `cargo-cockpit` | 2540 | `(-105/254,0,30/127)` | `(-5,-2.5,-8)..(2.5,2.5,6)` | 10 |
| Weapon | `weapon-cockpit` | 2560 | `(3/128,17/64,39/256)` | `(-5,-2.5,-6)..(5,3.5,5.5)` | 11 |

Each fixture has one connected component, no disconnected instance IDs, and no unused required sockets.

## Browser evidence

The new E2E SHALL:

- load normal `/`;
- confirm `window.TestBridge` is absent;
- dynamically import `/src/ship-builder/index.ts`;
- evaluate the starter policy and all three fixtures;
- pin deterministic validation/mass signatures and fixture invariants;
- write only:
  - `apps/weltraum-browser/evidence/browser-ship-builder-compatibility-mass-core-v1-summary.json`
  - `apps/weltraum-browser/evidence/browser-ship-builder-compatibility-mass-core-v1.md`
- create no screenshot.

## Allowlist audit

Compare `git diff --name-only <start-sha>...HEAD`, staged diff, and worktree status to the exact user allowlist. Any `Assets/**`, package/lockfile, main/style/index, navigation, flight, runtime, render, sim, UI, test-harness, unrelated evidence, or unrelated docs path is a failure.
