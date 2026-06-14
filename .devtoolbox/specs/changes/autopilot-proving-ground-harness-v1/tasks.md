# Tasks: Autopilot Proving Ground Harness v1

- [x] 1. Create DevToolbox change scaffold
  - Add proposal, design, tasks, and spec artifacts for the proving-ground change.

- [x] 2. Add read-only diagnostics
  - Expose terminal/brake latch flags needed by the harness without changing control behavior.

- [x] 3. Add programmatic PlayMode harness
  - Build deterministic scenarios in code.
  - Run scripted physics without manual Game View observation.
  - Capture per-FixedUpdate metrics.

- [x] 4. Write evidence artifacts
  - Write per-scenario CSV files under `tests/performance/`.
  - Write summary JSON and `test-protocol.md`.

- [x] 5. Verify
  - Run Unity MCP script validation.
  - Run focused PlayMode proving-ground tests; expected current gameplay-quality failures are captured in `tests/test-protocol.md`.
  - Run `dotnet build "Weltraum Spiel.sln" --no-restore`.
  - Run `specs_validate autopilot-proving-ground-harness-v1`.
