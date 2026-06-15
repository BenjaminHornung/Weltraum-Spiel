# Player-Facing Status Authority v1

Status: planning/spec-only, 2026-06-15.

This document defines the canonical truth source for which gameplay system owns
which player-facing status, and how each UI surface (Ship HUD, System Map, Local
Map, Suit HUD, Terminal) is allowed to display it.

It does not implement code, tests, scenes, UI prefabs, assets, runtime systems,
or input bindings.

Related docs:

- `docs/ux/player-ui-redesign-foundation-v1.md` — UI hierarchy, warning chips.
- `docs/ux/unified-ui-input-mode-architecture.md` — mode ownership, HUD layers.
- `docs/ux/player-hud-map-builder-surface-flow.md` — surface flow.
- `docs/ux/debug-vs-player-ui-policy.md` — debug/player separation.
- `docs/architecture/autopilot-v2-design.md` — autopilot telemetry codes.
- DevToolbox spec: `.devtoolbox/specs/changes/player-facing-status-authority-v1/`.

## 1. Core Principle

Every player-facing status has exactly one **Authority Owner** — the system that
computes and publishes its truth. All UI surfaces are **Views**: they read the
authority snapshot, translate codes into player text, render warning chips, and
show the next actionable step.

A view must never:

- compute its own ETA, fuel, risk, legality, or containment,
- show a different status than the owner provides,
- display debug IDs in the player layer,
- produce silent truth the authority owner does not know about,
- change warning chip severity,
- block an action without a visible reason.

## 2. Status Ownership Matrix

Legend: **O** = Owner (computes truth), **R** = Read-only view (display only).

### 2.1 Navigation Computer

| Status | Owner | Views |
| --- | --- | --- |
| Route Validity | Navigation Computer / Autopilot Supervisor | Ship HUD (R), System Map (R), Nav Panel (R) |
| ETA | Navigation Computer / RoutePlan | Ship HUD (R), System Map (R), Nav Panel (R) |
| Fuel Estimate | Navigation Computer / FuelPolicy + RoutePlan | Ship HUD (R), System Map (R), Nav Panel (R), Terminal (R) |
| Brake Reserve | Navigation Computer / RouteValidator | Ship HUD (R), Nav Panel (R) |
| Arrival State | Autopilot Executor / Telemetry | Ship HUD (R), Nav Panel (R) |
| Authority Warnings | Navigation Computer / RouteValidator | Ship HUD (R), Nav Panel (R) |
| Plan Invalidated / Needs Replan | Autopilot Supervisor | Ship HUD (R), Nav Panel (R), System Map (R) |

### 2.2 Cargo Service

| Status | Owner | Views |
| --- | --- | --- |
| Mass / Volume | Cargo Service | InventoryCargo (R), Terminal (R), Ship HUD compact (R), Drone Command (R) |
| Transfer Feasibility | Cargo Service | InventoryCargo (R), Terminal (R) |
| Containment | Cargo Service | InventoryCargo (R), Terminal (R) |
| Cargo too heavy | Cargo Service + Ship Authority | Ship HUD (R), InventoryCargo (R) |

### 2.3 Scanner

| Status | Owner | Views |
| --- | --- | --- |
| Detection Confidence | Scanner Service | Suit HUD (R), Ship HUD (R), Local Map (R) |
| Local Hazard Observations | Scanner Service | Suit HUD (R), Ship HUD (R), Local Map (R) |
| Observed Ownership Hints | Scanner Service | Local Map (R), Surface Interaction Prompt (R) |

Scanner results are **observations with confidence**, not guaranteed truth. The
Faction/Legal Service is the authority for definitive legality.

### 2.4 Faction / Legal Service

| Status | Owner | Views |
| --- | --- | --- |
| License / Permit | Faction/Legal Service | Surface Interaction Prompt (R), Terminal (R), InventoryCargo (R) |
| Action Legality | Faction/Legal Service | Surface Prompt (R), Terminal (R), InventoryCargo (R), System Map zone (R) |
| Enforcement Risk | Faction/Legal Service | Surface Prompt (R), Terminal (R), System Map zone (R) |

Scanner ownership hints must not be displayed as authoritative legality. Only the
Faction/Legal Service decides legality.

### 2.5 Ship Authority / Flight Assist

| Status | Owner | Views |
| --- | --- | --- |
| Flight Authority (RCS/SAS/Thruster) | Ship Authority / Flight Assist | Ship HUD (R), Nav Panel (R) |
| Autopilot State | Autopilot Executor / Telemetry | Ship HUD (R), Nav Panel (R), System Map (R) |
| Manual Override | Ship Authority | Ship HUD (R), Nav Panel (R) |

