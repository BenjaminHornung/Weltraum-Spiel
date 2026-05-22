# Player Target Indicators

## Requirements

### Requirement: Target indicator snapshot exposes visible player targets

The Player HUD SHALL build a target indicator snapshot from existing gameplay data sources rather than debug windows or duplicated scene searches.

The snapshot SHALL include indicators for:

- selected navigation target when present
- selected combat target when present
- active docking target only when the docking context is visible/active
- active arena objective targets while the arena objective is visible

Each indicator SHALL carry kind, label, world position, distance from the ship, severity/status where available, and enough state to render selected targets differently from secondary objective targets.

#### Scenario: Combat target selected

When a combat target is selected, the snapshot SHALL contain a selected combat indicator with range, health fraction, and weapon/fire status.

#### Scenario: Arena active without selected combat target

When arena targets are active but no combat target is selected, the snapshot SHALL contain compact objective indicators for the active arena targets.

#### Scenario: Docking not active

When a docking port exists but the docking snapshot is not visible, the HUD SHALL NOT show a docking target indicator.

### Requirement: Screen-space overlay renders onscreen and offscreen cues

The Player HUD SHALL render target indicators through the existing Screen Space Overlay canvas.

The render path SHALL show:

- onscreen navigation diamond over the projected target
- onscreen combat brackets over the projected combat target
- onscreen docking cue over the projected docking port when docking is active
- compact objective diamonds for arena targets
- offscreen edge arrows/chevrons for selected targets outside or behind the camera view
- distance labels for selected/contextual targets without adding large center text blocks

#### Scenario: Target is behind the camera

When a selected target projects behind the camera, the indicator SHALL be clamped to the safe edge and marked as offscreen instead of disappearing or placing text in the center reticle.

#### Scenario: Target is inside fixed panel zones

When a projected marker would overlap fixed HUD panels, the marker SHALL clamp to the target-indicator safe rect and labels SHALL hide or shorten before overlapping panels.

### Requirement: HUD remains responsive and uncluttered

Target indicators SHALL NOT overlap the top strip, radar, objective panel, ship systems, context panel, or bottom bar across the tested aspect ratios.

The implementation SHALL keep the existing Basic Player HUD path and SHALL NOT add an IMGUI render path or a separate target-marker window.
