# Spec: browser-flight-feel-rcs-sas-parity

## ADDED Requirements

### Requirement 1: Explicit flight control modes

The browser SHALL support the control modes `Cruise`, `Precision`, and `Translation` as explicit behavioral states, not just labels.

Cruise SHALL be the main-throttle flight mode.

Precision SHALL differ from Cruise in control authority and response feel.

Translation SHALL emphasize linear RCS movement while preserving a clear attitude-control contract.

#### Scenario: mode cycle order remains stable

Given the ship is in Cruise
When the player cycles control mode
Then the mode SHALL advance to Precision, then Translation, then back to Cruise.

#### Scenario: Precision is not a Cruise alias

Given the ship is in Precision
When the player applies attitude input
Then the browser SHALL use a distinct Precision response profile rather than Cruise defaults.

### Requirement 2: Persistent throttle feel

The browser SHALL treat throttle as a persistent applied-state control with spool or ramp behavior.

Throttle SHALL expose a distinction between commanded throttle and applied throttle feel.

Throttle SHALL NOT snap to zero merely because manual input is absent.

#### Scenario: throttle ramps instead of jumping

Given Cruise is active
When the player increases throttle
Then the applied throttle SHALL rise smoothly rather than changing as an instantaneous step.

#### Scenario: idle/manual preservation remains intact

Given the executor is preserving an idle or manual request
When no fresh manual input arrives
Then the browser SHALL keep the last protected request behavior and SHALL NOT zero it unexpectedly.

### Requirement 3: RCS authority is separated from main thrust

The browser SHALL keep main thrust, RCS translation, and RCS rotation as distinct authority paths.

Cruise SHALL allow main thrust.

Precision and Translation SHALL force or prefer RCS authority according to the control contract.

The browser SHALL expose whether RCS translation or rotation is active.

#### Scenario: translation and rotation are independently observable

Given RCS is enabled
When the player issues translation input without rotation input
Then the browser SHALL report translation activity without implying rotation activity.

#### Scenario: main thrust is not active outside Cruise

Given the ship is in Translation
When the player applies throttle input
Then main-thrust activity SHALL remain disabled by mode.

### Requirement 4: SAS behavior is readable and mode-aware

The browser SHALL provide SAS behavior that is readable to the player and tied to authority availability.

SAS SHALL expose an effective or ineffective state.

SAS SHALL respect control authority and SHALL NOT silently act when authority is unavailable.

SAS behavior SHALL use browser-native damping/stabilization as the v1 baseline. Hold-attitude behavior MAY be added only if it is explicitly implemented, tested, and documented; otherwise it SHALL be deferred rather than hidden inside damping.

#### Scenario: SAS reports ineffectiveness when authority is missing

Given SAS is enabled
And the browser lacks the required authority for stabilization
When stabilization is evaluated
Then the player-readable state SHALL indicate that SAS is ineffective.

#### Scenario: SAS changes feel when enabled

Given the ship has rotating motion
When SAS is enabled
Then the browser SHALL produce a stabilization response distinct from the no-SAS case.

### Requirement 5: Manual pitch, yaw, and roll remain distinct inputs

The browser SHALL preserve manual pitch, yaw, and roll intent as distinct rotation inputs.

Mode changes MAY alter response curves and masking, but SHALL NOT collapse pitch, yaw, and roll into a single undifferentiated control path.

#### Scenario: rotation input remains available across modes

Given the player provides pitch, yaw, and roll input
When the control mode changes between Cruise, Precision, and Translation
Then the browser SHALL keep rotation intent observable in all modes that permit it.

### Requirement 6: HUD and diagnostics are player-readable

The browser SHALL expose flight-status telemetry that explains why controls are active, disabled, or ineffective.

The HUD SHALL surface at least control mode, throttle status, RCS status, and SAS status.

The HUD SHOULD explain assist or ineffective states with readable labels rather than raw flags only.

#### Scenario: status labels explain control state

Given a flight state with active mode, throttle, RCS, and SAS
When the HUD renders status
Then the player SHALL see readable labels that explain the current control condition.

### Requirement 7: RCS visualization is staged and browser-native

The browser SHALL provide an RCS visualization path that does not depend on Unity nozzle hierarchy or GLB socket names.

Visualization MAY start as debug markers, simple per-marker highlights, or other browser-native primitives.

#### Scenario: visualization does not block on asset hierarchy

Given RCS activity is present
When visualization is produced
Then the browser SHALL be able to show the activity without requiring imported Unity nozzle discovery.

### Requirement 8: The executor no-snap / no-idle-zero contract remains protected

The browser SHALL preserve the current executor behavior that keeps idle/manual requests intact when that contract is active.

Flight-feel changes SHALL NOT introduce a new path that zeroes or snaps protected requests when manual input is absent.

#### Scenario: no-snap / no-idle-zero regression is blocked

Given an idle or protected manual request
When the browser executes a flight update without new input
Then the request SHALL remain protected and SHALL NOT snap to zero.

### Requirement 9: Camera changes are presentation-only

Camera mode changes SHALL NOT alter flight authority, throttle behavior, RCS behavior, or SAS behavior.

Camera mode MAY change readability and perceived feel, but it SHALL remain presentation-only.

#### Scenario: camera mode does not change control authority

Given the ship is in any valid flight mode
When the player cycles camera modes
Then the current flight authority SHALL remain unchanged.

## Evidence scenarios

The implementation SHOULD be verified with browser evidence that covers:

- Cruise, Precision, and Translation switching
- throttle ramping
- RCS translation versus rotation separation
- SAS on/off and ineffective states
- camera changes that do not alter control authority
- no-snap / no-idle-zero regression
