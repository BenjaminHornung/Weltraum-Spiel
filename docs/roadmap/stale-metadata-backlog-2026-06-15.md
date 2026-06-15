# Stale Metadata Backlog - 2026-06-15

This backlog lists documentation contradictions, stale task checkboxes,
evidence-without-tasks, tasks-green-without-validation, and superseded changes
found during the 2026-06-15 reconciliation first pass.

This document does not toggle any tasks or archive any changes. It is a work
list for future hygiene passes.

---

## 1. Contradictory Documentation

### 1.1 Exact-Arrival Autopilot Status

| Document | Prior Statement | Actual Evidence | Resolution |
| --- | --- | --- | --- |
| `docs/current-prototype-state.md` | "Known Current Autopilot Blocker" section lists exact-arrival as failing with 5-6.5m distance errors, terminal capture loss, post-brake flapping, disallowed reacquire profiles, obstacle corridor clearance violations, and 860 safety replans / 11.5m error. | `fix-autopilot-exact-point-arrival-v1/tests/test-protocol.md` (2026-06-14): all scenarios PASS, acceptance gate PASS, final distances 0.20m to 0.52m, 0 disallowed profiles, 0 post-brake transitions. | **Resolved in this reconciliation pass.** `docs/current-prototype-state.md` has been updated. |

### 1.2 Active Change Count

| Source | Count | Note |
| --- | ---: | --- |
| `change-audit-2026-06-14.md` | 54 | Audit snapshot from 2026-06-14. |
| Actual `ls .devtoolbox/specs/changes` (excluding `archive/`) | 68 | Includes newer planning scaffolds added 2026-06-15 plus this reconciliation change. |

Not a contradiction per se, but the audit snapshot is now outdated. A future
audit should refresh the count.

### 1.3 Autopilot-Proving-Ground Audit Observation

The 2026-06-14 DevToolbox audit classified `autopilot-proving-ground-harness-v1`
as "active/missing evidence" with "expected to fail until exact-arrival fix lands."

Current state: the harness has `test-protocol.md`, `autopilot-proving-ground-summary.json`,
per-scenario CSVs, and the acceptance gate now reports PASS.

**Resolution**: The spec-sorting document reclassifies this change as Archive Candidate.

---

## 2. Open or Stale Task Checkboxes

### 2.1 Evidence Present but Tasks Open (Reconcile-First)

These changes have test protocols, findings, or screenshots but their task
checkboxes were never checked, typically because a workspace-wide verifier gate
blocked the DevToolbox completion flow.

| Change | Open Tasks | Evidence Present | Action |
| --- | ---: | --- | --- |
| `player-hud-live-aspect-ratio-scaling-v1` | 6 | Yes (test-protocol, screenshots) | Reconcile checkboxes against evidence. |
| `player-hud-textmeshpro-readability-v1` | 6 | Yes (test-protocol, findings) | Reconcile checkboxes against evidence. |
| `player-mission-reward-ui-v1` | 5 | Yes (test-protocol, screenshots) | Reconcile checkboxes against evidence. |
| `player-navigation-computer-ui-v1` | 6 | Yes (test-protocol, findings) | Reconcile checkboxes against evidence. |
| `player-radar-minimap-v1` | 4 | Yes (test-protocol, findings) | Reconcile checkboxes against evidence. |
| `player-target-indicators-v1` | 5 | Yes (test-protocol, findings, screenshots) | Reconcile checkboxes against evidence. |
| `player-ui-concept-runtime-audit-v1` | 6 | Yes (test-protocol, findings, screenshots) | Reconcile checkboxes against evidence. |
| `player-ui-live-evidence-symmetry-v1` | 5 | Yes (test-protocol, findings, screenshots) | Reconcile checkboxes against evidence. |
| `fix-player-hud-basic-debug-window-v1` | 5 | Yes (test-protocol) | Reconcile checkboxes against evidence. |
| `add-autopilot-obstacle-avoidance-v1` | 4 | Yes (test-protocol) | Reconcile checkboxes against evidence. |
| `prototype-ship-blueprint-v0` | 24 | Yes (ship-builder-v0-verification, screenshots) | Reconcile evidence against task state, then close or split. |

### 2.2 Tasks Green but Validation Artifacts Thin

These changes have all tasks checked but their `tests/` folder only contains a
protocol markdown file without execution artifacts (JSON, XML, logs, CSVs).

