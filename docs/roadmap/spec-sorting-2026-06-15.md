# Spec Sorting - 2026-06-15

Read-only first pass over all 68 active `.devtoolbox/specs/changes` folders
(excluding `archive/`).

Groups:

- **A** Architecture/Hygiene
- **B** Navigation/Autopilot
- **C** UI/Input/Map
- **D** Data Contracts
- **E** Gameplay Slices
- **F** Archive/Reconcile

Status values: Complete, Reconcile-First, Active, Draft, Superseded.

Recommendations: Keep Active, Reconcile First, Archive Candidate, Superseded.

---

## Group A - Architecture/Hygiene

| Change | Status | Evidence | Blocker | Recommendation | Next Action |
| --- | --- | --- | --- | --- | --- |
| `clean-core-runtime-architecture-v1` | Complete (docs/spec setup) | Yes (test-protocol) | None | Keep Active - setup done, implementation tasks intentionally open | Start `Assets/_Weltraum` skeleton in a dedicated runtime change. |
| `performance-data-oriented-runtime-architecture-v1` | Reconcile-First | Yes (test-protocol) | 2 open commit/push closeout tasks | Reconcile First | Commit and push remaining slices, then archive. |
| `performance-job-system-runtime-phases-v2` | Draft | No (evidence-only folder, no proposal/tasks) | Missing scaffold | Keep Active or deliberately close scaffold | Restore proposal/tasks or document as historical evidence. |
| `performance-stability-hotpath-cleanup-v1` | Draft | No (evidence-only folder, no proposal/tasks) | Missing scaffold | Keep Active or deliberately close scaffold | Restore proposal/tasks or document as historical evidence. |
| `prototype-quick-wins-latent-bugs-v1` | Reconcile-First | Yes (test-protocol, acceptance-evidence) | No `tasks.md`, stale red-suite acceptance metadata | Reconcile First | Create `tasks.md`, reconcile acceptance metadata, then archive. |
| `prototype-regression-test-harness-v1` | Active | No (no tests directory) | 21 open tasks, large unfinished scaffold | Keep Active | Implement harness in dedicated runtime change. |
| `real-scale-world-architecture-v1` | Active (planning-only) | No (spec-only) | 31 open tasks, intentionally deferred | Keep Active - blocked by surface/cargo prerequisites | Wait for surface target descriptor and cargo contracts. |
| `weltraum-001-celestial-backbone` | Reconcile-First | Yes (test-protocol) | Tasks checked but tests folder only has protocol metadata | Reconcile First | Refresh execution artifacts or reconcile, then archive. |
| `fix-functional-blender-runtime-v3` | Draft | Partial (test-protocol exists but no proposal/tasks) | Missing scaffold | Keep Active or deliberately close scaffold | Restore proposal/tasks or document as historical evidence. |
| `fix-playmode-testscene-bootstrap-contamination-v1` | Complete | Yes (test-protocol, logs) | None | Archive Candidate | Run preflight, then archive. |
| `fix-imported-blender-movement-jitter-v1` | Complete | Yes (test-protocol) | None | Archive Candidate | Run preflight, then archive. |
| `fix-imported-functional-ship-spin-root-cause-v1` | Complete | Yes (test-protocol) | None | Archive Candidate | Run preflight, then archive. |
| `fix-runtime-hud-camera-bootstrap-regression-v1` | Complete | Yes (test-protocol, logs) | None | Archive Candidate | Run preflight, then archive. |

## Group B - Navigation/Autopilot

