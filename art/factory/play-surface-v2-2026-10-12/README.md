# PLAY-02 Surface V2: Cutter and Former

This is the bounded render repair for the measured positive-area different-material
coplanarity in the real Cutter and Former GLBs. It derives exactly two new assets,
`play_cutter_v2` and `play_former_v2`, from the delivered Blender 4.3.2 sources.
The original 23 V1 entries, native scenes, products, generator and manifest remain
byte-identical. The existing graphite, grey, petrol and amber palette remains exact.
Physics, dimensions, source boxes, ports, supports, part IDs, BOM, manufacturing
grid, terrain grid, animation ownership, saves and gameplay authority remain in
the original native/runtime owners. GLB is only a derived presentation.

## ExecPlan

1. Read the exact18-path Art grant and existing native source/provenance. PASS.
2. Author an independent binary GLB triangle-clipping test. PASS.
3. Run a real Blender passthrough save/reopen/export and observe the geometry RED. PASS: actual expected failure.
4. Apply the bounded cuboid surface recess, then rerun the entire gate. PASS: 9 tests.
5. Commit only the18 new granted paths; Integrator independently reviews/adopts.

The test decodes binary position/index accessors, tests whole-asset projected
triangle intersections including both normal orientations, and rejects any
positive-area overlap between different materials at an equal plane. It also
checks every position against its original per-part box union, exact part/node
identity and neutral transforms, unchanged materials, native owner/snapshot
byte hashes, sealed exporter reports and retention of all23 original LFS seals.
The latter check explicitly distinguishes hydrated payload verification from
unchanged pointer verification for unhydrated V1 files.

The Integrator granted an exclusive CPU lease; all actual Blender/test jobs ran serially with one Blender thread.
The Game Development Studio asset-production workflow is applied with the
existing installed project exporter as the explicitly authorized local fallback;
`game-dev` CLI is unavailable. No provider, installation or remote download occurs.
DevToolbox is not authorized for this isolated Art write-set; the exact grant,
source seals, test sequence, actual exporter reports and independent review are
the equivalent scoped admission checks.

## Commands

From the repository root, after receiving the serial CPU lease:

```bash
PYTHONDONTWRITEBYTECODE=1 /usr/bin/blender --background --factory-startup --threads 1 --python-exit-code 1 --python art/factory/play-surface-v2-2026-10-12/build_surface_v2.py -- --assets cutter-v2 former-v2
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s art/factory/play-surface-v2-2026-10-12/tests -p test_surface_v2.py
```

The wrapper opens the two actual V1 `.blend` files and exports only the two new
paths, through the existing `export_hestia_glb` exporter. It imports only the
original source-binding/bounds helpers and never invokes the old global snapshot,
source-freeze, Blender-build or manifest-writing flows. Source witnesses remain
in the non-exported native-reference collection.

## Actual gate results — 2026-10-12 UTC

| Run | Actual result | Command elapsed | Raw-log SHA256 |
| --- | --- | ---: | --- |
| 01: Blender passthrough | PASS: both real sources saved, reopened, exported | 1.864 s | `e11fada7df84f2643235d5d9ff4a9bf21495cef7f71dda9d4f66aad6768fdad9` |
| 02: Independent passthrough test | Expected RED: 8 tests, 2 geometry subtest failures; all remaining gates pass | 0.319 s | `8b9dd1fb9e1e774816244bd2cda10e7de0a58e58ad36c7472e89a001b9977c68` |
| 03: Corrected Blender | PASS: both corrected native sources saved, reopened, exported | 1.875 s | `b8200e07e086d815abd72276130fab649a5713f91a353eba7a6171c0d7bea261` |
| 04: Full scoped asset tests | PASS: 9 tests, 0 failures | 0.366 s | `3ef023aca9fca57acf5aec365a70f70cf94e45292756517d4fa4b58188cac783` |

The RED detects 267 Cutter and 199 Former positive triangle-pair overlaps.
The final whole-asset gate detects zero for both GLBs, including different-part
and opposite-facing pairs. Those pair counts are intersections, not a count of
unique patches or a union area. The actual V1 known-defect control remains RED
by observation in its positive assertion: it continues to find the unchanged
original service/chamber defects.

The correction changes 71 Cutter / 48 Former cuboid faces and 234 / 188 vertices.
Only a face with positive coplanar overlap is recessed, once, after all conflicts
are classified against the original geometry. Priority from low to high is
STRUCT, SHELL, FUNCTION, HAZARD, PV. Its distinct recess depths are 0.5, 0.375,
0.25, 0.125 and 0 mm. Connected cuboid vertices move with each affected bound;
no face is removed, no loose vertex is added and no mesh is opened. Maximum
combined authored vertex displacement is 0.866026 mm for Cutter and 0.707107 mm
for Former. The independent binary test additionally verifies <=1 mm distance
to original vertices, the same triangle/material inventory, and that every
exported position is referenced and inside its original part's box union.

| Product | Bytes | SHA256 |
| --- | ---: | --- |
| Cutter V2 GLB | 61360 | `4f0885139b19835cc985ab9e4fb2b9c5c8d4d430a21011f0e0c03805d6821eb4` |
| Former V2 GLB | 63764 | `2ea1dca9b5f1915ce984762cefded3b00063c6675ae4b62f02b51d63f308ba81` |
| Cutter V2 Blender | 717812 | `6e2ba489abd053b0e7654c9e2eaf6f97037408474d45fff3dc39323ab93040f8` |
| Former V2 Blender | 727316 | `2ac344e492d73145f0b11f17e22854d5fda2e44ab45283de9ea7be0c5a7fe78c` |
| Separate two-entry manifest | 9721 | `cb1ceaf9b05b738418ebaff95104efad61fea93eac0c8009bc271f23f000d2b9` |

Actual command receipts, before-command source bindings and complete raw logs
are in the granted external evidence directory:
[/workspace/.cloud-setup/fp06-play-surface-v2-evidence](/workspace/.cloud-setup/fp06-play-surface-v2-evidence).
The exact pre-fix passthrough script was recovered by removing only the repair
function/call; its bytes reproduce run01's `c025d3fc...406d0401` source SHA and are
preserved there. This is a hash-verified source recovery, not a rerun claim.
The Blender exporter prints its existing optional Draco-library error; Draco
compression is unused, both uncompressed exports and sealed reports succeed,
and no dependency was installed.

- Static geometry/source/native-file gates: PASS as bounded above.
- Independent source/binary review: PENDING_INTEGRATOR.
- Browser/runtime integration and browser regressions: NOT_RUN here; Integrator scope.
- New browser images and human visual acceptance: OWNER_REVIEW_PENDING.
- Full gameplay, save/recovery, performance and asset-to-voxel acceptance: NOT_RUN here.

On any changed V1/native/exporter seal, export stops before source admission.
Rollback removes only these versioned derivatives; original products remain intact.
