# PLAY-02 Factory visual derivatives

These project-original hard cuboid models preserve the existing native part IDs,
source boxes, ports, supports and machine pivots at source head
`96cced23cd285b57f8a557d01ac9ed8a158c927f`. The existing Cutter/Former force paths
remain intact. Functional additions include casing seams, service panels,
infeed rollers, bench vise/tools/channel legs, storage access, carrier locking
points, belt ribs, photovoltaic cell groups and five distinct material families.
They use the existing graphite, warm grey, petrol, amber and dark PV palette.

The original 22 real `.blend` sources were saved, reopened from disk and exported using
Blender 4.3.2 and the existing Hestia exporter / glTF addon 4.3.47. The generator
is included for reproducibility. It is not a replacement for those source files.

This delivery is **visual-only**. Original source boxes remain collider and
installation authority. Exported canonical semantics deliberately say
`Decorative`, `collisionPolicy=None`, `navigationPolicy=None`,
`destructible=false`. Native removal must remove the matching presentation part;
this flag grants no immunity to a native damaged part. The accepted
Asset-to-Voxel/Structural-S1 bridge remains **KNOWN_GAP_NOT_DELIVERED**.
Runtime loading, confirmed work/animation, finite lot custody and actual ordinary
gameplay proof belong to the Integrator. Human Art acceptance remains
`OWNER_REVIEW_PENDING`.

The manifest is available at `/factory/play-2026-10-12/manifest.json` after
Integrator adoption. Each entry binds the historical original owner-file
SHA256, actual preserved owner source blob, exact native source snapshot,
definition reference or declared visual-only anchor, native blend, GLB, exporter
report, provenance and original project license. Owner-file SHA is provenance;
the current runtime compares actual definition/geometry and readview identity.
An unrelated later TypeScript owner-file edit is not itself a geometry migration.

Each GLB has exactly one mesh node per native part ID, named by that ID. All
detail geometry is merged into that part's mesh and disappears with the part.
No detached decorative child can restore a removed part. Nodes have neutral
translation, rotation and scale; vertices are already in the existing local
runtime frame: **metres, +X east, +Y up, +Z north, right-handed**. Blender meshes
use `(x, -z, y)` with +Z up; the standard glTF exporter returns exactly `(x,y,z)`.
Exporter inventory bounds are in Blender's authoring axes; GLB position-byte
checks and manifest native bounds are in runtime XYZ. The nonexported
`native_reference_not_exported` collection preserves exact box/port/pivot/support
witnesses. It adds no runtime geometry or collision.

`extras.hestia.partId` carries the existing exporter semantic ID.
`extras.playBinding` carries `partId`, `sourceSHA256`, `sourceAssetId`,
`definitionId`; no `parentPartId` means a null root parent. The manifest contains
the complete part list, root parent mapping and native reference paths. Source
SHA binds original source-file bytes, separately from `definitionRef.digest`.
There are no remote textures, models, fonts or provider outputs.

Cargo is only the existing 1.5 × 1.5 × 1 m access segment, in closed/open visual
variants. Its ground-center local origin maps to the native world's
`[-5.5, 1.25, 13.125]` metres; the native box center is `[-5.5, 2, 13.125]`.
No large wreck hull, extra salvage, walkable ramp or ship flight is provided.
Carrier variants use the original 1 × 1 × 1.5 / 1 × 1 × 1 / 0.5 × 1 × 0.5 m
payload envelopes and four existing supports, without a free new rig item.
Material appearances represent a single actual lot; their small depiction
envelopes never define mass, packing or inventory. Cable end/link meshes are
visual anchors for an actual paid route. The one-metre link must only be mapped
to the approved route, without changing its paid millimetre length or ports.
Storage is empty geometry; visible goods must come from actual local stock.

The R2 correction adds `play_storage_inspection_open_v1` at
`/factory/play-2026-10-12/storage-open.glb`. It is an alternative inspection pose
of the same B09 definition and five native roots. Both front leaves fold upward
inside the original body: centers `[±0.475,1.44,0.390]`, dimensions
`[0.925,0.07,1.13]` metres; panels and handles follow the fold. Original side
ports, supports, bounds, collision and mass remain unchanged. Selection requires
the Integrator's confirmed local inventory inspection/access projection. No
native door body, persistent opening state or independent door animation is
defined. Removing `body` removes all folded leaf detail; a variant switch must
never recreate an absent native part.

The original 22 asset entries, blends, GLBs, native snapshots and provenance are
retained byte-for-byte from Art commit
`e752cc7fce43a50b4bcb4800d9d27584b44b6a0e`. Manifest `generatorReceipts` identifies
their historical generator and the new correction generator separately. The
R6 guard now includes the exact seventh owner `fp02Catalog.ts` SHA and checks
catalog digest `fnv1a:f3a8c642` immediately after SSR, before snapshot writes.
The current library contains 23 alternatives, not 23 installed objects.

Use the existing installed dependencies. Reproduction against the pinned native
source bytes, with the delivered Art files retained, in the repository root:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -B art/factory/play-2026-10-12/build_assets.py --snapshot
PYTHONDONTWRITEBYTECODE=1 BLENDER_USER_RESOURCES=/tmp/hestia-play02-blender blender --background --threads 1 --python-exit-code 1 --python art/factory/play-2026-10-12/build_assets.py -- --build-blender
```

Only the new inspection derivative is regenerated for this correction:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -B art/factory/play-2026-10-12/build_assets.py --snapshot-storage-open
PYTHONDONTWRITEBYTECODE=1 BLENDER_USER_RESOURCES=/tmp/hestia-play02-blender blender --background --threads 1 --python-exit-code 1 --python art/factory/play-2026-10-12/build_assets.py -- --build-blender --only-new storage-open
```

`--only-new` rejects replacing any asset from the original 22-entry baseline.

Focused verification from `apps/weltraum-browser`:

```bash
PYTHONDONTWRITEBYTECODE=1 npm run test -- tests/unit/factory/playAssetDerivatives.test.ts tests/unit/factory/presentation.test.ts
```

Source guards reject changes to the frozen generator inputs. Regeneration from
a later source head requires an explicit new source/art contract. The generator
does not change dependencies, the native catalog, existing source scenes,
physics, save data or shared runtime files. New GLBs use the local public
directory's LFS attributes; `.blend` already uses the global LFS rule.
The actual original license is copied byte-for-byte from the accepted power kit.
