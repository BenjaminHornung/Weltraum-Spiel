# Tasks

Ownership rule: only Agent 0 and later Agent 6/7 may edit this file or toggle tasks. All workers reuse the single change execution and may add milestone notes, but must not create another execution.

## Task 1 — Contracts and Reuse Audit (Agent 0)
- [ ] Define and unit-test renderer-independent surface-play contracts.
- [ ] Record pinned main/remote/PR/historical reuse evidence and implementation risks.
- [ ] Validate the change and complete focused build/test/scope/import/secret checks.

## Task 2 — Locomotion and Collision (Agent 1)
- [ ] Implement fixed-tick walk, sprint, jump, grounded transitions, Hestia gravity, capsule/ground queries, slope/step behavior, and deterministic collision without snaps or velocity-zero shortcuts.
- [ ] Prove stale frame/revision rejection and mode-owned input.

## Task 3 — Surface Combat (Agent 2)
- [ ] Adapt Pulse Cutter resource/permission/hit flow to the existing Combat Core and implement Survey/Security drone damage/destruction projection.
- [ ] Prove energy, heat, cooldown, rejection, event ordering, and no presentation-authored damage.

## Task 4 — Hestia Presentation (Agent 3)
- [ ] Present deterministic bounded Hestia terrain, player, drone, visible industrial cutter, impact effects, lighting, and low-poly/microvoxel atmosphere from derived snapshots.
- [ ] Preserve Surface Lab and prove renderer lifecycle/authority isolation.

## Task 5 — Voxel Impact Authority (Agent 4)
- [ ] Convert accepted terrain hits into revision-bound `SubtractSphere` commands through existing Adaptive/Structural authority.
- [ ] Prove quantization, changed-brick ordering, stale/duplicate/no-change/rejected behavior, revision/hash receipts, and remesh publication.

## Task 6 — Suit HUD (Agent 5)
- [ ] Implement a small player-facing Suit HUD for mode, movement/grounded state, energy, heat, cooldown, target condition, and latest action/rejection.
- [ ] Prove accessibility and absence of worker/hash/queue/debug telemetry.

## Task 7 — Integration and Route (Agent 6)
- [ ] Wire the complete slice behind exactly `?surfacePlay=1` with deterministic startup and explicit lifecycle cleanup.
- [ ] Prove `?surfaceLab=1` remains unchanged and surface input cannot leak into flight/planner/terminal modes.
- [ ] Integrate verified worker changes and update/toggle tasks only after fresh evidence.

## Task 8 — E2E, Evidence and Documentation (Agent 7)
- [ ] Add normal-route E2E coverage and screenshot/evidence matrix for locomotion, drone combat/destruction, terrain edit revision, HUD, visual identity, reload, and rejection paths.
- [ ] Reconcile implementation status and evidence without overstating global planet or orbit transition support.
- [ ] Run completion preflight and toggle only evidence-backed tasks.

## Task 9 — Review and Full Verification (Agent 7)
- [ ] Run focused technical review, resolve findings, and rerun affected checks.
- [ ] Run TypeScript, focused/full unit, production build, relevant E2E groups, diff/scope/forbidden-import/secret audits, and final human Plannotator review.
- [ ] Record final execution evidence, blockers, cleanup state, and residual risk.