### 2.6 Suit / Vitals Service

| Status | Owner | Views |
| --- | --- | --- |
| Health / Suit Integrity | Suit/Vitals Service | Suit HUD (R) |
| Oxygen / Energy | Suit/Vitals Service | Suit HUD (R) |
| Temperature / Radiation / Pressure | Suit/Vitals Service | Suit HUD (R) |
| Tool Status | Suit/Vitals Service | Suit HUD (R) |
| Ship Beacon | Suit/Vitals Service | Suit HUD (R) |

## 3. Warning Chip Taxonomy

Warning chips are immediately recognizable, actionable risks. Each chip has one
owning service, a severity, and a recommended player action.

### Severity levels

```text
Critical = action blocked or immediate danger; always visible, top priority.
High     = action risky or restricted; prominently visible.
Medium   = warning, action possible but with risk.
Low      = hint, no blockage.
```

### Chip catalog

| Chip Code | Owner | Severity | Player Action |
| --- | --- | --- | --- |
| `NAV_FUEL_INSUFFICIENT` | Navigation Computer | Critical | Refuel or shorten route. |
| `NAV_NO_AUTHORITY` | Nav Computer / Ship Authority | Critical | Check RCS/thrusters, repair ship. |
| `NAV_NO_BRAKE_RESERVE` | Navigation Computer | Critical | Shorten route or reduce speed. |
| `NAV_PLAN_INVALIDATED` | Autopilot Supervisor | High | Create new plan (replan). |
| `NAV_UNSAFE_TARGET` | Navigation Computer | High | Check target (planet/clearance). |
| `NAV_LIMITED_AUTHORITY` | Navigation Computer | Medium | Maneuver carefully, watch authority. |
| `CARGO_TOO_HEAVY` | Cargo Service | High | Reduce mass (transfer/jettison). |
| `CARGO_TRANSFER_BLOCKED` | Cargo Service | Medium | Check capacity/containment. |
| `CARGO_CONTAINMENT_VIOLATION` | Cargo Service | High | Move resource to permitted container. |
| `SCAN_HAZARD_LOCAL` | Scanner Service | Medium/High | Avoid hazard. |
| `SCAN_CONFIDENCE_LOW` | Scanner Service | Low | Scan closer or proceed cautiously. |
| `LEGAL_NO_LICENSE` | Faction/Legal Service | High | Acquire license. |
| `LEGAL_ILLEGAL_ACTION` | Faction/Legal Service | Critical | Abort action or accept consequence. |
| `LEGAL_ENFORCEMENT_RISK` | Faction/Legal Service | Medium | Accept risk or abort. |
| `SHIP_AUTOFIRE_BLOCKED` | Ship Authority | Low/Medium | Bring target into arc, wait for cooldown. |
| `SUIT_OXYGEN_LOW` | Suit/Vitals Service | Critical | Return to ship/outpost immediately. |
| `SUIT_HAZARD_EXPOSURE` | Suit/Vitals Service | High | Leave hazard zone. |
| `SUIT_INTEGRITY_CRITICAL` | Suit/Vitals Service | Critical | Seek repair. |

### Rendering rules

- A view renders chips only from the authority snapshot, never self-computed.
- A view may not change severity.
- Multiple chips are sorted: Critical first, then High, then Medium, then Low.
- A chip includes a short label and the recommended action.
- Chips are dismissible only when severity is Low; Critical/High persist until
  resolved.

## 4. Failure Reason Taxonomy

When an action is blocked, the authority service produces a failure reason code.
The view translates it to player text and shows the next action.