| Change | Status | Evidence | Blocker | Recommendation | Next Action |
| --- | --- | --- | --- | --- | --- |
| `fix-autopilot-exact-point-arrival-v1` | Complete | Yes (test-protocol, acceptance gate PASS) | None | Archive Candidate | Reconcile `docs/current-prototype-state.md` (done), then run preflight and archive. |
| `autopilot-proving-ground-harness-v1` | Complete | Yes (test-protocol, summary JSON, CSVs) | None - acceptance gate now PASS | Archive Candidate | Run preflight, then archive. |
| `fix-authoritative-flightplan-tracking-v1` | Complete | Yes (test-protocol) | None | Archive Candidate | Run preflight, then archive. |
| `fix-autopilot-flip-chase-camera-v1` | Complete | Yes (test-protocol) | None | Archive Candidate | Run preflight, then archive. |
| `fix-autopilot-plan-execution-fidelity-v1` | Complete | Yes (task evidence, logs, CSVs) | 1 open optional executor-extraction task | Archive Candidate | Clarify optional task as separate future work, then archive. |
| `fix-direct-fast-transfer-bangbang-v1` | Complete | Yes (test-protocol, logs) | None | Archive Candidate | Run preflight, then archive. |
| `fix-direct-fast-transfer-execution-smoothness-v1` | Complete | Yes (test-protocol) | None | Archive Candidate | Run preflight, then archive. |
| `harden-direct-fast-transfer-autopilot-regression-tests-v1` | Active | Yes (test-protocol) | 1 open reviewer task | Keep Active | Complete review task, then archive. |
| `player-autopilot-arrival-stability-v2` | Complete | Yes (test-protocol) | None | Archive Candidate | Run preflight, then archive. |
| `player-autopilot-authoritative-flight-plan-v1` | Active | Yes (test-protocol, screenshots) | 2 open tasks (verify, commit/push) | Keep Active | Complete verification and commit/push. |
| `player-autopilot-planner-followup-v1` | Active | Yes (test-protocol) | 3 open tasks (readability, brake authority, evidence) | Keep Active | Complete remaining planner follow-up tasks. |
| `prototype-autopilot-navigation-computer-v2` | Complete | Yes (test-protocol, logs) | None | Archive Candidate | Run preflight, then archive. |
| `stabilize-autopilot-arrival-terminal-capture-v1` | Complete | Yes (verification) | None | Archive Candidate | Run preflight, then archive. |
| `stabilize-autopilot-obstacle-replan-chatter-v1` | Complete | Yes (baseline + stabilized CSV, verification) | None | Archive Candidate | Run preflight, then archive. |
| `add-autopilot-obstacle-avoidance-v1` | Reconcile-First | Yes (test-protocol) | 4 open tasks but implementation/evidence recorded | Reconcile First | Reconcile task state against evidence, then archive or close. |
| `autopilot-large-local-test-range-v1` | Active (spec-only) | No (no test-protocol) | Blocked by `fix-autopilot-exact-point-arrival-v1` (now PASS) | Keep Active - prerequisite now met | Begin implementation planning for large-local-range harness. |
| `autopilot-v2-core-planner-executor-v1` | Active (spec-only) | No (no test-protocol) | 13 open implementation tasks | Keep Active | Implement V2 pure core planner/executor in dedicated runtime change. |

## Group C - UI/Input/Map

| Change | Status | Evidence | Blocker | Recommendation | Next Action |
| --- | --- | --- | --- | --- | --- |
| `unified-ui-input-mode-architecture-v1` | Active (planning-only) | No (spec-only) | 43 open tasks, intentionally deferred | Keep Active | Implement input mode state machine in dedicated runtime change. |
| `player-ui-redesign-foundation-v1` | Active (spec-only) | No (no test-protocol) | 11 open tasks | Keep Active | Implement UI foundation in dedicated runtime change. |
| `fix-player-hud-context-priority-v2` | Complete | Yes (test-protocol) | None | Archive Candidate | Run preflight, then archive. |
| `fix-player-hud-basic-debug-window-v1` | Reconcile-First | Yes (test-protocol) | 5 open tasks but evidence recorded | Reconcile First | Reconcile task state against evidence, then archive or close. |
| `fix-prototype-ui-performance-v1` | Active | Yes (test-protocol, EditMode/perf evidence) | 1 open manual PlayMode responsiveness task | Keep Active | Record manual PlayMode evidence, then close/archive. |
| `fix-prototype-usability-flight-feel` | Active | Yes (test-protocol) | 25 open tasks across UI/autopilot/visuals | Keep Active | Split remaining work into smaller follow-up changes. |
| `fix-flight-control-wasd-rcs-jitter-regression-v2` | Complete | Yes (test-protocol, screenshots) | None | Archive Candidate | Run preflight, then archive. |
| `player-hud-live-aspect-ratio-scaling-v1` | Reconcile-First | Yes (test-protocol, screenshots) | 6 open tasks, verifier gate blocked | Reconcile First | Reconcile task checkboxes, then archive or close. |
| `player-hud-textmeshpro-readability-v1` | Reconcile-First | Yes (test-protocol, findings) | 6 open tasks, verifier gate blocked | Reconcile First | Reconcile task checkboxes, then archive or close. |
| `player-mission-reward-ui-v1` | Reconcile-First | Yes (test-protocol, screenshots) | 5 open tasks, verifier gate blocked | Reconcile First | Reconcile task checkboxes, then archive or close. |
| `player-navigation-computer-ui-v1` | Reconcile-First | Yes (test-protocol, findings) | 6 open tasks, verifier gate blocked | Reconcile First | Reconcile task checkboxes, then archive or close. |
| `player-navigation-planner-ui-overhaul-v1` | Complete | Yes (screenshot matrix) | None | Archive Candidate | Run preflight, then archive. |
| `player-radar-minimap-v1` | Reconcile-First | Yes (test-protocol, findings) | 4 open tasks, verifier gate blocked | Reconcile First | Reconcile task checkboxes, then archive or close. |
| `player-target-indicators-v1` | Reconcile-First | Yes (test-protocol, findings, screenshots) | 5 open tasks, verifier gate blocked | Reconcile First | Reconcile task checkboxes, then archive or close. |
| `player-weapon-computer-controls-v1` | Active | Yes (test-protocol) | 7 open tasks | Keep Active | Implement weapon computer controls. |
| `player-world-label-readability-v1` | Active | Yes (test-protocol) | 6 open tasks | Keep Active | Implement label policy and capture evidence. |
| `player-ui-evidence-manifest-v1` | Active | Yes (test-protocol, manifest JSON) | 1 open push task | Keep Active | Push scoped manifest commit. |
| `player-ui-live-evidence-symmetry-v1` | Reconcile-First | Yes (test-protocol, findings, screenshots) | 5 open tasks, verifier gate blocked | Reconcile First | Reconcile task checkboxes, then archive or close. |
| `weltraum-002-orbit-map-prototype` | Reconcile-First | Yes (test-protocol) | Tasks checked but tests folder only has protocol metadata | Reconcile First | Refresh execution artifacts, then archive. |
| `weltraum-004-map-hud-navigation-readout` | Reconcile-First | Yes (test-protocol) | Tasks checked but tests folder only has protocol metadata | Reconcile First | Refresh execution artifacts, then archive. |

