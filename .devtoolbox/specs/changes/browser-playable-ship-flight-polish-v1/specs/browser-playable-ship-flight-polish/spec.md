# Capability: Browser Playable Ship Flight Polish

## Requirements

### POLISH-001 Ship visual source and fallback

The browser ship visual MUST retain a procedural fallback and MAY use a browser-readable Demo Scout GLB only when the asset can be validated and consumed without Unity, new fragile runtime dependencies, or `Assets/**` mutation.

If the GLB is not integrated, the runtime MUST expose a clear visual source state such as `ProceduralFallback` / `GLBUnavailableFallback`, and evidence MUST document why the fallback remains active.

### POLISH-002 Marker/socket descriptor validation

The ship visual descriptor MUST expose and test marker/socket coverage for at least:

- hull/ship body identity,
- cockpit/front marker,
- main engine marker,
- at least four RCS markers,
- muzzle placeholder,
- camera anchor.

Marker validation MUST fail if these required descriptors disappear.

### POLISH-003 Player HUD readability

The player HUD MUST show scalar speed/velocity information in player-facing text and MUST NOT show raw `(x, y, z)` velocity component triples in the default HUD. Full vectors MAY remain in telemetry, TestBridge snapshots, or evidence JSON.

### POLISH-004 Desktop/mobile capability wording

The help text and evidence MUST clearly state that manual flight uses keyboard/mouse controls in this slice and that mobile is currently target selection/autopilot-only. This MUST NOT add mobile touch flight controls.

### POLISH-005 VFX and naming polish

Main thruster VFX scaling MUST use acceleration magnitude rather than only the world-X acceleration component. Misleading local names in the drift-preserving cancel path SHOULD be renamed when present.

### POLISH-006 Existing invariants preserved

The change MUST preserve:

- target selection, route preview, locked plan hash, and no-silent-replan behavior,
- actuator-driven autopilot and no normal target/waypoint snap,
- TestBridge gated behind `?testBridge=1`,
- HUD owner-snapshot consumption,
- no `Assets/**` modifications.

## Non-Goals

- Production GLB parity if it requires loader risk or marker compromise.
- Touch/mobile manual flight controls.
- New gameplay systems.
- Unity behavior parity beyond documented browser intent.
