# browser-playable-ship-flight Specification

## Capability: Playable Browser Ship Flight

### PLAY-001 Ship visual

The browser renderer MUST show a real ship visual instead of the prior cone-only marker. The visual MUST expose, in render/test descriptors, at least:

- hull/body identity,
- cockpit/front marker,
- main engine marker(s),
- at least four RCS marker positions,
- muzzle or weapon marker placeholder,
- camera anchor.

If an existing browser-usable ship asset can be safely used without mutating `unity-legacy-final-2026-07:Assets/**`, the implementation MAY copy it into browser public assets and consume it from there. If not, the implementation MUST provide a temporary procedural low-poly ship and document the parity gap.

### PLAY-002 Flight State V2

The owner ship state MUST include browser-native flight fields:

- orientation quaternion,
- angular velocity,
- throttle,
- control mode: `Cruise | Precision | Translation`,
- `rcsEnabled`,
- `sasEnabled`,
- main throttle command,
- translation command,
- rotation command,
- actuator telemetry: `mainThrustActive`, `rcsTranslationActive`, `rcsRotationActive`, `sasCorrectionActive`, `lastAppliedAcceleration`, `lastAppliedAngularAcceleration`.

HUD, renderer, TestBridge, and evidence MUST consume these fields from snapshots/descriptors; they MUST NOT recompute flight truth.

### PLAY-003 Manual controls

The browser MUST support keyboard/mouse flight controls:

- `W/S` pitch,
- `A/D` yaw,
- `Q/E` roll,
- `Shift/Ctrl` throttle increase/decrease or thrust command,
- `X` cut throttle,
- `Y` or `Z` full throttle,
- `R` toggle RCS,
- `T` toggle SAS,
- `CapsLock` cycle `Cruise -> Precision -> Translation`,
- `H/N` vertical translation in Translation mode,
- `V` cycle camera mode,
- RMB + mouse orbit/look,
- wheel zoom.

Manual controls MUST dispatch runtime commands or input state into the owner flight controller. UI and renderer MUST NOT directly mutate core truth.

### PLAY-004 Chase camera

The renderer MUST implement camera modes:

- `ChaseLocked` as first/default mode,
- `OrbitInspect`,
- `Side`,
- `FreeInspect`.

`ChaseLocked` MUST follow ship position and orientation; the camera MUST NOT remain static at a hardcoded world point.

### PLAY-005 Thruster and RCS effects

The renderer MUST show simple low-poly VFX:

- main engine flame/cone when actuator telemetry indicates main thrust is active,
- RCS puffs at marker positions when telemetry indicates translation, rotation, or SAS correction activity,
- visible control-mode state differences where practical.

VFX MUST be tied to actuator telemetry, not raw keydown state.

### PLAY-006 Autopilot through actuation

Autopilot MUST drive the same flight/actuator layer used by manual controls. It MUST produce desired acceleration/brake/attitude requests that the flight controller applies.

Normal runtime autopilot execution MUST NOT:

- snap ship position to route waypoints,
- snap ship position to target,
- zero velocity at waypoints,
- zero velocity in idle/no-plan state,
- silently replace the locked plan or `planHash`.

Arrival is valid only when:

- `distance <= arrivalEnvelope.radius`,
- `speed <= terminalSpeed` if specified,
- locked `planHash` is unchanged,
- no replan replacement occurred.

Any temporary migration snap MUST be explicitly debug-only and MUST NOT be used by player runtime or final evidence.

### PLAY-007 HUD and help

The player HUD MUST show, from telemetry/ViewModels only:

- control mode,
- throttle,
- velocity and speed,
- RCS/SAS state,
- camera mode,
- autopilot state,
- selected target and distance,
- warnings,
- simple keybind/help hint.

The HUD MUST preserve player/debug separation: no raw JSON, no TestBridge wording in default UI, no planner internals as player language.

### PLAY-008 Evidence and tests

The change MUST add or update:

- unit tests for control modes, throttle, RCS/SAS toggles, flight integration, no snap, cancel keeps drift, and autopilot actuator requests,
- Playwright tests for ship visual, ChaseLocked camera, manual movement/rotation, main thruster VFX, RCS VFX, autopilot movement, arrival envelope without snap, stable `planHash`, and default TestBridge absence,
- screenshot evidence for manual flight, autopilot burn, RCS translation, and autopilot arrival,
- docs/evidence that list Unity parity gaps for the next slice.
