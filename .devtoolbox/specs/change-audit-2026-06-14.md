# DevToolbox Change Audit - 2026-06-14

Repository: `BenjaminHornung/Weltraum-Spiel`
Branch: `main`

This is a read-only audit of active DevToolbox change folders under `.devtoolbox/specs/changes`, excluding `archive/`. No runtime code, tests, tasks, scenes, or archive folders were modified. No Unity tests were run for this audit.

## Summary

Active change folders inspected: 54

| Classification | Count | Archive posture |
|---|---:|---|
| Complete and archive candidate | 17 | Safe candidates for a later archive pass. |
| Complete but blocked by stale verification metadata | 17 | Do not archive until stale task, verifier, or scaffold metadata is reconciled. |
| Active and should remain open | 12 | Keep open; visible work, verification, review, commit, or push tasks remain. |
| Superseded by newer change | 4 | Do not archive as fresh active changes; treat as residual or historical evidence. |
| Draft/incomplete scaffold | 4 | Keep open or clean up deliberately; not enough active change structure/evidence. |

## High Attention Changes

| Change | Classification | Evidence inspected | Audit note |
|---|---|---|---|
| `fix-functional-blender-ship-vfx-turret-v1` | Complete and archive candidate | `proposal.md`, `tasks.md`, `tests/test-protocol.md`, `tests/logs/blender-ship-kit-validation-report.md` | All 20 task lines are checked. Tests include Blender/Unity validation, logs, screenshots, and final acceptance evidence. |
| `fix-autopilot-plan-execution-fidelity-v1` | Complete and archive candidate | `proposal.md`, `tasks.md`, `tests/task16-execution.md`, `tests/task16-unity-validation.md`, performance CSVs/screenshots | Required phases are complete. The only remaining unchecked item is explicitly optional/separate Phase 7 executor extraction, so it is not an archive blocker. |
| `stabilize-autopilot-arrival-terminal-capture-v1` | Complete and archive candidate | `proposal.md`, `tasks.md`, `tests/verification.md` | All 5 tasks are checked. Verification records build, Unity script validation, EditMode, PlayMode, and spec validation. |
| `stabilize-autopilot-obstacle-replan-chatter-v1` | Complete and archive candidate | `proposal.md`, `tasks.md`, `tests/launch-corridor-replan-chatter-baseline.md`, `tests/verification.md`, stabilized CSV | All 5 tasks are checked. Baseline and stabilized evidence are present, with final validation recorded. |
| `player-navigation-planner-ui-overhaul-v1` | Complete and archive candidate | `proposal.md`, `tasks.md`, `tests/screenshots/*` | Tasks are checked and the screenshot matrix covers planner, combat, execution, no-target, and replan states. |
| `prototype-ship-blueprint-v0` | Draft/incomplete scaffold | `proposal.md`, `tasks.md`, `tests/ship-builder-v0-verification.md`, screenshots | Evidence exists, but all task checkboxes remain open. Treat as a spike/blueprint still needing explicit closeout before archive. |
| `prototype-quick-wins-latent-bugs-v1` | Complete but blocked by stale verification metadata | `proposal.md`, `design.md`, `specs/quick-wins/spec.md`, `tests/test-protocol.md`, `tests/acceptance-evidence.md` | Targeted fixes and focused green checks are recorded, but no `tasks.md` exists and acceptance metadata still references a red full EditMode suite/open acceptance state. Unsafe to archive until reconciled. |

## Full Classification Matrix