| Change | Checked Tasks | Test Folder Contents | Action |
| --- | ---: | --- | --- |
| `weltraum-001-celestial-backbone` | 11/11 | `test-protocol.md` only | Refresh execution artifacts or explicitly reconcile. |
| `weltraum-002-orbit-map-prototype` | 12/12 | `test-protocol.md` only | Refresh execution artifacts or explicitly reconcile. |
| `weltraum-004-map-hud-navigation-readout` | 9/9 | `test-protocol.md` only | Refresh execution artifacts or explicitly reconcile. |

### 2.3 Partially Complete with Significant Open Scope

| Change | Checked | Open | Note |
| --- | ---: | ---: | --- |
| `fix-prototype-usability-flight-feel` | 39 | 25 | Much was absorbed by later HUD/control work. Remaining items should be split into smaller follow-ups. |
| `prototype-functional-ship-part-sockets-v0` | 10 | 60 | Large discovery scope; not stale, but needs dedicated runtime change. |
| `unified-ui-input-mode-architecture-v1` | 0 | 43 | Planning-only; tasks intentionally open for future implementation. |
| `resource-cargo-inventory-model-v1` | 0 | 39 | Planning-only; tasks intentionally open. |
| `real-scale-world-architecture-v1` | 11 | 31 | Planning-only; many tasks explicitly marked "later" or "deferred". |

---

## 3. Incomplete or Missing Scaffolds

These folders lack `proposal.md` and/or `tasks.md` and cannot be safely treated
as active changes.

| Change | Missing | Existing | Action |
| --- | --- | --- | --- |
| `fix-functional-blender-runtime-v3` | `proposal.md`, `tasks.md` | `tests/test-protocol.md` | Restore scaffold or document as historical evidence. |
| `fix-visible-ship-regression-v1` | `proposal.md`, `tasks.md` | `tests/test-protocol.md` | Superseded by v2; document as residual. |
| `fix-visible-ship-regression-v2` | `proposal.md`, `tasks.md` | `tests/test-protocol.md` | Restore scaffold or document as residual. |
| `performance-job-system-runtime-phases-v2` | `proposal.md`, `tasks.md`, `test-protocol.md` | Benchmark markdown/CSV | Restore scaffold or document as historical evidence. |
| `performance-stability-hotpath-cleanup-v1` | `proposal.md`, `tasks.md`, `test-protocol.md` | Performance smoke/screenshots | Restore scaffold or document as historical evidence. |
| `player-ui-completion-audit-v1` | Everything | Empty folder | Create scaffold or remove empty folder. |
| `prototype-camera-anchor-framing-v1` | `proposal.md`, `tasks.md` | Screenshots only | Superseded; archived copy exists. |
| `prototype-navigation-computer-obstacle-trajectory-v1` | `proposal.md`, `tasks.md` | Screenshots only | Superseded; archived copy exists. |
| `player-ui-regression-controls-autopilot-rcs-v1` | `proposal.md`, `tasks.md` | Screenshots only | Superseded; archived copy exists. |

---

## 4. Superseded Changes

| Change | Superseded By | Evidence Location |
| --- | --- | --- |
| `fix-visible-ship-regression-v1` | `fix-visible-ship-regression-v2` | Live folder has `tests/test-protocol.md` only. |
| `player-ui-regression-controls-autopilot-rcs-v1` | `archive/2026-06-12-player-ui-regression-controls-autopilot-rcs-v1` | Live folder has screenshots only. |
| `prototype-camera-anchor-framing-v1` | `archive/2026-05-21-prototype-camera-anchor-framing-v1` | Live folder has screenshots only. |
| `prototype-navigation-computer-obstacle-trajectory-v1` | `archive/2026-05-21-prototype-navigation-computer-obstacle-trajectory-v1` | Live folder has screenshots only. |

These should not be treated as active changes. A future hygiene pass should
either remove the residual live folders or explicitly mark them as historical
evidence pointers.

---

## 5. Recommended Cleanup Priority

1. **Highest**: Reconcile the 11 "evidence present but tasks open" changes
   (Section 2.1). Each needs task checkboxes checked or explicit closeout notes.
2. **High**: Resolve the 3 "tasks green but validation thin" changes
   (Section 2.2) by refreshing execution artifacts.
3. **Medium**: Decide fate of 9 incomplete/missing scaffolds (Section 3).
4. **Medium**: Remove or document 4 superseded residual folders (Section 4).
5. **Low**: Split `fix-prototype-usability-flight-feel` into smaller follow-ups.
