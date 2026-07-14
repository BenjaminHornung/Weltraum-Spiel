# Capability: Hestia Surface Lab visual guidance

## Requirements

### Audited source set

The change SHALL record exact path, LFS/materialization state, visual-review status, visual function, terrain, verticality, water/coast, rocks, vegetation, palette, lighting, atmosphere, depth, scale, HUD density, concept conflicts, suitable use, and rejected/deferred use for every requested source image.

The five primary images SHALL have a comparison matrix for terrain silhouette, water, fog, vegetation density and scale, dominant/accent hue, lighting, traversal readability, low-poly suitability, and Surface-Lab priority.

Missing or pointer-only images SHALL NOT be described as visually reviewed. Derived values dependent on missing evidence SHALL be Provisional.

### Preset contract

The preset SHALL use ID `hestia.nebelwald-archipelago.preview.v1`, status `design-guidance`, and `runtimeAuthority: false`. It SHALL distinguish MUST, SHOULD, MAY, MUST NOT, and DEFERRED behavior and include measurable preview ranges without claiming runtime or performance proof.

The preset SHALL define terrain, the required compact palette, five material families, three vegetation categories, fog, water, lighting, five reference camera shots, 1920×1080 screenshot composition, Surface-Lab chrome, and an observable Pass/Warning/Fail matrix.

### Machine-readable handoff

The JSON SHALL be valid comment-free JSON with stable field order, explicit provisional fields, existing source paths only, Hex colors (optionally normalized RGB), no Three.js classes or shader code, and no runtime import expectation.

### Parallel-agent handoff

The concise handoff SHALL provide Top 10 Visual Priorities, Top 10 Visual Failure Modes, palette, terrain/fog/water/vegetation/camera targets, screenshot acceptance, and deferred items. Its values SHALL match the full preset and JSON.

### Scope protection

Only the approved change directory and four approved documentation outputs may change. No image, binary, LFS pointer, source, test, runtime, evidence, package, roadmap, asset, or Unity path may change.

## Scenarios

1. If all ten existing target PNGs materialize, the audit may classify observations as Direct Visual Evidence.
2. If requested image 41 is absent, the audit records it as missing and does not substitute a same-number unrelated image.
3. If DevToolbox rejects the worktree as unauthorized, no override or manual task closure occurs; the blocker is documented and Git validation continues.
4. A runtime agent can manually copy guidance values, but the application never imports `docs/**` at runtime.
5. Fog or vegetation that conceals chunk defects fails acceptance even if the screenshot appears atmospheric.