| Change | Classification | Evidence state | Archive safety note |
|---|---|---|---|
| `add-autopilot-obstacle-avoidance-v1` | Complete but blocked by stale verification metadata | Proposal/tasks/tests present; protocol records implementation and verification, but all 4 tasks remain open. | Unsafe until task metadata is reconciled. |
| `autopilot-proving-ground-harness-v1` | Active and should remain open | Proposal/tasks present; `tests/test-protocol.md`, `tests/autopilot-proving-ground-summary.json`, and `tests/performance/*.csv` are present; 5/5 tasks checked. | Unsafe; the explicit acceptance gate is still expected to fail until the exact-arrival fix lands. |
| `fix-authoritative-flightplan-tracking-v1` | Complete and archive candidate | Proposal/tasks/tests present; all tasks checked. | Archive candidate. |
| `fix-autopilot-flip-chase-camera-v1` | Complete and archive candidate | Proposal/tasks/tests present; all tasks checked. | Archive candidate. |
| `fix-autopilot-plan-execution-fidelity-v1` | Complete and archive candidate | Rich test evidence; required phases complete; optional Phase 7 remains separate. | Archive candidate. |
| `fix-direct-fast-transfer-bangbang-v1` | Complete and archive candidate | Proposal/tasks/tests present; all tasks checked. | Archive candidate. |
| `fix-direct-fast-transfer-execution-smoothness-v1` | Complete and archive candidate | Proposal/tasks/tests present; all tasks checked. | Archive candidate. |
| `fix-flight-control-wasd-rcs-jitter-regression-v2` | Complete and archive candidate | Proposal/tasks/tests present; all tasks checked. | Archive candidate. |
| `fix-functional-blender-runtime-v3` | Draft/incomplete scaffold | Evidence-only folder; missing `proposal.md` and `tasks.md`. | Unsafe; incomplete active change record. |
| `fix-functional-blender-ship-vfx-turret-v1` | Complete and archive candidate | Proposal/tasks/tests/logs/screenshots present; all 20 task lines checked. | Archive candidate. |
| `fix-imported-blender-movement-jitter-v1` | Complete and archive candidate | Proposal/tasks/tests present; all tasks checked. | Archive candidate. |
| `fix-imported-functional-ship-spin-root-cause-v1` | Complete and archive candidate | Proposal/tasks/tests present; all tasks checked. | Archive candidate. |
| `fix-player-hud-basic-debug-window-v1` | Complete but blocked by stale verification metadata | Tests record passing validation/build evidence, but all 5 tasks remain open. | Unsafe until task metadata is reconciled. |
| `fix-player-hud-context-priority-v2` | Complete and archive candidate | Proposal/tasks/tests present; all tasks checked. | Archive candidate. |
| `fix-playmode-testscene-bootstrap-contamination-v1` | Complete and archive candidate | Proposal/tasks/tests/logs present; all 7 tasks checked. | Archive candidate. |
| `fix-prototype-ui-performance-v1` | Active and should remain open | Proposal/tasks/tests present; 15 checked, 1 manual Play Mode responsiveness check open. | Unsafe; manual verification remains. |
| `fix-prototype-usability-flight-feel` | Active and should remain open | Proposal/tasks/tests present; 39 checked, 25 open across discovery/UI/autopilot/visuals/verification. | Unsafe; substantial scope remains. |
| `fix-runtime-hud-camera-bootstrap-regression-v1` | Complete and archive candidate | Proposal/tasks/tests/logs present; all 7 tasks checked. | Archive candidate. |
| `fix-visible-ship-regression-v1` | Superseded by newer change | Evidence-only folder; newer `fix-visible-ship-regression-v2` records the more specific fix. | Do not treat as canonical active change. |
| `fix-visible-ship-regression-v2` | Complete but blocked by stale verification metadata | Evidence/screenshots present, but no proposal/tasks in active folder. | Unsafe until scaffold metadata is restored or deliberately reconciled. |
| `fix-weapon-targeting-and-recoil-stability-v1` | Draft/incomplete scaffold | Proposal/tasks present; 0/8 tasks checked; no `tests/test-protocol.md`. | Unsafe; no completed task state or verification protocol. |
| `harden-direct-fast-transfer-autopilot-regression-tests-v1` | Active and should remain open | Proposal/tasks/tests/logs present; 12 checked, 1 reviewer task open. | Unsafe; review task remains. |
| `performance-data-oriented-runtime-architecture-v1` | Active and should remain open | Proposal/tasks/tests present; 30 checked, 2 commit/push closeout tasks open. | Unsafe; closeout remains. |
| `performance-job-system-runtime-phases-v2` | Complete but blocked by stale verification metadata | Evidence-only folder with benchmark markdown/CSV; no proposal/tasks/test-protocol. | Unsafe until scaffold metadata is reconciled. |
| `performance-stability-hotpath-cleanup-v1` | Complete but blocked by stale verification metadata | Evidence-only folder with performance smoke/screenshots; no proposal/tasks/test-protocol. | Unsafe until scaffold metadata is reconciled. |
| `player-autopilot-arrival-stability-v2` | Complete and archive candidate | Proposal/tasks/tests present; all 6 tasks checked. | Archive candidate. |
| `player-autopilot-authoritative-flight-plan-v1` | Active and should remain open | Proposal/tasks/tests/screenshots present; 8/10 tasks checked; verify and commit/push remain open. | Unsafe; completion tasks remain. |
| `player-autopilot-planner-followup-v1` | Active and should remain open | Proposal/tasks/tests present; 0/3 tasks checked; focused evidence exists but broader fixtures remain blocking. | Unsafe; task state remains open. |
| `player-hud-live-aspect-ratio-scaling-v1` | Complete but blocked by stale verification metadata | Proposal/tasks/tests/findings/screenshots present; live captures and build/tests passed, but 0/6 tasks checked due verifier gate. | Unsafe until stale verifier/task metadata is reconciled. |
| `player-hud-textmeshpro-readability-v1` | Complete but blocked by stale verification metadata | Proposal/tasks/tests/findings present; 42 TMP texts, 0 legacy texts, 29/29 tests pass, but 0/6 tasks checked. | Unsafe until stale verifier/task metadata is reconciled. |
| `player-mission-reward-ui-v1` | Complete but blocked by stale verification metadata | Proposal/tasks/tests/screenshots present; reward states proven, but 0/5 tasks checked. | Unsafe until stale verifier/task metadata is reconciled. |
| `player-navigation-computer-ui-v1` | Complete but blocked by stale verification metadata | Proposal/tasks/tests/findings/screenshot present; controls/layout verified, but 0/6 tasks checked. | Unsafe until stale verifier/task metadata is reconciled. |
| `player-navigation-planner-ui-overhaul-v1` | Complete and archive candidate | Proposal/tasks/screenshots present; all tasks checked and screenshot matrix refreshed. | Archive candidate. |
| `player-radar-minimap-v1` | Complete but blocked by stale verification metadata | Proposal/tasks/tests/findings/screenshot present; snapshot coverage exists, but 0/4 tasks checked. | Unsafe until stale verifier/task metadata is reconciled. |
| `player-target-indicators-v1` | Complete but blocked by stale verification metadata | Proposal/tasks/tests/findings/screenshots present; aspect matrix exists, but 0/5 tasks checked. | Unsafe until stale verifier/task metadata is reconciled. |
| `player-ui-completion-audit-v1` | Draft/incomplete scaffold | Empty folder; no proposal, tasks, or tests found. | Unsafe; no audit scaffold exists. |
| `player-ui-concept-runtime-audit-v1` | Complete but blocked by stale verification metadata | Proposal/tasks/tests/findings/manifest screenshots present; broad matrix evidence exists, but 0/6 tasks checked. | Unsafe until stale verifier/task metadata is reconciled. |
| `player-ui-evidence-manifest-v1` | Active and should remain open | Proposal/tasks/tests/findings/manifest JSON present; 4/5 tasks checked. | Unsafe; explicit push task remains. |
| `player-ui-live-evidence-symmetry-v1` | Complete but blocked by stale verification metadata | Proposal/tasks/tests/findings/screenshots present; missing 4:3 evidence was filled, but 0/5 tasks checked. | Unsafe until stale verifier/task metadata is reconciled. |
| `player-ui-regression-controls-autopilot-rcs-v1` | Superseded by newer change | Live folder has screenshots only; canonical record already exists in `archive/2026-06-12-player-ui-regression-controls-autopilot-rcs-v1`. | Do not archive again as a fresh active change. |
| `player-weapon-computer-controls-v1` | Active and should remain open | Proposal/tasks/tests/screenshots present; 0/7 tasks checked. | Unsafe; implementation/task work remains open. |
| `player-world-label-readability-v1` | Active and should remain open | Proposal/tasks/tests/screenshots present; 0/6 tasks checked. | Unsafe; implementation/task work remains open. |
| `prototype-autopilot-navigation-computer-v2` | Complete and archive candidate | Proposal/tasks/tests/logs/screenshots present; all 5 tasks checked. | Archive candidate. |
| `prototype-camera-anchor-framing-v1` | Superseded by newer change | Live folder has screenshots only; archived copy exists at `archive/2026-05-21-prototype-camera-anchor-framing-v1`. | Treat as residual evidence, not a fresh active change. |
| `prototype-functional-ship-part-sockets-v0` | Active and should remain open | Proposal/tasks/tests present; 10/70 tasks checked. | Unsafe; most discovery/implementation remains open. |
| `prototype-navigation-computer-obstacle-trajectory-v1` | Superseded by newer change | Live folder has screenshots only; archived copy exists at `archive/2026-05-21-prototype-navigation-computer-obstacle-trajectory-v1`. | Treat as residual evidence, not a fresh active change. |
| `prototype-quick-wins-latent-bugs-v1` | Complete but blocked by stale verification metadata | Proposal/design/spec/tests present; targeted fixes evidenced, but no `tasks.md` and stale red-suite acceptance metadata remains. | Unsafe until acceptance metadata is reconciled. |
| `prototype-regression-test-harness-v1` | Active and should remain open | Proposal/tasks present; no tests directory; 0/21 tasks checked. | Unsafe; large unfinished scaffold. |
| `prototype-ship-blueprint-v0` | Draft/incomplete scaffold | Proposal/tasks/tests/screenshots present; all task checkboxes remain open. | Unsafe; evidence exists but task state still reads as blueprint/spike. |
| `stabilize-autopilot-arrival-terminal-capture-v1` | Complete and archive candidate | Proposal/tasks/verification present; all 5 tasks checked. | Archive candidate. |
| `stabilize-autopilot-obstacle-replan-chatter-v1` | Complete and archive candidate | Proposal/tasks/baseline and stabilized evidence/verification present; all 5 tasks checked. | Archive candidate. |
| `weltraum-001-celestial-backbone` | Complete but blocked by stale verification metadata | Proposal/tasks/test-protocol present; 11/11 tasks checked but tests folder only contains protocol metadata. | Unsafe until execution artifacts are refreshed or reconciled. |
| `weltraum-002-orbit-map-prototype` | Complete but blocked by stale verification metadata | Proposal/tasks/test-protocol present; 12/12 tasks checked but tests folder only contains protocol metadata. | Unsafe until execution artifacts are refreshed or reconciled. |
| `weltraum-004-map-hud-navigation-readout` | Complete but blocked by stale verification metadata | Proposal/tasks/test-protocol present; 9/9 tasks checked but tests folder only contains protocol metadata. | Unsafe until execution artifacts are refreshed or reconciled. |

