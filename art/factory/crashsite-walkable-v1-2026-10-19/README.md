# Hestia crash hull — walkable V1 authoring candidate

This is a closed, non-admitted derivative of the existing `crashsite-hybrid-v2`
voxel authoring. It preserves the original main contour, bounds, six-material
palette, eight semantic parts, two idle turrets, remaining equipment and four
empty visual storage cases. The new source declares a full-width ramp-to-bay
corridor and raises the visible side aperture and overhead details around it.

The model is art only. Its metadata keeps `worldAuthority: false`,
`collisionPolicy: "None"`, `gameplayAdmission: "NOT_ADMITTED"`, and
`flight: "PERMANENTLY_INOPERABLE"`. A passing static validator would prove
only the exported geometry; it would not prove terrain contact, Native
collision, gameplay admission, save compatibility, or visual acceptance.

The exact corridor, local/world mapping, floor profile, clear-volume evidence
and retained-case footprints are declared in `MODEL_SPEC.json` before any
authoring cells were changed. The source validator reads actual GLB bytes and
checks the corridor against decoded triangles. Terrain contact outside the
GLB remains a separately reported runtime gate.

Once the prepared source has been reviewed, the Root integrator may generate
and validate this derivative using the installed project tools:

```powershell
blender -b -t 2 --python E:/DEV/Weltraum-Spiel/FP06-Candidate/art/factory/crashsite-walkable-v1-2026-10-19/build_crashsite.py
python E:/DEV/Weltraum-Spiel/FP06-Candidate/art/factory/crashsite-walkable-v1-2026-10-19/validate_asset.py
```

Root ran the export and validator. All six views and the hash-bound authoring
roster are complete; `WALKABILITY_VALIDATION.json` is PASS on 21 October 2026:
875 mm width, 2125 mm headroom, 26 segments and 1400 supported floor cells.
`RUNTIME_CENSUS.json` binds the actual GLB SHA and raw Render/Native costs.
The first validator log remains preserved: its old uncompressed Blender-header
assumption rejected the genuine Blender 5.2 Zstandard source. The final check
uses the installed Node standard decoder with a 16 MiB output bound and 5 s
timeout; no dependency was installed. This authoring check adds Node with
`node:zlib.zstdDecompressSync` to the Python validator's requirements.

This static result does not assert Native/world contact or gameplay admission.
The original V2 files
under `art/factory/crashsite-hybrid-v2/` remain unchanged and are the
read-only authoring/provenance base. License and Required Notice are retained
verbatim in `LICENSE`.
