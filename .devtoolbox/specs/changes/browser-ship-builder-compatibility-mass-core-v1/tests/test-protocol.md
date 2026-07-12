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
28. Stable endpoint IDs containing `:` cannot collide across part/socket tuple boundaries.
29. Custom socket-type pair ordering remains canonical even when values contain the previous delimiter character.
30. Meter-space bound size is exactly grid-space size multiplied by `gridMeters`.
31. Diagnostic construction/order does not freeze or mutate caller-owned endpoint/diagnostic input.
32. Mount-side and non-opposed-direction failures are asserted explicitly.

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

## Findings-first review

The sequential Root review covered determinism, schema/domain separation, policy gaps, mutation, canonicalization, numeric failure behavior, occupancy, allowlist scope, maintainability, and test gaps. Agent review fan-out was stopped because the spawn result did not expose the required model/reasoning metadata.

Resolved findings, in severity order:

1. **High - endpoint identity collision:** delimiter-concatenated endpoint keys could collide for valid colon-namespaced IDs such as `("a:b","c")` and `("a","b:c")`. Keys now use canonical JSON tuples, with catalog/blueprint-valid regression coverage.
2. **High - policy pair canonicalization collision:** custom socket-type pairs could share a NUL-delimited sort key and reorder signatures. Pair sorting now compares tuple components directly, with NUL-containing reorder coverage.
3. **Medium - meter bound size contract:** meter size was recomputed by subtracting scaled extrema, which can differ from `grid.size * gridMeters`. Size is now projected directly and covered at `gridMeters = 0.1` with negative half-grid bounds.
4. **Medium - caller mutation:** diagnostic construction/order could freeze caller-owned endpoint or diagnostic records. Both paths now clone before freezing, with explicit non-mutation tests.
5. **Low - runtime vocabulary mutability:** the exported diagnostic-code order was readonly only at compile time. It is now runtime-frozen and the full order is pinned.
6. **Coverage hardening:** explicit tests now cover mount-side mismatch, non-opposed `Opposed` mode, identical endpoint rejection even when same-instance links are allowed, Cargo opposite-role occupancy plus cross-role Exclusive aggregation, and every fixed diagnostic code.

No unresolved correctness, regression, allowlist, or maintainability-decay finding remains after these fixes. No R1-R6/T1-T6 issue cleared the finding bar after the bounded maintainability pass.

## Final browser verification results

Focused commands:

- `shipBuilderCatalog.test.ts`: 16/16 passed.
- `shipBuilderBlueprint.test.ts`: 10/10 passed.
- `shipBuilderSerialization.test.ts`: 9/9 passed.
- `shipBuilderCompatibility.test.ts`: 17/17 passed.
- `shipBuilderValidation.test.ts`: 16/16 passed.
- `shipBuilderMassProperties.test.ts`: 15/15 passed.

Complete commands:

- `npm run test`: 31 files, 388/388 passed.
- `npm run build`: TypeScript and Vite production build passed; only the pre-existing >500 kB chunk warning remains.
- existing Domain Catalog E2E: 1/1 passed; its generated old evidence was restored to committed HEAD content.
- new Compatibility/Mass E2E: 1/1 passed with exact policy/layout/structure/mass signature pins.
- evidence JSON parse and invariant checks passed; repeated generation retained the committed task evidence.
- `git diff --check`: passed.
- `git diff --cached --check`: passed with no staged changes at that gate.

## Dotnet verification availability

Both requested commands were executed from the isolated feature worktree and failed before compilation with the same environment error:

```text
MSBUILD : error MSB1009: Project file does not exist.
Switch: Weltraum Spiel.sln
```

Git tracks no `.sln`, `.slnx`, or `.csproj` file in this checkout, and `.gitignore` explicitly ignores `*.sln`. The generated solution exists only in the separate active checkout, whose dirty state is protected by this worktree workflow; it was not used as a substitute. No C#, Unity, `Assets/**`, package, or project-setting file changed in this browser-only feature.

## Final contract and scope gates

- `specs_validate`: all 6 checks passed.
- final ServiceRunner `verify_run`: Specs passed, Test passed (388/388), Build passed with the known chunk-size warning; 0 failed and 0 skipped steps.
- machine allowlist audit: all 19 observed feature paths matched the exact allowlist; no expected path was missing.
- task evidence JSON, pinned signatures, fixture invariants, and no-timestamp checks passed.
- deterministic evidence SHA-256:
  - summary JSON: `22343A03AFEEA34C133B215918EAD1E5FB76AE43119D4BEF444F4F6230868D95`
  - Markdown: `32DC9926277A3565CCDAEFC49BC607760EE45515BC2E600FBDAA730AFD7127CE`
- no package/lockfile, UI, runtime, flight, navigation, render, TestBridge, Unity, project-setting, or `Assets/**` path appears in the feature diff.
