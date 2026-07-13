# Capability: Player-Facing Status Authority

## Summary

The project shall define a canonical status ownership model that specifies which
gameplay system owns each piece of player-facing status, and which UI surfaces are
read-only views of that status.

Views (Ship HUD, System Map, Local Map, Suit HUD, Terminal) shall never compute
their own truth. They shall read authority-owned status snapshots, translate codes
into player-facing text, render warning chips per a shared taxonomy, and show the
next actionable step for any blocked action.

This spec is planning-only for the current setup task and does not authorize
runtime, scene, prefab, or asset edits by itself.

## ADDED Requirements

### Requirement: Each status has exactly one authority owner

Every piece of player-facing status (route validity, ETA, fuel estimate, brake
reserve, arrival state, cargo mass, transfer feasibility, containment, scan
confidence, hazard observations, ownership hints, license/permit, action legality,
enforcement risk, flight authority, suit vitals) shall have exactly one authority
service that computes and publishes its truth.

#### Scenario: A view needs status to display

- GIVEN a UI view needs to display any player-facing status
- WHEN the view obtains the status value
- THEN the value comes from the designated authority service
- AND the view does not compute its own competing value.

#### Scenario: Multiple views show the same status

- GIVEN two or more UI surfaces display the same status (for example fuel estimate
  in both Navigation Computer and Ship HUD)
- WHEN the authority service updates the status snapshot
- THEN all views reflect the same updated value
- AND no view shows a contradictory value.

### Requirement: Navigation Computer owns navigation status

The Navigation Computer (including RoutePlanner, RouteValidator, and Autopilot
Supervisor) shall be the authority owner for route validity, ETA, fuel estimate,
brake reserve, arrival state, authority warnings, and plan-invalidated/needs-replan
status.

#### Scenario: Ship HUD shows navigation status

- GIVEN the Ship HUD displays compact navigation context
- WHEN the Navigation Computer has an active or planned route
- THEN the HUD shows route validity, ETA, fuel estimate, brake reserve, and
  authority warnings from the Navigation Computer snapshot
- AND the HUD does not recalculate ETA or fuel independently.

#### Scenario: Plan is invalidated during execution

- GIVEN the Autopilot Supervisor detects plan invalidation
- WHEN the status snapshot is published
- THEN views show a visible needs-replan state
- AND no view performs a silent replan.

### Requirement: Cargo Service owns cargo status

The Cargo Service shall be the authority owner for cargo mass, volume, transfer
feasibility, containment, and cargo-too-heavy status.

#### Scenario: Transfer is blocked by capacity

- GIVEN a player attempts a cargo transfer that exceeds target capacity
- WHEN the Cargo Service evaluates feasibility
- THEN the transfer result carries a failure reason code from the Cargo Service
- AND the view shows a player-facing reason and next action from the taxonomy.

#### Scenario: Cargo mass affects flight authority

- GIVEN cargo mass exceeds the ship limit
- WHEN the Cargo Service and Ship Authority compute status
- THEN a cargo-too-heavy warning chip is published by the Cargo Service
- AND the Ship HUD shows the chip without recalculating mass.

### Requirement: Scanner owns observations with confidence

The Scanner Service shall be the authority owner for detection confidence, local
hazard observations, and observed ownership hints. Scanner results shall be treated
as observations with confidence levels, not guaranteed truth.

#### Scenario: Low-confidence detection is shown

- GIVEN the Scanner detects an object with low confidence
- WHEN the Suit HUD or Local Map renders the observation
- THEN the display indicates the confidence level
- AND the display does not assert guaranteed ownership.

#### Scenario: Scanner hint does not override legal authority

- GIVEN the Scanner provides an ownership hint
- WHEN the Faction/Legal Service has authoritative legality data
- THEN the legal status shown comes from the Faction/Legal Service
- AND the Scanner hint is not displayed as authoritative legality.

### Requirement: Faction/Legal Service owns legality status

The Faction/Legal Service shall be the authority owner for license/permit status,
action legality, and enforcement risk.

#### Scenario: Illegal action is blocked

- GIVEN a player attempts an action that is illegal in the current zone
- WHEN the Faction/Legal Service evaluates legality
- THEN the action is blocked with a legal failure reason code
- AND the view shows a player-facing reason from the legal taxonomy.

### Requirement: Warning chips follow shared taxonomy

All warning chips shall be defined in a shared taxonomy with a unique code, an
owning authority service, a severity level, and a recommended player action. Views
shall render chips from the taxonomy and shall not alter severity.

#### Scenario: A view renders a warning chip

- GIVEN an authority service publishes a warning condition
- WHEN a view renders the corresponding warning chip
- THEN the chip uses the code and severity from the taxonomy
- AND the view does not change the severity or invent a new chip.

### Requirement: Failure reasons follow shared taxonomy

All blocked actions shall produce a failure reason code from a shared taxonomy with
a player-facing text and a next actionable step. Views shall translate codes into
player text and shall not invent new codes.

#### Scenario: A blocked action is explained

- GIVEN an authority service blocks a player action
- WHEN the view explains the block
- THEN the explanation uses the failure reason code from the taxonomy
- AND the view shows the recommended next action.

### Requirement: Views are read-only

Ship HUD, System Map, Local Map, Suit HUD, and Terminal shall be read-only views
of authority-owned status. They shall not compute navigation truth, cargo truth,
legal truth, or scanner truth independently.

#### Scenario: A view attempts independent computation

- GIVEN a future runtime change implements a view
- WHEN the view is tested
- THEN the view reads all authoritative status from the designated services
- AND the test fails if the view independently computes ETA, fuel, risk,
  legality, or containment.

### Requirement: Debug status is separated from player status

Debug status values (plan hash, sample indices, resource IDs, socket paths,
candidate scores, raw telemetry) shall be shown only in the debug layer. The
player status layer shall show readable names, actionable status, warning chips,
and failure reasons.

#### Scenario: Basic mode shows no debug IDs

- GIVEN Basic player mode is active
- WHEN the player status layer is rendered
- THEN no debug IDs, plan hashes, sample indices, or internal paths are visible
- AND debug overlays are in a separate labeled layer.

### Requirement: Setup is documentation-only

This setup slice shall only add documentation, UX docs, and DevToolbox spec
scaffolds. No runtime code, Unity scene, prefab, asset, or prototype file shall be
modified.

#### Scenario: Setup change is reviewed

- GIVEN the setup change is inspected
- WHEN modified files are listed
- THEN no runtime code, Unity scene, prefab, asset, or
  `unity-legacy-final-2026-07:Assets/Scripts/Prototype` file is modified.
