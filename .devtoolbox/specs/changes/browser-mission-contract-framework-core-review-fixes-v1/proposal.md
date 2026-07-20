# Mission Contract Framework Core Review Fixes

## Why

The exact-head Codex review of the integrated mission contract core identified four correctness and CI-coverage gaps: the focused mission proof is not assigned to an E2E group, an earlier failure condition can be bypassed by a later expiry, non-finite progress can escape as an exception while fingerprinting, and a non-terminal objective failure does not refresh sequential availability. Follow-up exact-head reviews additionally identified Offered-state terminalization and failed-prerequisite availability edge cases.

## What Changes

- Assign the mission contract Playwright spec to `test:e2e:core`.
- Select the required terminal transition by the earliest due failure/expiry tick for Accepted and Active missions, retaining expiry precedence only when expiry is earlier or tied.
- Preserve absolute expiry for Offered missions without requiring the unavailable `failMission` transition.
- Convert command fingerprint/canonicalization failures into typed `INVALID_COMMAND` rejections.
- Refresh objective availability after a non-terminal objective failure, including explicit successor prerequisites.
- Add focused regression tests and verification evidence.

## Scope

Only mission core implementation/tests, the focused E2E group declaration in `package.json`, and this DevToolbox change/evidence are in scope.

## Non-goals

No UI, economy, cargo, faction, world, navigation, interaction, suit, persistence-queue, scheduler-integration, dependency, or lockfile changes. No simulation scheduler branch or integration is introduced.
