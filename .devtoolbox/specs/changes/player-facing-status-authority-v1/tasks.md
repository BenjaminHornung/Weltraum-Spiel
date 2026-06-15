# Tasks: Player-Facing Status Authority v1

## Phase 0: Planning Scaffold (This Change)

- [x] Read mandatory context: `AGENTS.md`, `.agent/PLANS.md`,
  `player-ui-redesign-foundation-v1.md`, `unified-ui-input-mode-architecture.md`,
  `player-hud-map-builder-surface-flow.md`, `autopilot-v2-design.md`,
  `spec-sorting-backlog.md`, `debug-vs-player-ui-policy.md`.
- [x] Create DevToolbox proposal, design, tasks and spec scaffold under
  `.devtoolbox/specs/changes/player-facing-status-authority-v1/`.
- [x] Write `specs/player-facing-status-authority/spec.md` with ADDED requirements.
- [x] Write `tests/test-protocol.md` with setup evidence.
- [x] Write UX document `docs/ux/player-facing-status-authority-v1.md`.
- [x] Record setup evidence: no runtime/scene/prefab/asset/prototype changes.

## Phase 1: Status Snapshot Contract (Later Runtime Change)

- [ ] Define read-only status snapshot structs/interfaces for each authority
  service (Navigation, Cargo, Scanner, Faction/Legal, Ship Authority, Suit/Vitals).
- [ ] Map AutopilotTelemetry codes to status snapshot fields.
- [ ] Define warning chip code enum and severity mapping.
- [ ] Define failure reason code enum and player-action mapping.
- [ ] Add unit tests: each authority service produces a valid snapshot.

## Phase 2: HUD ViewModel Integration (Later Runtime Change)

- [ ] Ship HUD ViewModel reads Navigation, Cargo-Mass, Scanner-Warning,
  Ship-Authority snapshots; renders warning chips per taxonomy.
- [ ] Verify HUD never computes its own ETA/Fuel/Risk.
- [ ] Add HUD context-panel tests: correct chip from correct owner.
- [ ] Capture screenshot evidence: warning states per mode.

## Phase 3: Map / Navigation Status (Later Runtime Change)

- [ ] System Map reads Route Validity, Fuel Estimate, ETA, Legal-Zone from
  authority owners.
- [ ] Local Map/Radar reads Scanner hazards and ownership hints with confidence.
- [ ] Verify map never overrides authority status.
- [ ] Capture screenshot evidence: route preview with authority warnings.

## Phase 4: Suit HUD / Surface Status (Later Runtime Change)

- [ ] Suit HUD reads Suit/Vitals, Scanner-Hazard, Scanner-Confidence snapshots.
- [ ] Surface Interaction Prompt reads Scanner + Faction/Legal.
- [ ] Verify suit HUD shows hazard chips from Scanner, not self-computed.
- [ ] Capture screenshot evidence: scanner prompt with risk/legal status.

## Phase 5: Terminal / Cargo / Legal Status (Later Runtime Change)

- [ ] Terminal reads Faction/Legal, Cargo-Transfer-Feasibility, Containment.
- [ ] InventoryCargo reads Cargo-Mass/Volume, Ownership, Legal state.
- [ ] Verify legal status comes from Faction/Legal Service, not Scanner hint.
- [ ] Capture screenshot evidence: transfer blocked with player-facing reason.

## Phase 6: Debug vs Player UI Tests (Later Runtime Change)

- [ ] Test: Basic mode shows no debug IDs in player status layer.
- [ ] Test: Debug layer shows PlanHash/SampleIndex/ResourceId separately.
- [ ] Test: Warning chips render with correct severity from owner snapshot.
- [ ] Test: Failure reasons show player text + next action, not raw code.