| Code | Owner | Player Text (example) | Next Action |
| --- | --- | --- | --- |
| `ROUTE_TARGET_INSIDE_BODY` | Navigation Computer | "Target is inside a planet/moon." | Move target. |
| `ROUTE_FUEL_INSUFFICIENT` | Navigation Computer | "Not enough fuel for this route." | Refuel or shorten route. |
| `ROUTE_NO_BRAKE_RESERVE` | Navigation Computer | "No brake reserve after arrival." | Shorten route. |
| `ROUTE_CLEARANCE_VIOLATION` | Navigation Computer | "Route violates clearance around structure/zone." | Adjust route. |
| `ROUTE_NO_AUTHORITY` | Nav / Ship Authority | "Ship has no control authority (RCS/thruster)." | Repair ship. |
| `ROUTE_TIMEWARP_UNSTABLE` | Navigation Computer | "Route is not deterministic at timewarp." | Simplify route. |
| `PLAN_INVALIDATED_OBSTACLE` | Autopilot Supervisor | "Plan invalid: new obstacle detected." | Create new plan. |
| `PLAN_INVALIDATED_FUEL` | Autopilot Supervisor | "Plan invalid: fuel exhausted." | Refuel, then replan. |
| `CARGO_CAPACITY_FULL` | Cargo Service | "Target container is full." | Choose another container or offload. |
| `CARGO_CONTAINMENT_MISMATCH` | Cargo Service | "Resource not permitted in this container type." | Choose permitted container. |
| `CARGO_TOO_HEAVY_FOR_SHIP` | Cargo / Ship Authority | "Cargo exceeds ship limit." | Reduce mass. |
| `CARGO_TRANSFER_NO_ACCESS` | Cargo Service | "No access to this container." | Check permission/license. |
| `LEGAL_NO_PERMIT` | Faction/Legal Service | "No permit for this action in this zone." | Acquire permit. |
| `LEGAL_CONTRABAND` | Faction/Legal Service | "Resource is prohibited in this zone." | Offload or leave zone. |
| `LEGAL_FACTION_HOSTILE` | Faction/Legal Service | "Faction is hostile; action risky." | Accept risk or abort. |
| `SCAN_NO_DETECTION` | Scanner Service | "No detection in range." | Move closer or upgrade scanner. |
| `SCAN_CONFIDENCE_TOO_LOW` | Scanner Service | "Detection too uncertain for action." | Scan closer. |
| `SHIP_NO_MUZZLE` | Ship Authority | "No functioning muzzle." | Repair ship. |
| `SHIP_OUT_OF_ARC` | Ship Authority | "Target outside turret arc." | Align ship/turret. |
| `SHIP_COOLDOWN` | Ship Authority | "Weapon on cooldown." | Wait. |
| `SUIT_OXYGEN_DEPLETED` | Suit/Vitals Service | "Oxygen depleted." | Return to ship immediately. |
| `BUILDER_NOT_SAFE_STATE` | Builder/Mode Authority | "Builder requires safe/docked state." | Dock/land first. |

New codes originate only in the authority service and must be registered in this
taxonomy. A view may not invent codes.

## 5. UI Display Rules per Surface

### 5.1 Ship HUD

The Ship HUD is the primary always-visible surface during space flight.

**Allowed to display (read from authority owners):**

```text
- Active mode label (from input mode state machine)
- Velocity relative to target/frame (from Ship Authority)
- Throttle, RCS/SAS status (from Ship Authority)
- Fuel (from Navigation Computer fuel estimate)
- Target name + distance if target active (from Navigation target service)
- Autopilot state if active/planned/blocked (from Autopilot Telemetry)
- Compact cargo mass if relevant (from Cargo Service)
- Warning chips (from authority taxonomy, sorted by severity)
- Radar/minimap markers (from Scanner + Navigation)
```

**Must not display:**

```text
- PlanHash, SampleIndex, CandidateScores (debug only)
- Self-computed ETA or fuel
- Full cargo manifest (belongs in InventoryCargo)
- Debug console or legacy IMGUI diagnostics
```

**Layout rules:**

```text
- Center view axis kept clear (ship, target, prograde/retrograde, obstacles).
- Permanent UI at edges; only reticle/markers in center.
- Warning chips in a fixed chip strip, sorted Critical→Low.
- One primary context panel at a time (nav/combat/cargo/warning).
```

### 5.2 System Map

The System Map is for planning, not micro-management during flight.

**Allowed to display:**

```text
- Planets/moons/stations/asteroids/outposts/factions (from world data)
- Selected target marker and details
- Route preview with ETA, fuel estimate, brake reserve (from Navigation Computer)
- Fastest/FuelSaver/Balanced candidate comparison (from Navigation Computer)
- Authority warnings on route (from Navigation Computer)
- Legal/faction zone overlays (from Faction/Legal Service)
- Scanner-derived hazard markers with confidence (from Scanner Service)
```

**Must not display:**

```text
- Self-computed route metrics
- Debug object IDs or prediction sample indices in player view
- Scanner ownership hints as authoritative legality
```

**Interaction rules:**

```text
- Map owns pan/zoom/select; flight controls gated.
- Route changes require explicit confirmation.
- Autopilot may continue if map is non-paused and safe.
- Back returns to ShipFlight with target visible.
```

