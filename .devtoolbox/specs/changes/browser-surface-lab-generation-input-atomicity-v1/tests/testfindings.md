# Surface Lab Generation Input Atomicity V1 - Test Findings

## Findings

- No open P0-P3 technical or visual findings remain in the observed test and
  evidence scope.
- Final human review and the evidence mirror remain pending outside this file.
  This record does not claim ticket completion or human approval.

## Final verification results

| Check | Final result |
| --- | --- |
| Toolchain | Portable Node `v22.23.1`; TypeScript **PASS** |
| Focused unit test | `surfaceLabController.test.ts` **PASS**, 39/39 |
| Focused Playwright RUN A | **PASS**, 2/2; explicit Chrome, 1 worker, 0 retries |
| Focused Playwright RUN B | **PASS**, 2/2; explicit Chrome, 1 worker, 0 retries |
| Retained-evidence determinism | **PASS**, 7/7 retained files SHA-256 byte-identical between RUN A and RUN B; exact forward-slash matcher used |
| Full canonical E2E | **PASS**, 56/56 in 6.4m; 30 unique specs exactly once; 0 failures, skips, or retries |
| Canonical groups | Core: 17 specs/30 tests; Live: 9/14; UI: 4/12; Hestia: 2/2 |
| Retained PNGs | **PASS**, 5/5 valid, non-empty PNGs at exactly `1920x1080` |
| Independent visual audit | **PASS**, no P0-P3 finding |

The full-run retained evidence was 7/7 SHA-256-equal to the RUN-A candidate.

## Hestia runtime and artifact invariants

- All five ordered scenarios reached `Ready` with readiness counters `16/16/0`
  and queue/running `0/0`.
- Same-seed regeneration preserved ordered brick and mesh hashes; changed-seed
  regeneration produced different hashes.
- All seven browser-health counters were zero.
- The manifest parses and contains the five roles in order, with every required
  field and repository-relative path. It contains no timestamp, absolute
  machine path, or secret.
- The generated Markdown lists all five roles and paths and states the visual
  evidence boundary.

## Independent visual audit

- Across all five screenshots, the HUD, controls, technical telemetry, `Ready`
  state, and intact terrain are visible. Scenario data matches the recorded
  role.
- The wireframe/boundaries state and deterministic Orbit camera view are
  plausible and consistent. The quarter-meter state shows `0.25 m` and
  `32 x 16 x 32 m`.
- No error, obstructing overlay, important clipping, broken render area, or
  secret exposure was observed.
- Timing labels and rows remain visible. Only the four volatile generation,
  meshing, upload, and frame-time value glyphs are transparent in retained PNG
  pixels after their live value assertions.

## Evidence boundary

Pixels prove visible states only. Admission, Promise rejection, epoch commit,
stale-result suppression, rollback, defensive rejection, and generation-input
atomicity semantics are proven by focused unit tests together with runtime
telemetry and hashes, never by pixels alone. Long ordered hash lists remain
manifest-backed where the HUD cannot display every value comfortably.

## Execution history

- The initial evidence attempt had an infrastructure-only browser-launch
  failure. One bounded retry with explicit Chrome then passed 2/2; this was not
  a product failure.
- Later hardening identified volatile timing glyphs and one-RAF-frame camera
  drift after the 450 ms `W` movement. Test-only correction used
  screenshot-scoped timing-glyph transparency after live assertions, followed
  by the public Reset view and deterministic Orbit drag/two-RAF barrier.
- A visible HUD decimal-format assertion mismatch and a pre-test backslash
  matcher error were corrected under stop/restore discipline. Neither was a
  product failure.
- Existing DevToolbox execution `fc5f2583651d4d59a15d551694757854` was reused.
  No new execution was created.

## Cleanup and scope

- All 96 tracked root-evidence outputs were restored to `HEAD`; root-evidence
  diff: 0.
- Final repository scope: exactly 16 status paths, staged: 0, package/lock
  changes: 0, `git diff --check`: **PASS**, secret findings: 0.
- Port 5173 is free and test-owned process count is 0. Existing foreign
  listeners on 4200/7000 and old foreign `test-results` were left untouched.
- No commit, push, PR update, merge, publication, or deployment occurred.

## Pending external gates

Final human review and the evidence mirror remain pending outside this findings
file. No ready, complete, approved, merged, or published state is asserted here.
