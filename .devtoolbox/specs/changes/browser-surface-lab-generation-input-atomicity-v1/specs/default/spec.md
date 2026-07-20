# Capability: Browser Surface Lab Generation Input Atomicity V1

## Requirement: Validate before authoritative mutation

`regenerate` and `setResolution` SHALL validate candidate values locally and
SHALL commit `#seed` or `#voxelSizeMeters` only after successful generation
admission through `#beginGeneration`. Successful generation admission is the
authoritative input commit boundary. Admission-before-commit is preferred when
the existing code supports it without contract redesign. The synchronous
atomicity guarantee applies to pre-admission/setup failures. A defensive/test-
only rejection of `ticket.result` after admission SHALL keep the newly admitted
seed/resolution authoritative, surface through existing
generation-failure/lifecycle semantics, and SHALL not roll back admitted
epochs/jobs. Errors SHALL not be swallowed.

## Requirement: Rejected starts preserve state

WHEN generation admission does not occur, THEN seed, voxel size,
generation/planning epoch, lifecycle failure semantics, published artifacts,
Brick/Mesh hashes, Ready/Failed/Queue/Running metrics, cache/presentation
mapping, and temporally consistent telemetry SHALL be preserved.

### Scenario: stopped pool rejects regeneration

- Given a stopped pool and an existing valid controller state
- When `regenerate(newSeed)` is requested
- Then the request fails closed without mutating authoritative inputs, epoch,
  artifacts, hashes, metrics, cache/presentation mapping, or telemetry

### Scenario: stopped pool rejects resolution change

- Given a stopped pool and an existing valid controller state
- When `setResolution(0.25)` is requested
- Then the request fails closed without mutating authoritative inputs, epoch,
  artifacts, hashes, metrics, cache/presentation mapping, or telemetry

### Scenario: replacement failure remains terminal

- Given a replacement generation fails
- When the failure is reported
- Then the lifecycle reaches the existing Failed/Stopped state
- And later input attempts cannot mutate controller state

## Requirement: Successful admission commits one coherent input

WHEN a valid generation is admitted, THEN the corresponding candidate SHALL
become authoritative as one atomic transition and all generated payload and
published telemetry SHALL describe that same input.

### Scenario: valid seed regeneration

- Given a running controller and a valid replacement seed
- When `regenerate(newSeed)` is admitted
- Then the new seed is authoritative
- And the planning epoch advances exactly `+1`
- And the generation payload uses the new seed

### Scenario: valid resolution change

- Given a running controller and a valid resolution
- When `setResolution(0.25)` is admitted
- Then the new resolution is authoritative
- And the payload, physical extent, and telemetry are mutually consistent

## Requirement: Invalid and exceptional inputs fail closed

Invalid inputs SHALL not mutate authoritative or published state. A
pre-admission/setup exception SHALL not leave a half-commit, and SHALL retain
the existing error and lifecycle failure semantics. Existing per-job
enqueue-failure accounting and backend-initialization behavior SHALL remain
unchanged. Current production WorkerPool behavior resolves terminal values;
rejected-promise coverage is defensive only and SHALL not change WorkerPool or
public contracts.

### Scenario: invalid input

- Given any valid controller state
- When an invalid seed or resolution is supplied
- Then the input is rejected without mutation

### Scenario: synchronous start exception

- Given a valid candidate and a generation/start operation that throws
  synchronously
- When the operation fails
- Then no half-commit is observable and all specified invariants are preserved

### Scenario: defensive post-admission result rejection

- Given a generation request has been successfully admitted
- When the defensive/test-only `ticket.result` promise rejects
- Then the newly admitted seed/resolution remains authoritative
- And the admitted epoch/job is not rolled back
- And the existing generation-failure/lifecycle semantics surface the rejection

## Requirement: Existing stability contracts remain intact

The implementation and tests SHALL preserve existing stability behavior and
SHALL not weaken assertions. The focused and full verification gates SHALL
retain the approved Node 22 matrix and acceptance counts: live `14/14`, E2E
inventory `30/30` exactly once, Hestia `16/16`, queue/running `0/0`, same-seed
hash equality, changed-seed hash inequality, and browser health `0/0/0/0`.

## Requirement: Publication gates occur in the approved order

The handoff SHALL proceed in this order: implementation/tests, full
verification, canonical and reviewer-GLM reviews with confirmed fixes, a
pre-publication scope check, the final Plannotator human review, normal commit
and non-force push on the same branch, PR body and thread cleanup, and exact-
head Codex review/checks. Human review SHALL occur before commit or push. Merge
is forbidden.

The commit subject SHALL be exactly
`#WELTRAUM-000 Preserve Surface Lab generation inputs`; amend, rebase, squash,
and force-push SHALL NOT be used. The PR body SHALL state local Live `14/14`
with `workers=2`, CI `workers=1`, `Stability fixes complete`, `Generation Input
Atomicity complete`, and `Visual Fidelity DEFERRED_KNOWN_FAILING`.

## Requirement: PR evidence and exact-head closure

Each named thread SHALL be evidenced individually before resolution: Chunk
Loading Failure, Aggregate Region Mesh Budget, Retained Snapshot Buffers,
Pinned Cache Telemetry, Hestia Unit Timeout, and Preserve Inputs. Each evidence
record SHALL include the fix SHA, path, and test.

The exact-head Codex comment SHALL contain exactly these three lines:

```text
@codex review
Please review the exact current PR head <NEW_HEAD_SHA>.
All prior P1/P2 findings and the generation-input atomicity issue have been addressed. Please perform a fresh exact-head review.
```

The handoff SHALL close only when the exact-head review has no P0/P1/P2
findings, all threads are resolved, checks are green, the PR is mergeable, the
head is unchanged, and the tree is clean. The change SHALL NOT be merged.