### 5.3 Local Map / Radar

The Local Map (Radar/Minimap) is a local situational instrument, not the system
map.

**Allowed to display:**

```text
- Own ship at center or stable orientation
- Target direction
- Local route corridor
- Nearby obstacles (from Scanner hazard observations)
- Asteroids/structures/stations in range
- Friend/foe if known (from Scanner ownership hints with confidence)
- Scale rings
```

**Must not display:**

```text
- Debug minimap as player minimap
- Too many icons; use clustering or filters
- Self-computed hazard assessments (use Scanner authority)
```

**Filters:**

```text
- All, Nav, Combat, Cargo, Hazards
- Orientation clearly labeled (ship-forward or north/system-up)
- Scale clearly labeled (e.g. 250m / 1km / 5km)
```

### 5.4 Suit HUD

The Suit HUD is the primary surface during surface first-person play.

**Allowed to display:**

```text
- Health / suit integrity (from Suit/Vitals Service)
- Oxygen / energy (from Suit/Vitals Service)
- Temperature / radiation / pressure hazard (from Suit/Vitals Service)
- Compass / local frame
- Ship beacon status (from Suit/Vitals Service)
- Objective
- Scanner reticle + overlay (from Scanner Service)
- Tool status (from Suit/Vitals Service)
- Surface interaction prompt (from Scanner + Faction/Legal)
- Warning chips (from authority taxonomy)
```

**Must not display:**

```text
- Ship throttle/RCS controls (wrong mode)
- Self-computed hazard levels (use Scanner authority)
- Debug surface overlays in Basic mode
- Scanner hint as authoritative legality
```

**Surface Interaction Prompt fields:**

```text
- Object name
- Action
- Distance
- Required tool
- Owner/faction (from Scanner hint with confidence, or Faction/Legal if known)
- Risk/legal status (from Faction/Legal Service — authoritative)
- Cargo/mass effect if relevant (from Cargo Service)
```

### 5.5 Terminal / Outpost Service

The Terminal is a diegetic/meta service interface for trade, cargo, repair,
refuel, permits, missions.

**Allowed to display:**

```text
- Service tabs: buy/sell, refuel, repair, storage, missions, permits
- Owner/faction status (from Faction/Legal Service)
- Price, legality, reputation effects (from Faction/Legal + Economy)
- Cargo/inventory overlay with mass/volume/ownership/legal (from Cargo Service)
- Transfer result (accepted/rejected with reason from Cargo Service)
- Fuel estimate from refuel (from Navigation Computer)
```

**Must not display:**

```text
- Raw service IDs in player view
- Self-computed legality (use Faction/Legal authority)
- Debug force-transaction or faction-override controls in Basic
```

## 6. Multi-Surface Consistency Rule

When multiple surfaces show the same status, they must agree because they read
the same authority owner.

**Fuel example:**

```text
Navigation Computer → publishes fuel estimate (Owner)
Ship HUD            → shows same fuel estimate (Read)
System Map          → shows same fuel estimate in route preview (Read)
Terminal            → shows same fuel estimate in refuel service (Read)
```

If fuel changes, the authority owner updates the snapshot and all views react. No
view recalculates fuel.

**Legality example:**

```text
Faction/Legal Service → publishes action legality (Owner)
Surface Interaction   → shows legal/risk (Read)
Terminal              → shows legal/risk in service (Read)
InventoryCargo        → shows legal marker (Read)
System Map            → shows zone overlay (Read)
```

Scanner ownership hints must not appear as authoritative legality.

## 7. Debug vs Player UI Boundary for Status

Status data has two display layers:

| Layer | Content | Visibility |
| --- | --- | --- |
| Player Layer | Player text, warning chips, next action, readable values. | Basic mode, always in player UI. |
| Debug Layer | PlanHash, SampleIndex, ResourceId, SocketPath, CandidateScores, raw telemetry. | Only in DebugDiagnostics or active debug preset. |

**Rules:**

- Player layer must not show debug IDs.
- Debug layer must not be the only player surface.
- Debug overlays must be labeled as debug/prototype/diagnostic.
- Debug values must not pollute the player layer.
- See `docs/ux/debug-vs-player-ui-policy.md` for function-key policy and
  diagnostic-promotion rules.

**Debug-only status values (never in player layer):**

```text
PlanHash, PlanRevision
SampleIndex, CandidateScores
DesiredAccel, SolverBranch
ResourceId, SocketPath
Raw transform paths
Internal state enums
```

