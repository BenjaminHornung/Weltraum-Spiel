# Tasks: Autopilot Arrival Terminal Capture Stability

- [ ] 1. Baseline evidence collection
  - Capture current `DirectFastTransfer` arrival behavior in PlayMode.
  - Record baseline terminal metrics:
    - terminal capture entry/exit times,
    - brake throttle ramps and spikes,
    - terminal hold duration,
    - arrival settle completion latency.
  - Store baseline artifacts in `.devtoolbox/specs/changes/stabilize-autopilot-arrival-terminal-capture-v1/tests/`.

- [ ] 2. Add terminal capture gate and taper/release envelope plan
  - Apply conservative terminal capture arming and hold states to prevent rapid entry/exit.
  - Add:
    - throttle taper window,
    - minimum taper-to-hold transfer,
    - release gate requiring stable alignment/speed condition for a short window.
  - Keep emergency/safety direct branches unchanged.

- [ ] 3. Add EditMode tests
  - Verify stable terminal capture arming requires windowed consistency.
  - Verify immediate safety branches bypass taper/release gates.
  - Verify capture hold prevents re-accel and respects brake taper profile under synthetic jitter.

- [ ] 4. Add PlayMode and DirectFastTransfer regression evidence
  - Run DFT arrival scenarios with near-terminal jitter and mild approach overshoot.
  - Capture post-fix logs/traces under `tests/` and compare against baseline.
  - Confirm terminal oscillation count and throttle reset/spike count are reduced.
  - Re-validate that arrival still completes in expected time bounds for nominal cases.

- [ ] 5. Final review and validation
  - Link proposal/design/spec/tasks and evidence notes.
  - Perform final review for scope and regression assumptions.
  - Verify all generated artifacts are under this change folder only.

