# RCS Nozzle Cache Refresh

## Requirements

### Requirement: RCS steady state does not rescan imported hierarchy

`RcsThrusterController.ApplyControls()` MUST NOT perform a full transform hierarchy scan during each physics update when the nozzle root and dirty state are unchanged.

#### Scenario: Clean nozzle cache

- Given nozzles have been refreshed and no dirty flag is set
- When `ApplyControls()` runs repeatedly
- Then the controller uses the cached nozzle list
- And does not call a full transform hierarchy scan each time

### Requirement: Explicit dirty refresh

`RcsThrusterController` MUST expose `MarkNozzlesDirty()` or equivalent. A dirty controller MUST refresh nozzles once, clear the dirty flag, and then return to O(1) steady-state checks.

#### Scenario: Imported bind creates sockets

- Given a binder or visual switch creates or activates functional imported sockets
- When it marks nozzles dirty
- Then the next explicit refresh rebuilds nozzle cache once
- And later physics updates do not rescan until dirty again

### Requirement: Visual-only imported mode preserves functional RCS root

Visual-only imported modes MUST NOT automatically replace generated functional RCS nozzles with imported visual transforms.

#### Scenario: Imported visual-only switch

- Given a generated ship has 20 generated functional RCS nozzles
- When F6 switches to imported Scout or Cargo visual-only mode
- Then installed functional nozzle count remains generated
- And the imported visual hierarchy is not used as RCS search root unless functional imported sockets are explicitly enabled

### Requirement: Functional imported sockets are opt-in

A functional imported sockets mode MAY use imported sockets for RCS/weapon behavior, but only when an explicit bool/mode such as `useImportedFunctionalSockets` is enabled and the cache is refreshed deliberately.