## Archive Candidate Set

These are the safest candidates for a later, explicit archive operation:

- `fix-authoritative-flightplan-tracking-v1`
- `fix-autopilot-flip-chase-camera-v1`
- `fix-autopilot-plan-execution-fidelity-v1`
- `fix-direct-fast-transfer-bangbang-v1`
- `fix-direct-fast-transfer-execution-smoothness-v1`
- `fix-flight-control-wasd-rcs-jitter-regression-v2`
- `fix-functional-blender-ship-vfx-turret-v1`
- `fix-imported-blender-movement-jitter-v1`
- `fix-imported-functional-ship-spin-root-cause-v1`
- `fix-player-hud-context-priority-v2`
- `fix-playmode-testscene-bootstrap-contamination-v1`
- `fix-runtime-hud-camera-bootstrap-regression-v1`
- `player-autopilot-arrival-stability-v2`
- `player-navigation-planner-ui-overhaul-v1`
- `prototype-autopilot-navigation-computer-v2`
- `stabilize-autopilot-arrival-terminal-capture-v1`
- `stabilize-autopilot-obstacle-replan-chatter-v1`

## Unsafe To Archive Without Follow-Up

- Stale metadata blockers: reconcile task checkboxes, verifier gate notes, missing scaffold files, or stale acceptance notes before archiving.
- Active work: leave open until explicit verification/review/commit/push tasks are closed.
- Superseded residual folders: decide whether to remove, merge, or document residual evidence separately; do not archive them as fresh active changes.
- Draft scaffolds: either complete the change structure or intentionally close the scaffold in a separate hygiene pass.
