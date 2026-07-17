# Suit Survival State Core V1 Test Protocol

## Preconditions

- Node 22; run commands from `apps/weltraum-browser` unless stated otherwise.
- Exact changed-path allowlist from proposal; package/lock unchanged; E2E ungrouped.
- Browser proof uses normal `/`; no screenshots and no `window.TestBridge`.

## Deterministic unit matrix

The normative matrix has exactly 32 user checks; these identifiers do not claim Vitest or Playwright case numbering. The focused suit unit suite currently contains 64 behavior tests as freshly reported, but that count does not alter this matrix. Unit checks 1–30 are: 1 ID validation; 2 scalar/safe-int bounds; 3 `-0`; 4 frozen/caller non-mutation; 5 same signatures; 6 input-order invariance; 7 aggregate 100 versus 100 singles with commands executed once immediately before designated in-window ticks; 8 all five workloads; 9 mode CAS; 10 pre-mutation whole-schedule and previously accepted duplicate rejection; 11 backward tick and deterministic out-of-window rejection; 12 oxygen/energy >=0 with saturating arithmetic; 13 no silent capacity excess; 14 deterministic starvation and phase-4 subsystem power/effects before phase-5 exposure energy; 15 bus-offline snapshot; 16 composed/net leak and oxygen rates; 17 oxygen-depleted health; 18 inclusive temperature critical alerts, strictly-outside health damage, and recovery; 19 radiation monotonic; 20 filter only incoming contamination; 21 decontaminate; 22 immutable `SuitRecoveryRules` per-command limits plus definition-maximum and initial-state seal/health repair ceilings; 23 Faulted immutability until repair plus fault/repair subsystem events; 24 deterministic alert sort and binary `SubsystemFault` `1/1`; 25 canonical alert derivation or exact caller-set validation, direct raise/clear, and consolidated phase-11 aggregate deltas without duplicates; 26 incapacitation; 27 `NoChange`; 28 unknown mode/roles fail closed and equipment state-definition matching; 29 no DOM/Three/Date/Random/TestBridge; 30 signed quotient/remainder without `-0`, safe saturation, stable bounded regex-valid <=128-character derived alert IDs/remainder keys, and byte-identical aggregate/repeated state/events/results. Browser check 31 is repeat byte-identical. Browser check 32 is health `0/0/0/0`.

## Node 22 command sequence

```powershell
npm ci
npx tsc -p tsconfig.json
npx vitest run tests/unit/suit*.test.ts --maxWorkers=1
npm run test -- --maxWorkers=4
npm run build
npm run test:e2e -- tests/e2e/suit-survival-state-core.spec.ts --workers=1 --retries=0
git diff --check
```

If the shell does not expand the unit glob, enumerate the concrete `tests/unit/suit*.test.ts` files in lexical order and pass them to the same Vitest command with `--maxWorkers=1`; record the exact expansion. Any nonzero command stops the protocol.

## Browser proof

Before navigation, register Playwright collectors for console errors, uncaught page errors, failed requests, and HTTP responses >=400. Navigate to normal `/`; assert `window.TestBridge` is absent. Dynamically import only `/src/suit/index.ts` and run twice the canonical scenario: Nominal → Walk → damaged seal → high equipment draw/starvation → radiation plus contamination → oxygen critical → Emergency → recharge/resupply. Assert expected raised and cleared alerts, starvation/bus behavior, actual recharge/resupply, and byte-identical state/event signatures between runs. Final health counts SHALL be exactly console errors 0, page errors 0, request failures 0, HTTP >=400 failures 0 (`0/0/0/0`); there is no warnings counter.

## Changed-path and invariant scans

From repository root, inspect `git diff --name-only` plus untracked files and fail unless every path is exactly within:

```text
.devtoolbox/specs/changes/browser-suit-survival-state-core-v1/**
apps/weltraum-browser/src/suit/**
apps/weltraum-browser/tests/unit/suit*.test.ts
apps/weltraum-browser/tests/e2e/suit-survival-state-core.spec.ts
apps/weltraum-browser/evidence/browser-suit-survival-state-core-v1-summary.json
apps/weltraum-browser/evidence/browser-suit-survival-state-core-v1.md
docs/browser-mainline/suit-survival-state-core-v1.md
```

Fail if package/lock files differ. Fail on changed `main.ts`, `style.css`, combat/resources/ship-builder/interaction/surface-lab/voxel/workers, Vite/Playwright config, `.github`, infra, or Unity paths. Scan suit source and test imports/APIs for DOM globals, `three`, `Date`, `Date.now`, `performance.now`, `Math.random`, crypto randomness, timers used as simulation time, and `TestBridge`; allow textual negative assertions only in the E2E. Confirm the E2E appears in no package/group inventory. Run the repository-approved secret scan over all changed files without printing candidate secret values.

## Evidence reproducibility

Generate the two named timestamp-free evidence files from the deterministic scenario. Hash both files, preserve copies outside the repository test output, regenerate from a clean invocation, hash again, and byte-compare pass 1 versus pass 2. Both files and hashes SHALL match byte-for-byte; JSON canonical key/order and Markdown order SHALL be stable. Evidence SHALL contain no timestamps, machine paths, random IDs, ports, screenshots, or environment-dependent values.

## Cleanup

Whether E2E passes or fails, terminate only the server process started by this protocol and verify its selected port has no remaining listener. Do not kill unrelated processes. Record cleanup result and the exact `0/0/0/0` collector health.

## Review and completion gates

After all fresh checks, obtain independent `reviewer` and `reviewer-GLM` review; resolve and reverify concrete findings. Run DevToolbox completion preflight only after verification evidence exists. Then conduct exactly one final human review and record its decision. Do not create a PR, merge, archive, or assign the E2E to CI/package grouping.

Only with explicit publication authorization: commit exactly `#WELTRAUM-000 Add suit survival state core`, non-force push `feature/browser-suit-survival-state-core-v1`, and confirm with `git ls-remote`. Otherwise do not commit or push.

## Result record

Report changed files, coverage of unit checks 1–30 and browser checks 31–32, exact command results, browser collector counts, evidence hashes and byte comparisons, scan outcomes, port cleanup, reviewer dispositions, completion preflight, the single human review, blockers, and remaining unverified risk. Do not claim final full verification until every gate has actually passed.
