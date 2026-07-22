# Test Protocol: Structural Microvoxel Destruction Core V1

## Handoff restrictions and evidence

Historical planning handoff (completed): during that artifact handoff,
dependencies were not installed; typecheck/build/tests/E2E were not run;
services were not started; test data was not mutated; no DevToolbox execution
was created; tasks were not toggled; and no commit or push was made. Only the
five approved change artifacts were being written then.

Current approved implementation/verification phase: delegated verification
may run the exact Node, typecheck/build/tests/E2E commands specified below.
The gates are: no test-data writes, no extra DevToolbox execution, no task
toggles without evidence, and no commit or push before the final gates.

All evidence is deterministic and timestamp-free: no timestamps,
`generatedAt`, durations, wall-clock values, randomness, machine paths, or
runtime/renderer/physics integration claims. Evidence may contain commands,
exit statuses, Node version, canonical inputs, outputs, hashes, assertions,
health counts, and review results. The inherited Adaptive default-parallel
timeout/contention risk must be reported, not masked by changing timeouts,
assertions, or test membership.

The exclusive changed-path allowlist is:

```text
.devtoolbox/specs/changes/browser-structural-microvoxel-destruction-core-v1/**
apps/weltraum-browser/src/voxel/structural/**
apps/weltraum-browser/tests/unit/structuralMicrovoxel*.test.ts
apps/weltraum-browser/tests/e2e/structural-microvoxel-destruction.spec.ts
apps/weltraum-browser/evidence/browser-structural-microvoxel-destruction-v1*
docs/browser-mainline/structural-microvoxel-destruction-core-v1.md
apps/weltraum-browser/package.json (only exact test:e2e:core membership)
```

Every other path is forbidden. In particular require a null diff for
`apps/weltraum-browser/src/voxel/adaptive/**`, package-lock files,
`vite.config.ts`, root Playwright configuration, `src/voxel/index.ts`,
`main.ts`, styles, workers, streaming, Surface Lab, World Generation,
`.github/**`, `infra/**`, and foreign changes. `package.json` may change only
by appending the Structural E2E exactly once to the current `test:e2e:core`
value while preserving every Main and Adaptive entry.

## Node and Adaptive dependency preflight

Run before Structural product implementation, from
`apps/weltraum-browser`, with Node exactly `v22.23.1`:

```powershell
if ((node --version) -ne "v22.23.1") { throw "Node v22.23.1 required" }
npm ci
npx tsc -p tsconfig.json
npx vitest run tests/unit/adaptiveMicrovoxelContracts.test.ts tests/unit/adaptiveMicrovoxelMaterialization.test.ts tests/unit/adaptiveMicrovoxelPlanner.test.ts --maxWorkers=1
```

The three Adaptive paths above are the exact dependency argument list; do not
replace it with a glob. `npm ci` must leave `package.json` and the lockfile
unchanged. Any typecheck failure, assertion failure, or timeout stops the
Structural implementation. This inherited dependency gate is distinct from
the later default-parallel diagnostic risk.

## Focused Structural verification

After each approved slice, run fresh focused evidence. The complete Structural
unit argument list is exact and serial:

```powershell
npx tsc -p tsconfig.json
npx vitest run tests/unit/structuralMicrovoxelContracts.test.ts tests/unit/structuralMicrovoxelCommands.test.ts tests/unit/structuralMicrovoxelConnectivity.test.ts tests/unit/structuralMicrovoxelMassProperties.test.ts tests/unit/structuralMicrovoxelGreedyMesher.test.ts tests/unit/structuralMicrovoxelPersistence.test.ts --maxWorkers=1
```

Record exact Passed/Failed/Skipped counts. Focused obligations are:

1. binary Air/material model, Level-4 `0.125 m`, `16^3`, exact keys and
   missing-versus-known-Air coverage;
2. direct Adaptive key/quantum/canonical/hash/validation/proof/freeze reuse;
3. exact materials, integer frame translation, source/proof binding, and
   caller-copy/recursive-freeze safety, including the documented 4,096-entry
   proof/filter/material/binding/brick/anchor/joint/history/key caps, 256 tags,
   three invalidations, descriptor-only arrays, getter-free rejection, exact
   `fnv1a64-v1:[0-9a-f]{16}` hash bindings, and the 16,777,216-byte UTF-8
   persistence limit before `JSON.parse`;
4. four commands, exact sphere/box selection, CAS, duplicate rejection,
   filters, destructibility, `NoChange`, atomic rejection, and budgets;
5. six-neighbor split, canonical ordering, persistent inactive Anchors/Joints,
   anchored/detached facts, revision-bound IDs, and A-B-A;
