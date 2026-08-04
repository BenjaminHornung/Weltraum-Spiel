# Hestia Unified Surface Material Rules V1

**Decision:** Approved 2026-08-03  
**Material table version:** `hestia.unified-surface-material-rules.v1`  
**Scope:** Common terrain/tree authority material policy. This is a decision
record only; it adds no runtime implementation.

**Editorial correction note (2026-08-03):** This correction clarifies units,
provenance, raw-ID mapping, staged budgets and Phase 3 evidence obligations.
Approved numeric values and the V1 version are unchanged.

The density, support-contact capacity and span values below are local gameplay
tuning values for deterministic admission and fracture. They are not
continuous cohesion, strength or stress mechanics, or discovered physical
truth.

## Approved V1 table

| Authority group | Registry members | Density | Support contact capacity | Maximum unsupported span | Destructible | Anchor eligible | Overload / fracture result |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| Rock | `Rock` | 2400 kg/m³ | 2000 kg-eq per support contact | 2.0 m | yes | yes | Complete connected island candidate / atomic admission refusal |
| Ground | `WetSoil`, `MossCover`, `DenseBiologicalSurface` | 1600 kg/m³ | 64 kg-eq per support contact | 0.50 m | yes | no | Complete local support-collapse candidate / atomic refusal |
| Root | tree `Root` structural IDs | 850 kg/m³ | 20 kg-eq per support contact | 1.25 m | yes | yes | Rootless component detaches |
| Wood | tree `Wood` structural IDs | 650 kg/m³ | 600 kg-eq per support contact | 2.50 m | yes | no | Overloaded connected component detaches |
| Canopy | tree `Canopy` structural IDs | 120 kg/m³ | 192 kg-eq per support contact | 1.125 m | yes | no | Detaches only as its containing connected component; never per-cell bodies |
| Air / Water / decorative scatter | `Air`, `ShallowWaterBoundary`, decorative sprouts and caps | no mass | no support | no span | no | no | Non-solid; no structural participation |

There is no `Sand` group in V1.

## Registry and material mapping

Raw registries remain preserved and distinct. Existing Structural raw IDs are
`1 = Root`, `2 = Wood`, `3 = Canopy`, while Structural ID `0` is `Air`.
Voxel byte ID `0` is `SolidRock`. These IDs are mapped, never equated.

- Voxel `SolidRock` maps to authority group `Rock`.
- Voxel `WetSoil`, `MossCover` and `DenseBiologicalSurface` map to `Ground`.
- Tree Structural IDs `1`, `2` and `3` (`Root`, `Wood` and `Canopy`) map to
  their corresponding authority groups above.
- `ShallowWaterBoundary` and decorative sprouts/caps remain non-solid and do
  not participate in support, collision, mass or fracture.
- Air, water and decorative scatter have no mass, support, collision or
  fracture participation.

The existing `0.125 m` value is the linear cell edge and quantization quantum;
the corresponding cell volume is exactly `0.001953125 m^3`. Root/Wood/Canopy
density values (`850/650/120 kg/m^3`) are current Hestia source facts reused by
the authority. Rock/Ground density values (`2400/1600 kg/m^3`) are explicitly
approved game-tuning values, not discovered physical truth.

## Support and fracture semantics

A **support contact** is an orthogonal frontier contact from a detached-side
component into an anchored or support-connected component. Its capacity comes
from the supporting-side material, not the detached-side material.

A component stays supported only when all of these conditions hold:

1. it has an explicit anchor path;
2. its component mass is less than or equal to the sum of its support-contact
   capacities; and
3. its local cantilever run from the latest downward (`-Y`) support is less
   than or equal to the applicable group span.

`span` means the lateral/cantilever run from the latest downward support. For
every local cantilever run, the effective span is the minimum approved span
among all occupied/supporting material groups participating in that run. It is
not a whole AABB span and not a root-to-tip distance. Support cannot be
inferred from a mesh, camera or colour.

Support and fracture use six-neighbour connected components. Existing
revision/CAS rules and atomic publication remain in force. A detached result
is a complete fragment body source, or the whole batch is refused with a typed
refusal. There is no partial presentation/collision update, hidden teleport or
global physics correction. The staged budgets are 8 dynamic bodies total, 64
colliders per body at body admission, and 256 contacts per outer simulation
tick at the solver/step stage. Adaptive continuation/refinement is attempted
before final body/collider refusal where existing policy permits; any final
refusal is typed and whole-result atomic. The 256-contact solver budget is not a
material admission cap.

The overload outcomes are therefore:

- Rock: admit a complete connected island candidate or refuse atomically.
- Ground: admit a complete local support-collapse candidate or refuse
  atomically.
- Root: detach the rootless component.
- Wood: detach the overloaded connected component.
- Canopy: detach only the containing connected component, never individual
  cell bodies.

Water and decorative material cannot anchor. Raw registry IDs cannot be
conflated. An unsupported or overloaded candidate fails atomically when the
admission budget rejects it. Continuous cohesion, strength and stress
mechanics are explicitly deferred; V1 has no continuous stress solver.

## Calibration boundary

The tree calibration fixture records an intact tree at **3490 cells /
2535.4296875 kg / 162 root anchors**. The third standard prepared-fire cut
records a **1481.9140625 kg crown and 55/64 colliders**. These observations
justify the approved gameplay tuning values; they are test calibration, not an
absolute physics claim.

## Hash and implementation boundary

Source/runtime Phase 3 work must derive one immutable material table and its
`materialTableContentHash` through the existing `hashAdaptiveCanonical`
canonical owner. The exact raw-ID mapping and the exact
`materialTableVersion` must be bound into snapshot, command and result
commitments and covered by Phase 3 tests. Reuse the existing hasher and
canonical value boundary; do not add a duplicate hasher or a value normalizer.
The runtime hash is pinned by Phase 3 tests, and Phase 2 hashes must remain
unchanged until the current adaptive table version is bridged through that
owning type/canonical boundary and parity tests pass.

This decision record is externally hash-bound by its SHA-256 in the companion
design, authority spec, Task 22 gate and ExecPlan. Any material-rule change
requires a new version and new user approval; it must not mutate this V1
decision record in place.
