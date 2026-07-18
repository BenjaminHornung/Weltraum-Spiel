# Test Protocol: Browser Surface Interaction Core V1

## Baseline and isolation

- Approved source baseline: `origin/main` at `afa1fa4a`.
- Isolated worktree: `E:\Unity\Weltraum Spiel\Weltraum Spiel-browser-surface-interaction-core-v1`.
- Original Unity checkout remains untouched; this is browser-only work with no Unity Editor/MCP, Assets, Packages, ProjectSettings, scenes, prefabs, `.meta`, or asmdef activity.
- An early parent availability check looked only for a DevToolbox CLI/resources, so historical pre-dispatch records were not created; they are not invented or backfilled. The registered MCP tools worked later: `workspace_discover`, `specs_get_status`, and `specs_validate` succeeded, with validation covering all 4 tasks. Real executions are `be54107d7ec54203b17cb80641eba52c`, `9766201d66cb419686ccaf0160e0fc0e`, and fallback artifact-reconciliation execution `bbcaada1b762441896293be33e2db406`. The parent still owns completion preflights and task toggles, so all four checkboxes remain open.

## Required environment and commands

Use Node 22. From `apps/weltraum-browser`, run in order:

```text
npm ci
npx tsc -p tsconfig.json
npm run test -- tests/unit/interaction*.test.ts --maxWorkers=1
npm run test -- --maxWorkers=4
npm run build
<project-supported server on port 5201> + focused Playwright tests/e2e/surface-interaction-core.spec.ts
```

From the repository root, then run:

```text
git diff --check
forbidden-import scan
exact scope/allowlist scan
secret scan
reviewer
reviewer-GLM
DevToolbox completion preflight (only if it becomes available)
```

Recorded completion-state results: Node `22.23.1`; `npm ci` PASS; TypeScript (`npx tsc -p tsconfig.json`) PASS; focused units 52 PASS; full units 872 PASS; build PASS; diff, forbidden-import, exact scope/allowlist, and secret scans PASS; focused E2E on port 5201 PASS twice. The browser proof hash is `fnv1a32:6acc9712`. Evidence is timestamp-free and no screenshots were produced.

## Mandatory 18-case behavioral matrix

1. Deterministic decisions/hashes: repeat equivalent evaluations and compare canonical bytes and hashes.
2. Target tie-break: equal-ranked candidates resolve by stable target ID as the final tie-break.
3. Every block reason: individually trigger `OutOfRange`, `NoLineOfSight`, `NotReachable`, `MissingCapability`, `MissingTool`, `InsufficientEnergy`, `InsufficientResource`, `HazardTooHigh`, `PermissionDenied`, `IllegalWithoutOverride`, `TargetBusy`, `TargetStale`, `ActorIncapacitated`, and `ModeConflict`; include multi-failure precedence assertions.
4. Tool versus capability: prove the two requirements and reasons are independent and ordered.
5. Hold tick 0: start and explicitly complete without implicit progress.
6. Integer monotonic progress: advance by explicit integer ticks, reject fractional/regressing/invalid ticks, and clamp/reject beyond the declared boundary deterministically.
7. Policy interruptions: cover movement tolerance, damage, and focus loss for interrupting and non-interrupting policies.
8. No early completion: completion before required hold fails closed with no mutation.
9. Stale target/actor: mismatched target revision and actor revision each fail closed.
10. No-op no mutation: blocked, unavailable, cancelled, interrupted, early, and stale results have no mutation intent or consumption.
11. Permission versus legality: prove missing permission precedes illegality and legal override does not invent permission.
12. Hazard warn/block: tolerated hazard yields stable warning; excessive hazard blocks.
13. Canonical finite costs: negative, NaN, and Infinity costs reject; equivalent resource ordering canonicalizes; successful costs are nonnegative and finite.
14. Immutable/frozen: all inputs remain byte-equivalent and returned nested public values are frozen.
15. No Three/DOM/Date/Random: source/import scan and runtime checks find no Three.js, DOM authority, `Date`, `Math.random`, ambient clock, or random source.
16. Serialization/hash stability: key/input ordering and repeated execution produce byte-stable canonical serialization and hash.
17. Unknown verbs/capabilities: runtime-invalid verb and unknown required capability fail closed.
18. Normal browser: load `/`, verify TestBridge has no authority, dynamically import the Vite module, and execute the fixture without synthetic bridge authority.

## Browser fixture and evidence

The focused browser scenario uses deterministic IDs, revisions, and ticks for:

- a locked cargo door;
- a resource node;
- a repair terminal;
- an actor equipped with scanner and cutter;
- allowed `Scan`;
- `Extract` blocked by insufficient energy;
- hold-to-`Open` progression;
- stale completion rejection.

Write only timestamp-free task-owned outputs:

```text
apps/weltraum-browser/evidence/browser-surface-interaction-core-v1.json
apps/weltraum-browser/evidence/browser-surface-interaction-core-v1.md
```

Evidence integrity: JSON SHA-256 `07abc7448b615bf3d827577ea859e792996adc44e98ccc5c23e06418f593449f`; Markdown SHA-256 `5f4b3695482efae42b6d447aa9bce222286f4b8ae595d721e6b6fffda215a41e`.

No screenshot is required because the core makes no visible UI/render change. The focused E2E file is not added to an existing CI group.

## Scope audit

Allowed overall writes are exclusively:

```text
.devtoolbox/specs/changes/browser-surface-interaction-core-v1/**
apps/weltraum-browser/src/interaction/**
apps/weltraum-browser/tests/unit/interaction*.test.ts
apps/weltraum-browser/tests/e2e/surface-interaction-core.spec.ts
apps/weltraum-browser/evidence/browser-surface-interaction-core-v1*
one focused browser-mainline documentation file
```

Configuration, main/style, Surface Lab, voxel, workers, Ship Builder, Combat, Cargo, Persistence, UI, `.github`, infrastructure, Unity paths, and E2E CI-group membership are forbidden. Restore unrelated generated changes before completion.

## Review and completion rule

GLM's material precedence, canonicalization, and test findings were fixed, and a fresh reviewer passed. The browser proof subsequently passed twice. The focused E2E remaining unassigned to a CI group is an explicit user constraint and accepted residual; there are no unresolved material GLM findings. This records closure without claiming a GLM rerun.

Do not claim Done until the parent completes native DevToolbox verification/completion preflight and task toggles. After all gates, commit exactly `#WELTRAUM-000 Add surface interaction core` and non-force push the same branch. Do not create a PR, merge, archive, or force push.