6. cell mass, removed-mass difference, COM/AABB, full symmetric inertia,
   empty/finite/symmetry semantics, address traversal stopping before
   `maxVisitedCells + 1`, and descriptor-safe foreign Component rejection
   before canonicalization;
7. greedy faces, merges, material/metadata boundaries, internal-face culling,
   missing-neighbor fail-closed behavior, and mesh budgets;
8. canonical round-trip, provenance/evidence binding, frozen results, and no
   second Adaptive edit authority.

## Serial full suite and build

After focused Structural verification, run fresh dependency regression, the
serial full suite, and build:

```powershell
npx vitest run tests/unit/adaptiveMicrovoxelContracts.test.ts tests/unit/adaptiveMicrovoxelMaterialization.test.ts tests/unit/adaptiveMicrovoxelPlanner.test.ts --maxWorkers=1
npm run test -- --maxWorkers=1
npm run build
```

The default-parallel suite is diagnostic only and must not be used as the
gate, must not be used to hide serial failures, and must not be “fixed” by
weakening timeouts or assertions. A serial failure, timeout, or build failure
blocks release.

## Required 22-scenario matrix

The focused units and browser proof together must provide evidence for all
twenty-two approved scenarios:

1. one occupied cell with explicit empty neighbor coverage produces exactly six
   outer faces;
2. two equal neighbors merge into the expected cuboid;
3. a material boundary prevents a merge;
4. a missing brick-edge neighbor returns `MissingNeighborCoverage` and no mesh;
5. sphere subtract removes exactly the deterministic selected cells;
6. half-open box subtract is deterministic;
7. stale CAS leaves state and evidence unchanged;
8. `NoChange` consumes ID, increments only object revision, and preserves edit
   revision/content hash;
9. a cut splits expected six-neighbor Components;
10. anchored/detached classification is correct;
11. Component IDs are input-order independent;
12. equal command sequences produce equal content/evidence/result hashes;
13. removed mass equals the total-mass difference;
14. COM lies inside each Component AABB;
15. tensor is finite, six-value symmetric, and analytically correct;
16. caller inputs remain unchanged;
17. accepted outputs are recursively frozen;
18. Adaptive contracts are directly reused;
19. no Three.js/runtime/nondeterministic API dependency exists;
20. command and mesh budget excess fails closed without partial output;
21. A-B-A rehydrates identical IDs/hashes for the same stored revision;
22. persistence/evidence cannot become a second Adaptive authority.

Also cover negative quantum coordinates, multi-brick shapes, missing-brick
coverage, invalid material ID/density, non-destructible filters, duplicate
after `NoChange`, Air endpoint deactivation/reactivation, Joint non-
connectivity, stale/foreign proofs, wrong Planning Epoch, fractional
occupancy, unknown schema versions, empty state, overflow, `SetMaterial` on
Air as `NoChange`, revision-driven Component IDs, and all merge-key metadata
boundaries.

## Browser E2E proof, twice

Use the existing Playwright/Vite setup after the single approved
`test:e2e:core` membership edit; do not modify dependencies, lockfiles, or
configuration files. The E2E test loads the normal `/` route and dynamically
imports the pure Structural barrel from the browser module graph, with no
TestBridge. It must assert `window.TestBridge` is neither an own property nor
present via `in`.

Use the deterministic Level-4 fixture:

- material `1`, density `512`, so each occupied cell is exactly `1 kg`;
- anchored `8x8` base at `z=0`;
- single-cell neck at `(8,8,z=1..3)`;
- `3x3x2` upper structure from `z=4`;
- global `SubtractSphere` centered at `(8,8,2)`, radius `1`, using the exact
  center-inclusion rule, removing the two neck cells at `z=1,2` and leaving
  one detached upper Component.

Run exactly twice:

```powershell
npm run test:e2e -- tests/e2e/structural-microvoxel-destruction.spec.ts
npm run test:e2e -- tests/e2e/structural-microvoxel-destruction.spec.ts
```

Each run must report browser health exactly `console/page/request/http =
0/0/0/0`, where the channels mean console errors, page errors, failed
requests, and HTTP status >=400. Each run must prove the expected anchored and
detached Components, repeated Component ID/content-hash determinism, finite
mass/COM/tensor and correct mass difference, finite greedy mesh arrays with no
internal faces, the normal route, and no TestBridge. These are pure-core
browser proof claims only, not renderer/runtime/physics integration.

After each run capture SHA-256 for both timestamp-free evidence files:

