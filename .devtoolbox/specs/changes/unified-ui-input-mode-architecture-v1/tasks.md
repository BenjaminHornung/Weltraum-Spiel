# Unified UI Input Mode Architecture v1 Tasks

Planning status: this change is documentation/specification only. Future
implementation phases are intentionally unchecked.

## Phase 0: Planning Docs

- [ ] Create `docs/ux/unified-ui-input-mode-architecture.md`.
- [ ] Create `docs/ux/player-hud-map-builder-surface-flow.md`.
- [ ] Create `docs/ux/debug-vs-player-ui-policy.md`.
- [ ] Create `docs/ux/input-mode-state-machine.md`.
- [ ] Create DevToolbox proposal, design, tasks and `unified-ui-input-mode` spec.
- [ ] Validate `unified-ui-input-mode-architecture-v1`.

## Phase 1: Mode Enum / State Model Later

- [ ] Define a top-level UI/input mode enum or equivalent state model.
- [ ] Define mode metadata for camera, mouse, keyboard, controller, HUD layers,
  ship input, player body input, autopilot, time policy and back behavior.
- [ ] Add deterministic transition result objects with failure reasons.
- [ ] Add initial tests for allowed and blocked transitions.

## Phase 2: Input Gating Later

- [ ] Route keyboard and mouse through active mode and focused modal/text field.
- [ ] Block flight controls while typing/searching in UI.
- [ ] Block builder shortcuts from affecting ship throttle/RCS/SAS.
- [ ] Block surface movement from sending ship input.
- [ ] Block map pan/zoom from rotating camera or ship.
- [ ] Add input gating tests.

## Phase 3: Player HUD / Context Integration Later

- [ ] Connect Basic HUD context to active mode.
- [ ] Add context-sensitive F1 help per active mode.
- [ ] Ensure warning chips and input hint bar reflect mode ownership.
- [ ] Verify player-facing UI does not depend on F2-F6.
- [ ] Add no-debug-in-Basic tests.

## Phase 4: Map / Navigation Flow Later

- [ ] Integrate `SystemMap` ownership for pan, zoom, marker selection, filters
  and target setting.
- [ ] Keep autopilot status visible when map is live.
- [ ] Ensure engage/cancel/replan actions match flight and planner UI.
- [ ] Add map transition and input conflict tests.

## Phase 5: Builder Mode Integration Later

- [ ] Enter builder only from safe/docked/debug contexts.
- [ ] Disable flight, weapon and autopilot input while builder owns controls.
- [ ] Add builder camera, palette, grid, validation and stats ownership rules.
- [ ] Define `TestFlight` transition and return-to-builder behavior.
- [ ] Add builder placement/throttle conflict tests.

## Phase 6: Surface First-Person Mode Later

- [ ] Define `SurfaceFirstPerson` ownership for camera, look, movement, scanner,
  tool, interaction and surface HUD.
- [ ] Gate ship controls while on foot.
- [ ] Define surface terminal and cargo modal transitions.
- [ ] Add surface movement/RCS conflict tests.

## Phase 7: Drone Command Mode Later

- [ ] Define drone roster, mission queue and remote manual ownership.
- [ ] Restore previous player context after remote command.
- [ ] Display drone autopilot/risk/cargo/fuel/damage status.
- [ ] Add remote drone/player body input conflict tests.

## Phase 8: Debug / Player UI Separation Tests Later

- [ ] Keep debug overlays separate from Basic player UI.
- [ ] Label debug-only controls.
- [ ] Classify debug controls as player-equivalent-later, diagnostic-only or
  remove-later.
- [ ] Add screenshot matrix across player and debug presets.
- [ ] Add accessibility/readability pass for player-facing mode labels and help.