## Group D - Data Contracts

| Change | Status | Evidence | Blocker | Recommendation | Next Action |
| --- | --- | --- | --- | --- | --- |
| `resource-cargo-inventory-model-v1` | Active (planning-only) | No (spec-only) | 39 open tasks, intentionally deferred | Keep Active | Validate and reconcile as canonical contract before cargo/mining runtime work. |
| `prototype-functional-ship-part-sockets-v0` | Active | Yes (test-protocol) | 60 open tasks | Keep Active | Large discovery/implementation scope; continue in dedicated runtime change. |
| `prototype-ship-builder-modular-parts-art-pipeline-v1` | Active (planning-only) | No (spec-only) | 18 open tasks, intentionally deferred | Keep Active | Generate reference parts and validate markers in art pipeline change. |
| `ship-builder-data-validation-v1` | Active (planning-only) | No (spec-only) | 22 open tasks, intentionally deferred | Keep Active | Depends on resource-cargo model; implement after contract freeze. |

## Group E - Gameplay Slices

| Change | Status | Evidence | Blocker | Recommendation | Next Action |
| --- | --- | --- | --- | --- | --- |
| `drones-remote-missions-background-sim-v1` | Active (spec-only) | No (spec-only) | 24 open tasks | Keep Active | Implement data model and deterministic tick in runtime change. |
| `fix-functional-blender-ship-vfx-turret-v1` | Complete | Yes (test-protocol, logs, screenshots) | None | Archive Candidate | Run preflight, then archive. |
| `fix-weapon-targeting-and-recoil-stability-v1` | Active | No (no test-protocol) | 8 open tasks, 0 checked | Keep Active | Implement target registry, recoil stabilization, diagnostics. |
| `planet-first-person-worldbuilding-v1` | Active (planning-only) | No (spec-only) | 3 open tasks, intentionally deferred | Keep Active | Blocked by surface target/cargo/frame contracts. |
| `prototype-ship-blueprint-v0` | Draft | Yes (ship-builder-v0-verification, screenshots) | 24 open task checkboxes | Reconcile First | Reconcile evidence against task state, then close or split. |
| `ship-builder-gameplay-ux-v1` | Active (planning-only) | No (spec-only) | 23 open tasks | Keep Active | Implement builder UX after data validation contract. |
| `ship-builder-testflight-validation-v1` | Active (planning-only) | No (spec-only) | 19 open tasks | Keep Active | Implement test-flight acceptance after data validation. |

## Group F - Archive/Reconcile

| Change | Status | Evidence | Blocker | Recommendation | Next Action |
| --- | --- | --- | --- | --- | --- |
| `fix-visible-ship-regression-v1` | Superseded | Yes (test-protocol) | Superseded by `fix-visible-ship-regression-v2` | Superseded | Document as residual evidence; do not treat as active. |
| `fix-visible-ship-regression-v2` | Reconcile-First | Yes (test-protocol) | No proposal/tasks in active folder | Reconcile First | Restore scaffold or document as residual evidence. |
| `player-ui-completion-audit-v1` | Draft | No (empty folder) | No scaffold files | Keep Active or deliberately close | Create scaffold or remove empty folder. |
| `player-ui-concept-runtime-audit-v1` | Reconcile-First | Yes (test-protocol, findings, screenshots) | 6 open tasks, verifier gate blocked | Reconcile First | Reconcile task checkboxes, then archive or close. |
| `player-ui-evidence-manifest-v1` | Active | Yes (test-protocol, manifest JSON) | 1 open push task | Keep Active | Push scoped manifest commit. |
| `player-ui-live-evidence-symmetry-v1` | Reconcile-First | Yes (test-protocol, findings, screenshots) | 5 open tasks | Reconcile First | Reconcile task checkboxes, then archive or close. |
| `player-ui-regression-controls-autopilot-rcs-v1` | Superseded | Partial (screenshots only) | Canonical record already in `archive/2026-06-12-...` | Superseded | Document as residual evidence; do not archive again. |
| `prototype-camera-anchor-framing-v1` | Superseded | Partial (screenshots only) | Archived copy exists at `archive/2026-05-21-...` | Superseded | Document as residual evidence. |
| `prototype-navigation-computer-obstacle-trajectory-v1` | Superseded | Partial (screenshots only) | Archived copy exists at `archive/2026-05-21-...` | Superseded | Document as residual evidence. |