```powershell
Get-FileHash evidence/browser-structural-microvoxel-destruction-v1-summary.json -Algorithm SHA256
Get-FileHash evidence/browser-structural-microvoxel-destruction-v1.md -Algorithm SHA256
```

The two hash pairs must be identical. Evidence must contain no timestamp,
`generatedAt`, duration, randomness, machine path, or volatile ordering. A
hash mismatch stops the gate.

## API, authority, scope, and secret scans

From the Structural source/test/evidence scope, use `rg` and classify matches;
no forbidden authority match may be accepted:

```powershell
rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!coverage/**' "three|main|workers|streaming|surface-lab|world-generation|Date\.now|new Date|Math\.random|performance\.now|crypto\.random" apps/weltraum-browser/src/voxel/structural apps/weltraum-browser/tests/unit/structuralMicrovoxel*.test.ts apps/weltraum-browser/tests/e2e/structural-microvoxel-destruction.spec.ts apps/weltraum-browser/evidence/browser-structural-microvoxel-destruction-v1* docs/browser-mainline/structural-microvoxel-destruction-core-v1.md
rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!coverage/**' "AdaptiveBrickKey|AdaptiveEditJournal|MICROVOXEL_BASE_QUANTUM_METERS|JSON\.stringify|TextEncoder|fnv1a|FNV-1a" apps/weltraum-browser/src/voxel/structural apps/weltraum-browser/tests/unit/structuralMicrovoxel*.test.ts apps/weltraum-browser/tests/e2e/structural-microvoxel-destruction.spec.ts apps/weltraum-browser/evidence/browser-structural-microvoxel-destruction-v1* docs/browser-mainline/structural-microvoxel-destruction-core-v1.md
```

The first scan must distinguish explicit rejection assertions/documentation
from accepted authority usage; no local Adaptive definitions or canonical/hash
implementation may exist. Positively verify imports from the Adaptive barrel
and Level-4/16-cubed/0.125 m contract assertions.

No repository secret scanner, `gitleaks`, or `trufflehog` is available; do not
install one or change dependencies. Use a bounded no-echo fallback over every
changed or untracked allowlisted text file. It must detect at least AWS,
GitHub, and Bearer token prefixes; private-key headers; quoted assignments for
password, API key, client secret, access token, and refresh token; and secret
file names/extensions `.env`, `.pem`, `.key`, `.pfx`, `.p12`. On a match output
only category and path, never the value. Any match stops the gate.

## Exact changed-path and diff gates

From the Structural worktree root, unite tracked diff paths from the dependency
SHA and untracked allowlisted paths, then require every path to match exactly
one allowlist entry. Require null diff for all forbidden paths. Before the
human gate run:

```powershell
git diff --check
git diff --cached --check
git status --short
```

Do not stage during this handoff. At the future release gate, stage only
allowlisted files and repeat the checks; no foreign change may be staged.

## Review and completion order

After fresh implementation evidence, obtain both required reviews:

1. canonical `reviewer` for contract correctness, Adaptive reuse,
   CAS/atomicity, duplicate/NoChange, hash/freeze, connectivity, mass/tensor,
   mesh/neighbor, persistence, and scope;
2. independent `verification_reviewer` for evidence sufficiency and any
   remaining P1/P2 or regression gap.

Fix only confirmed in-scope findings, add regression coverage, then rerun
affected reviews and fresh verification. Use the single DevToolbox execution
for verification and Completion Preflight; tasks remain open without evidence.
After the controller pushes and creates the PR, require exact-head Codex review;
repeat it after every head change and never merge without explicit approval.

## Stop rules

Stop and report the exact conflict without broadening scope if:

- the approved plan or Adaptive contract is missing, conflicting, or requires
  an Adaptive-path change;
- dependency branch/SHA, worktree ancestry, or clean-state preflight differs;
- Node is not exactly `v22.23.1`, or dependency typecheck/three-test gate
  fails or times out;
- a command would need clipping, defaults, retry, float transforms,
  missing-as-Air, fractional occupancy, or silent rebind;
- any forbidden path, package-lock/config change, any `package.json` change
  beyond the exact core-group membership, secret hit, API/authority scan
  finding, or diff-check failure appears;
- focused units, serial full suite, build, E2E, evidence-repeat hashes, or
  browser health is not green;
- reviewer/reviewer-GLM findings remain open, Completion Preflight fails, or
  human review is not approved.

Do not mask the Adaptive default-parallel timeout risk: any default-parallel
run is diagnostic only, after serial gates, and its result is reported as
inherited risk. No migration, runtime, renderer, physics, or product
integration workaround is permitted.
