# Capability: Hestia Voxel Runtime V2 Coast/Lush Visual Parity

## Requirement: Shared deterministic macro world

The V2 presentation shall consume one deterministic seed/version macro
descriptor for Near generation and render-only Mid/Far projections. The
descriptor shall expose stable terrain, water, biome, slope and moisture facts
without owning mutable cells, edits, collision or renderer state.

### Scenario: Same macro input

Given the same seed, world version and sample coordinates, when the descriptor
is created twice, then its serialized feature facts and samples are byte-stable.

### Scenario: Changed macro input

Given a changed seed, when valid coordinates are sampled, then the descriptor
changes valid macro content without using `Math.random`, wall-clock time,
camera state or load order.

## Requirement: Wide irregular coast composition

The canonical views shall show irregular islands/peninsulas, a central or
offset massif, broad valleys, cliffs, varied terraces, connected lagoon/river
waterways, strata and dry first-person clearings. Perfect circular islands,
repeating horizontal bands and a visible rectangular Near boundary are not
accepted.

### Scenario: Near/Mid/Far agreement

Given a coordinate represented by more than one presentation scale, when the
projections are generated, then their coastline and terrain height agree within
the documented quantization/occlusion tolerance and no transition gap is visible.

### Scenario: Hydrology direction

Given the deterministic descriptor, then river/channel water connects from a
higher source region to sea/lagoon and does not rise above its source terrain or
intersect the dry spawn.

## Requirement: Lush material and vegetation composition

The scene shall contain readable wet/dry/rock/sand/soil/wood/leaf families,
deterministic tint/wetness variation, grouped ground vegetation and at least
four connected tree archetypes: umbrella, buttress-root, coast/savanna and
mangrove/lagoon. Render-only flora shall be support-checked and invalidated by
an affected Near edit without becoming gameplay truth.

### Scenario: Archetype integrity

Given a seed and descriptor, when tree anchors are generated, then every
archetype is deterministic, connected to supported terrain, has branches and/or
roots, and is not only a spherical lollipop crown.

### Scenario: Local decorative invalidation

Given an accepted Near edit under render-only flora, when the dirty support area
is rebuilt, then unsupported flora is removed/rederived while authority cells,
collision and edit ordering remain unchanged.

## Requirement: Horizon-scale water, sky and atmosphere

Canonical beauty views shall use a circular/horizon-scale static water pass with
channel/shore/depth cues, transparency, Fresnel/glint and bounded animated
surface variation. A Three-owned sky/horizon, low-poly cloud clusters and
foreground/mid/far haze shall replace the empty CSS-only gradient.

### Scenario: Beauty environment

Given any canonical beauty camera, when the scene renders, then no rectangular
water-plane edge, empty cyan half-frame or finite proxy edge is visible; water,
clouds, lighting and haze preserve block silhouettes and material readability.

## Requirement: Budgeted render projection

Near terrain shall use bounded region replacement and shared palette-aware
materials; Mid/Far terrain and vegetation shall use bounded merged/instanced
products. Local edits shall replace only affected Near regions and no new
Long Task >=50ms or unbounded queue may be introduced.

### Scenario: Local edit projection

Given an accepted local cut, when the replacement mesh becomes current, then the
authority remains the sole truth, only affected render products are rebuilt, the
current visible revision converges, and existing collision/edit behavior remains
functional.

## Requirement: Canonical visual evidence and owner gate

The change shall produce repeated 1920×1080 screenshot series for fixed
Coastal Valley, Archipelago/Mountain, Wetland/Root and First-Person cameras,
plus before/after cut captures, side-by-side target/baseline/current boards,
decoded dimensions/hashes and baseline-vs-final telemetry. Beauty captures shall
contain no debug HUD. A visual candidate is not PASS until the repository owner
explicitly accepts it.

### Scenario: Reproducible candidate

Given the same production build, seed and camera preset, when the screenshot
series is captured twice, then geometry and camera pose remain stable within the
documented perceptual/evidence tolerance and all functional V2 E2E tests remain
green.

## Requirement: Compatibility and guardrails

The normal route and Surface Lab remain unchanged; the V2 query gate remains
exact; Three imports remain in `render-three/**`; no package/lockfile/Unity
asset/external-asset change is introduced; authority DDA, CAS edits, collision,
worker scheduler and stale-result rejection remain green.
