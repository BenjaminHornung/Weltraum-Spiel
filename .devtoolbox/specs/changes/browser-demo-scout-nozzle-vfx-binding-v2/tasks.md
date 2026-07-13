# Tasks: Browser Demo Scout Nozzle VFX Binding v2

## Task 1 - Freeze telemetry and nozzle contracts

- [x] Add separated applied main and RCS-translation telemetry with documented
      frames and preserve the combined vector.
- [x] Add and validate the twenty-nozzle Demo Scout registry plus exactly six
      position-only procedural legacy bindings.
- [x] Prove clone/serialization behavior and unchanged XYZ acceleration sums.

## Task 2 - Bind and select nozzle VFX

- [x] Resolve GLB nodes through a deterministic name index with per-nozzle
      missing/duplicate/ambiguous/reuse/invalid fallback diagnostics.
- [x] Select translation and torque-compatible puffs from owner telemetry with no
      visibility floor or parity heuristic.
- [x] Preserve current main/RCS styling and expose discriminated directional and
      legacy-marker snapshot metadata.

## Task 3 - Verify and record evidence

- [x] Run focused nozzle, simulation, and flight-controller unit tests.
- [x] Run the full unit suite and production build.
- [x] Run gated debug-scene browser evidence and render-smoothing/flight-UI
      regressions after fixed port 5173 is available.
- [x] Record exact commands, results, date, branch, and evidence source in the
      test protocol.
- [x] Run diff/package/asset guardrails.
- [ ] Pass exact-head pull-request CI before merge.

The exact-head pull-request CI box remains the external merge gate. All local
implementation and verification boxes require independent completion preflight.