---

## Summary Counts

| Status | Count |
| --- | ---: |
| Complete / Archive Candidate | 17 |
| Reconcile-First | 17 |
| Active (implementation or planning open) | 24 |
| Draft / Incomplete Scaffold | 4 |
| Superseded / Residual | 4 |
| This change (reconciliation) | 1 |
| **Total active folders** | **68** |

Note: The 2026-06-14 audit counted 54 active folders. The current count is 68.
The delta is primarily newer planning-only scaffold changes added during the
2026-06-15 clean-core/docs expansion, plus the `devtoolbox-change-reconciliation-v1`
change itself.

---

## Archive Proposal (Not Executed)

The following changes are candidates for future archiving. This list does not
perform any archiving. Each candidate should pass an archive preflight before
the actual archive operation.

### Already Complete with Evidence - Safe Archive Candidates

1. `fix-autopilot-exact-point-arrival-v1` (acceptance gate PASS, docs reconciled)
2. `autopilot-proving-ground-harness-v1` (acceptance gate now PASS)
3. `fix-authoritative-flightplan-tracking-v1`
4. `fix-autopilot-flip-chase-camera-v1`
5. `fix-autopilot-plan-execution-fidelity-v1` (clarify optional task as separate)
6. `fix-direct-fast-transfer-bangbang-v1`
7. `fix-direct-fast-transfer-execution-smoothness-v1`
8. `fix-flight-control-wasd-rcs-jitter-regression-v2`
9. `fix-functional-blender-ship-vfx-turret-v1`
10. `fix-imported-blender-movement-jitter-v1`
11. `fix-imported-functional-ship-spin-root-cause-v1`
12. `fix-player-hud-context-priority-v2`
13. `fix-playmode-testscene-bootstrap-contamination-v1`
14. `fix-runtime-hud-camera-bootstrap-regression-v1`
15. `player-autopilot-arrival-stability-v2`
16. `player-navigation-planner-ui-overhaul-v1`
17. `prototype-autopilot-navigation-computer-v2`
18. `stabilize-autopilot-arrival-terminal-capture-v1`
19. `stabilize-autopilot-obstacle-replan-chatter-v1`

### Reconcile First, Then Archive

These changes have evidence but stale task metadata. Reconcile task state first:

20. `add-autopilot-obstacle-avoidance-v1`
21. `fix-player-hud-basic-debug-window-v1`
22. `player-hud-live-aspect-ratio-scaling-v1`
23. `player-hud-textmeshpro-readability-v1`
24. `player-mission-reward-ui-v1`
25. `player-navigation-computer-ui-v1`
26. `player-radar-minimap-v1`
27. `player-target-indicators-v1`
28. `player-ui-concept-runtime-audit-v1`
29. `player-ui-live-evidence-symmetry-v1`
30. `prototype-quick-wins-latent-bugs-v1`
31. `prototype-ship-blueprint-v0`
32. `weltraum-001-celestial-backbone`
33. `weltraum-002-orbit-map-prototype`
34. `weltraum-004-map-hud-navigation-readout`

### Superseded - Resolve Residual

35. `fix-visible-ship-regression-v1` (superseded by v2)
36. `fix-visible-ship-regression-v2` (restore scaffold or document as residual)
37. `player-ui-regression-controls-autopilot-rcs-v1` (already archived, live folder is residual)
38. `prototype-camera-anchor-framing-v1` (already archived, live folder is residual)
39. `prototype-navigation-computer-obstacle-trajectory-v1` (already archived, live folder is residual)

### Keep Active - Do Not Archive

All planning-only scaffolds (`clean-core-runtime-architecture-v1`,
`autopilot-v2-core-planner-executor-v1`, `unified-ui-input-mode-architecture-v1`,
`player-ui-redesign-foundation-v1`, `resource-cargo-inventory-model-v1`,
`real-scale-world-architecture-v1`, `planet-first-person-worldbuilding-v1`,
`ship-builder-*`, `drones-*`, etc.) remain active because their open tasks
represent future implementation, not stale metadata.
