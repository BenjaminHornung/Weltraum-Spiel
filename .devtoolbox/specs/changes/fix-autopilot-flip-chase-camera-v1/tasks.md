# Tasks

- [x] 1. Document analysis and acceptance criteria
  - Create proposal, design, behavioral spec, and implementation tasks.
  - Explain why normal Chase smoothing helps translation but lags during fast rotational flips.

- [x] 2. Add flip-aware diagnostics and detection to `SimpleFollowCamera`
  - Cache optional `PrototypeWaypointAutopilot` and `Rigidbody` from the target hierarchy.
  - Detect `FlipForBrake` and high angular velocity assist conditions.
  - Expose requested read-only diagnostics.

- [x] 3. Stabilize ChaseLocked during autopilot flips
  - Preserve normal ChaseLocked smoothing for ordinary movement.
  - Apply stronger flip-only position/rotation catch-up and reduced focus smoothing.
  - Add `AutopilotFlipChaseReferenceMode` and default to `VelocityOrPrevious`.
  - Add viewport safety snap/max-smoothing behavior.
  - Decouple rapid flip up-vector behavior from hard `target.up` binding.

- [x] 4. Add PlayMode regression coverage and evidence output
  - Add or extend PlayMode tests for a FlipForBrake-like high-angular-rate ChaseLocked sequence.
  - Verify viewport safety, bounded anchor error, catch-up time, and assist activation.
  - Write protocol, CSV, and before/during/after screenshots under this change's `tests` folder.

- [x] 5. Verify and review
  - Run relevant Unity validation and PlayMode tests, including existing camera jitter/bounds coverage.
  - Run available project build/test checks that are practical in the local workspace.
  - Record exact commands and outcomes in `tests/test-protocol.md`.
