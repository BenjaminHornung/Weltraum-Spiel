# Tasks: browser-flight-feel-rcs-sas-parity-v1

- [x] Task 1: Establish the browser-native manual flight feel baseline
  - Objective: Make Cruise, Precision, and Translation feel like distinct control profiles instead of a shared generic flight mode.
  - Files/search targets: `apps/weltraum-browser/src/runtime/input.ts`, `apps/weltraum-browser/src/flight/flightController.ts`, `apps/weltraum-browser/src/core/types.ts`.
  - Acceptance criteria: Mode changes update authority and feel; Precision is not a Cruise alias; existing manual/idle protections remain intact.
  - Implementation guidance: Reuse existing mode/state seams, add mode-specific response shaping, and keep the executor safety contract untouched.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`, DevToolbox spec/task flow when executing from this change.
  - Verification: focused unit/runtime checks for mode gating plus a browser/manual walkthrough.
  - Report-back format: changed files, mode behavior summary, verification evidence, remaining gaps.
  - Stopping rule: Stop once the three modes are behaviorally distinct and no safety regression is observed.
  - Suggested implementation prompt: "Implement browser-native Cruise/Precision/Translation feel differentiation without changing manual/idle executor protections."

- [ ] Task 2: Add persistent throttle spool and inertia
  - Objective: Replace direct-feeling throttle application with a persistent applied-throttle model.
  - Files/search targets: `apps/weltraum-browser/src/flight/flightController.ts`, `apps/weltraum-browser/src/core/types.ts`, `apps/weltraum-browser/src/flight/executor.ts`.
  - Acceptance criteria: Throttle has commanded vs applied behavior, ramps smoothly, and does not snap to zero when manual input is absent.
  - Implementation guidance: Introduce a browser-side spool/lag curve and keep the no-snap/no-idle-zero contract explicit in telemetry.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`, DevToolbox spec/task flow when executing from this change.
  - Verification: targeted unit checks for ramping and idle preservation.
  - Report-back format: before/after throttle behavior, updated telemetry, verification result.
  - Stopping rule: Stop when throttle changes read as persistent and stable rather than immediate.
  - Suggested implementation prompt: "Add browser throttle spool/inertia while preserving manual/idle request semantics."

- [ ] Task 3: Implement explicit Cruise / Precision / Translation authority rules
  - Objective: Make mode semantics explicit for main thrust, RCS, and manual rotation/translation intent.
  - Files/search targets: `apps/weltraum-browser/src/flight/flightController.ts`, `apps/weltraum-browser/src/runtime/input.ts`, `apps/weltraum-browser/src/core/types.ts`.
  - Acceptance criteria: Cruise allows main-thrust flight; Precision emphasizes RCS attitude control; Translation emphasizes RCS linear movement; each mode reports its authority clearly.
  - Implementation guidance: Keep the mode contract data-driven and avoid new hidden branches in the executor.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`, DevToolbox spec/task flow when executing from this change.
  - Verification: mode-transition checks and state snapshots.
  - Report-back format: mode matrix, authority changes, evidence.
  - Stopping rule: Stop when each mode has an unambiguous authority profile.
  - Suggested implementation prompt: "Wire explicit browser authority rules for Cruise, Precision, and Translation."

- [ ] Task 4: Separate RCS translation from rotation behavior
  - Objective: Make linear translation and attitude rotation distinct in behavior and telemetry.
  - Files/search targets: `apps/weltraum-browser/src/flight/flightController.ts`, `apps/weltraum-browser/src/core/types.ts`.
  - Acceptance criteria: Translation commands and rotation commands are independently observable; translation authority does not masquerade as rotation authority.
  - Implementation guidance: Keep the existing `allowRcsTranslationOutsideTranslationMode` seam explicit and avoid copying Unity nozzle hierarchy.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`, DevToolbox spec/task flow when executing from this change.
  - Verification: controller-level checks on translation versus rotation output.
  - Report-back format: authority split summary, telemetry change list, verification result.
  - Stopping rule: Stop when translation and rotation can be explained independently in telemetry.
  - Suggested implementation prompt: "Split browser RCS translation and rotation authority cleanly."