**Player-facing status values (always acceptable in player layer):**

```text
Route valid/invalid (with reason from taxonomy)
ETA (formatted)
Fuel estimate (formatted)
Brake reserve (sufficient/insufficient)
Arrival state (Idle/EnRoute/Holding/Complete)
Warning chips (label + severity + action)
Failure reason (player text + next action)
Cargo mass/volume (formatted)
Detection confidence (Low/Medium/High)
Legal status (Legal/Illegal/Risky)
```

## 8. Screenshot / Evidence Matrix

This matrix defines the evidence states needed for future UI runtime work. It is
not captured in this spec-only change; it defines what later runtime changes must
produce.

| Surface | Evidence State | What to Verify |
| --- | --- | --- |
| Ship HUD — no target | Basic HUD, mode visible, no debug panels | Clean baseline, no debug IDs |
| Ship HUD — target selected | Target name + distance, compact nav context | Nav status from Navigation Computer |
| Ship HUD — autopilot active | Autopilot state visible, segment/timing if relevant | Telemetry codes translated |
| Ship HUD — fuel warning | `NAV_FUEL_INSUFFICIENT` chip visible | Chip from authority taxonomy |
| Ship HUD — no authority | `NAV_NO_AUTHORITY` chip + next action | Chip + action from taxonomy |
| Ship HUD — plan invalidated | `NAV_PLAN_INVALIDATED` chip + replan action | Visible needs-replan, no silent replan |
| System Map — route preview | ETA, fuel, brake reserve, authority warnings | All from Navigation Computer |
| System Map — zone overlay | Legal zone colored, faction label | Legality from Faction/Legal Service |
| System Map — hazard markers | Scanner hazard with confidence label | Confidence from Scanner, not self-assessed |
| Local Map — hazard filter | Hazards visible, scale labeled, orientation labeled | Hazards from Scanner authority |
| Local Map — combat filter | Friend/foe with confidence | Ownership from Scanner hint |
| Suit HUD — scanner prompt | Object name, action, tool, owner, risk/legal | Legal from Faction/Legal, owner from Scanner hint |
| Suit HUD — oxygen low | `SUIT_OXYGEN_LOW` chip visible | Chip from Suit/Vitals Service |
| Suit HUD — hazard exposure | `SUIT_HAZARD_EXPOSURE` chip visible | Chip from Scanner/Suit authority |
| Terminal — buy/sell | Owner, price, legality visible | Legality from Faction/Legal Service |
| Terminal — refuel | Fuel estimate from Navigation Computer | Fuel from Navigation authority |
| Terminal — cargo transfer blocked | Failure reason visible with player text + next action | Reason from Cargo Service taxonomy |
| InventoryCargo — legal marker | Resource shows legal/illegal/risky | Legal from Faction/Legal Service |
| InventoryCargo — containment | `CARGO_CONTAINMENT_VIOLATION` visible | Chip from Cargo Service |
| Any — debug overlay | Debug IDs visible only in debug layer | No debug IDs in player layer |

### Acceptance for each screenshot

```text
- No overlaps
- Critical focus area clear
- Text readable
- Mode visible
- Next action visible
- Blocked action explained with player-facing reason
- No debug IDs in player layer
```

## 9. Next Derivable Runtime Tasks

From this document, the following UI runtime tasks are directly derivable:

1. **Status Snapshot Contracts** — Define read-only snapshot interfaces for each
   authority service (Navigation, Cargo, Scanner, Faction/Legal, Ship Authority,
   Suit/Vitals).
2. **HUD ViewModel Slice** — Ship HUD reads Navigation-Telemetry, Cargo-Mass,
   Scanner-Warning, Ship-Authority; renders chips per taxonomy; no
   self-computation.
3. **System Map Status Slice** — Map reads Route Validity, Fuel, ETA, Legal-Zone;
   shows route preview and authority warnings.
4. **Suit HUD Slice** — Suit HUD reads Suit/Vitals, Scanner-Hazard,
   Scanner-Confidence; shows hazard chips and interaction prompts.
5. **Terminal/Legal Slice** — Terminal reads Faction/Legal, Cargo-Transfer;
   shows legal/risk and transfer feasibility.
6. **Warning Chip Component** — Shared UI component that renders chip code +
   severity + action from the taxonomy.
7. **Failure Reason Component** — Shared component that renders failure code →
   player text + next action.

Each task has clear inputs (which authority owner to read) and outputs (which
codes/chips/texts to show), without own truth computation.
