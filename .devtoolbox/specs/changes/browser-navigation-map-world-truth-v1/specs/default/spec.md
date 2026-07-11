# Browser local navigation map world truth

## Requirements

### Deterministic runtime snapshot

The browser runtime SHALL emit a deterministic `NavigationMapSnapshot` for the current absolute world state. The snapshot SHALL include frame identifiers, active ship, all runtime planner targets, selected target ID, current RoutePlan geometry, runtime obstacles, resident world entities, and streaming/registry provenance. Equivalent absolute world input SHALL produce equivalent snapshot content and signature even when the floating-origin local frame shifts.

### Single semantic projection

The planner map SHALL render current ship, all targets, route, obstacles, and resident world entities through one projection pipeline derived from `NavigationMapSnapshot`. Decoration SHALL remain separate from semantic geometry.

### Active ship identity and orientation

The current ship SHALL use an active-ship presentation descriptor rather than a generic fixed polygon. The marker SHALL display ship name and blueprint/visual identity. In north-up mode the world SHALL remain north-up and the ship marker SHALL follow runtime heading. In ship-up mode the world SHALL rotate around the ship heading and the ship marker SHALL remain upright.

### World entity residency

The map SHALL adapt active `WorldChunkRegistry` and `WorldStreaming` state. Full and Snapshot resident entities SHALL be visible according to runtime layer policy, while Dormant entities SHALL not be rendered. The renderer SHALL not own entity truth.

### Local navigation behavior

The surface SHALL be titled `LOCAL NAVIGATION MAP`. It SHALL provide deterministic focus, pan, zoom, orbit/north-up switching, and a real meter/kilometer scale bar. Focus SHALL fit semantic geometry. Runtime target markers SHALL be clickable by exact target ID and SHALL use the existing planner selection command path.

### No static semantic positioning

The semantic surface SHALL NOT reference `/concept/planner-system-map-clean.png`, fake semantic map bodies, fixed ship/target/hazard coordinates, or target-ID-specific CSS positions. Adding an arbitrary target SHALL require no CSS change.

### Planner invariants

Map rendering SHALL NOT invoke the planner, silently replan, modify flight physics, or change exact preview-locking behavior.

## Required verification

- same world input produces same map snapshot
- floating-origin shift preserves absolute map relationships
- ship marker follows runtime position
- ship marker orientation follows runtime orientation
- adding an arbitrary target requires no CSS change
- target click selects exact target ID
- route nodes match RoutePlan geometry
- obstacle circles match runtime positions/radii
- chunk entity becomes visible when resident
- static planner background is absent from computed style
- no target-specific percentage positions remain
- normal `/` Playwright flow without TestBridge opens planner, selects arbitrary target, verifies runtime-derived geometry, observes live ship movement and heading, exercises Focus/Orbit/Zoom, and captures FHD/QHD evidence