- [ ] Task 5: Upgrade SAS to a readable stabilization contract
  - Objective: Make the existing SAS damping path player-readable and decide explicitly whether HoldAttitude remains deferred.
  - Files/search targets: `apps/weltraum-browser/src/flight/flightController.ts`, `apps/weltraum-browser/src/core/types.ts`.
  - Acceptance criteria: SAS reports effectiveness, respects authority availability, and has deterministic damping/stabilization evidence; any HoldAttitude work is either implemented with tests or explicitly deferred.
  - Implementation guidance: Use current angular state and intent inputs; do not depend on Unity rigidbody math, exact coefficients, or a hidden autopilot steering path.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`, DevToolbox spec/task flow when executing from this change.
  - Verification: targeted stabilization checks plus browser evidence.
  - Report-back format: SAS behavior summary, ineffective-state handling, evidence.
  - Stopping rule: Stop when SAS has explicit readable state and does not silently act outside authority.
  - Suggested implementation prompt: "Implement readable browser SAS stabilization/effectiveness using the existing damping path as the v1 base; document or test any HoldAttitude decision explicitly."

- [ ] Task 6: Stage browser-native RCS visualization and marker feedback
  - Objective: Provide a no-GLB-dependent visualization path for RCS activity and control feel.
  - Files/search targets: `apps/weltraum-browser/src/**` for telemetry consumers and rendering hooks; avoid `Assets/**` changes.
  - Acceptance criteria: Visualization can be staged with browser-native markers/debug primitives and does not require nozzle hierarchy discovery.
  - Implementation guidance: Start with data plumbing and marker placement; do not block on art asset integration.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`, `playwright` or browser evidence capture tools when visual evidence is required.
  - Verification: screenshot/evidence of markers or status surfaces, plus telemetry confirmation.
  - Report-back format: staging plan implemented, visual evidence, remaining art dependency risk.
  - Stopping rule: Stop once the visualization path is decoupled from GLB/socket assumptions.
  - Suggested implementation prompt: "Add browser-native RCS marker visualization without coupling to GLB assets."

- [ ] Task 7: Expand HUD telemetry and status labels
  - Objective: Make the player-facing HUD explain why controls are active, disabled, or ineffective.
  - Files/search targets: browser HUD/state consumers plus `apps/weltraum-browser/src/core/types.ts`.
  - Acceptance criteria: HUD exposes readable labels for mode, throttle, RCS, SAS, and assist state instead of raw flags only.
  - Implementation guidance: Mirror the clarity of the Unity HUD labels but keep the browser UI native and compact.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`, `playwright` when browser UI/evidence is required.
  - Verification: browser screenshot/evidence and state inspection.
  - Report-back format: UI/telemetry changes, screenshots, and any residual ambiguity.
  - Stopping rule: Stop when the player can tell why a system is on, off, or ineffective at a glance.
  - Suggested implementation prompt: "Surface readable browser flight status labels for mode, throttle, RCS, and SAS."

- [ ] Task 8: Capture Playwright evidence for flight feel and camera isolation
  - Objective: Prove the new feel contract with browser evidence rather than assumptions.
  - Files/search targets: browser runtime and evidence capture paths only; no asset/package edits.
  - Acceptance criteria: Evidence shows mode switching, throttle changes, RCS/SAS behavior, and camera changes that do not alter control authority.
  - Implementation guidance: Use a short scenario script with explicit before/after snapshots and console checks.
  - Required skills/MCPs: `playwright`, `verification-before-completion`.
  - Verification: Playwright snapshot/screenshot evidence plus console scan.
  - Report-back format: scenario list, evidence paths, and any failed assertions.
  - Stopping rule: Stop when the browser evidence demonstrates the feel contract clearly.
  - Suggested implementation prompt: "Record Playwright evidence for flight-feel parity and camera isolation."

- [ ] Task 9: Add regression checks for no-snap / no-idle-zero behavior
  - Objective: Protect the executor contract while flight feel changes land.
  - Files/search targets: `apps/weltraum-browser/src/flight/executor.ts`, `apps/weltraum-browser/src/flight/flightController.ts`, relevant tests if added later.
  - Acceptance criteria: Manual/idle preservation remains intact and no new path zeroes or snaps flight requests when input is absent.
  - Implementation guidance: Treat this as a contract regression task, not as a feel-tuning task.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`, DevToolbox spec/task flow when executing from this change.
  - Verification: targeted regression coverage for idle preservation and request continuity.
  - Report-back format: regression summary, protected contract, verification evidence.
  - Stopping rule: Stop when the no-snap/no-idle-zero behavior is explicitly covered.
  - Suggested implementation prompt: "Add regression coverage for executor no-snap/no-idle-zero protections."
