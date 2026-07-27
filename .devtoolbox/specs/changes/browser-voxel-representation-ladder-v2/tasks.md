# Tasks: Browser Voxel Representation Ladder V2

Base `origin/main`: `15f3550bd604856b25d40a7ac700ec4d5106b89e`.
Branch: `feature/browser-voxel-representation-ladder-v2`.
Every task remains open until fresh evidence and its own DevToolbox completion
preflight exist.

## Phase 1 - Contract and tracking

- [x] 1.1 Validate the proposal, ExecPlan/design, capability spec, task plan,
  test protocol, and initial findings; create exactly one execution.
  - Acceptance: all artifacts preserve Adaptive/Structural Authority, define a
    count-driven 1..32 product ladder, and agree on scope and verification.
  - Evidence: `specs_validate`, `tasks_load`, execution ID, `git diff --check`.

## Phase 2 - Descriptor and identity foundation

- [x] 2.1 Implement strict descriptor validation and immutable publication.
  - Acceptance: 1..32 bands, contiguous unique ranks, unique stable IDs,
    monotone error, exact keys, finite semantic values, pre-copy caps, defensive
    copies, recursive freeze, and a 12+-band fixture.
  - Evidence: focused descriptor tests and canonical vectors.

- [x] 2.2 Implement revision-bound object/region/tile proxy identity.
  - Acceptance: Adaptive canonical hashing is reused; camera/quality metadata is
    excluded; stale revision/hash/damage/edit bindings reject deterministically.
  - Evidence: focused proxy tests including damaged/intact rejection.

## Phase 3 - Selection, pins, and fallback

- [x] 3.1 Implement validated SSE, deterministic tie-breaks, hysteresis,
  culling, budgets, and separate render/simulation decisions.
  - Acceptance: distance is monotone, viewport/FOV projection is correct,
    insertion order cannot decide, Low/Ultra may render differently while
    Authority/Structural requirements and hashes stay equal.
  - Evidence: focused selection/quality tests and fixed decision hashes.

- [x] 3.2 Implement hard Level-4 interaction pins, lifecycle eviction, and
  count-driven atomic fallback.
  - Acceptance: every hard reason requests L4 independent of quality; missing
    coverage/budget fails closed; dirty/solving/active/unsettled/handoff states
    are not evictable; 0/partial/63-of-64/stale retain parent; 64-of-64 current
    children replace atomically.
  - Evidence: focused pin/lifecycle/fallback tests.

## Phase 4 - Settings migration and policy

- [x] 4.1 Add exact schema V2, explicit V1 migration, deterministic voxel
  defaults/presets, and immutable quality-policy adapter.
  - Acceptance: all V1 values survive; render distance and voxel detail distance
    remain independent; corrupt/invalid/future storage fails closed without
    overwrite; quality never changes Authority/Structural output; UI makes no
    Applied claim without a runtime consumer.
  - Evidence: focused schema/preset/storage/policy/adapter regressions.

## Phase 5 - Browser proof, evidence, and docs

- [x] 5.1 Add the normal-route E2E and deterministic evidence.
  - Acceptance: no TestBridge; Vite imports public core; 12+ bands, Low/Ultra,
    pins, hysteresis, stale rejection, and full fallback transition are proven;
    four browser-error lists are empty; spec occurs exactly once in core; two
    one-worker/no-retry runs write byte-identical timestamp-free evidence.
  - Evidence: focused Playwright output and file hashes.

- [x] 5.2 Reconcile browser-mainline/current-state documentation honestly.
  - Acceptance: implemented pure foundation and adapter ports are documented;
    absent planet streaming, proxy meshing, physics, collapse, and live settings
    integration remain explicit.
  - Evidence: exact changed-path and claim audit.

## Phase 6 - Review, verification, and publication

- [x] 6.1 Run the complete fresh Node-22 verification matrix and focused
  technical review; fix confirmed findings and rerun affected checks.
  - Acceptance: install/build/focused/full units/production build/inventory,
    focused E2E twice, core/live/ui E2E, evidence JSON, diff, secrets, imports,
    nondeterminism, Unity scope, lockfile, DevToolbox verification, and final
    Plannotator gate pass with no valid findings.
  - Evidence: test findings, reviewer report, DevToolbox results, human approval.

- [x] 6.2 Publish an exact-head open PR without merge.
  - Acceptance: clean logical commit(s) prefixed `#WELTRAUM-000`; re-fetch and
    merge current `origin/main` normally if it advanced; full reverify after a
    merge; push without force; PR title/body contract met; current-head CI,
    policy, dependency, and Codex review clean; all valid threads resolved; PR
    remains open and unmerged.
  - Evidence: base/head SHAs, remote branch, PR URL, exact-head checks/reviews.
