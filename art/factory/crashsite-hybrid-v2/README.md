# Hestia wreck — V2 art candidate

An actual Blender model and GLB, following the approved hybrid reference and
the owner's critique of the first model. The source is original deterministic
125 mm body voxel authoring with 62.5 mm local barrel/chip detail. Geometry carries the detail; there are no textures,
smooth normals, per-voxel objects, external models or paid generation jobs.

The full transport shell now wraps around a rounded stepped cross-section.
An inclined enclosed canopy, separated cream armor panels, exposed dark ribs,
a recessed side loading bay, long loading ramp, grounded landing supports and
broken circular propulsion assemblies replace V1's rectangular frame. Two
idle roof Gatlings have distinct pedestals, armored receivers, barrel clusters
and enclosed magazine casings. Casings are visual objects, not free cargo or
ammunition. The ship remains permanently unable to fly.

Rebuild from this directory with installed Blender 4.3.2 and Python 3:

```bash
blender -b -t 2 --python build_crashsite.py
python3 validate_asset.py
```

Rendering uses CPU Cycles, two threads, six 1440×900 views. The named preview
floor, lights and camera remain in `.blend` for inspection but are excluded
from GLB. GLB has eight stable semantic parts, six materials, and is Y-up in
metres. The grid is an art specification; it does not change the separate
250 mm building grid or authoritative HVP terrain.

`STATIC_VALIDATION.json` inspects real bytes: bounds, triangle/draw budgets,
finite positions, exact lattice, outward hard normals, node transforms,
absence of textures/animations/cameras, two turret parts and authority flags.
This does not prove visual approval or native gameplay access.

**OWNER_REVIEW_PENDING / NOT_ADMITTED.** The candidate is included in public
build output for inspection. The closed gameplay loader, wreck owner, cargo,
physics, terrain, inventory and save contracts are unchanged. Native hull,
access, support and route gates are required before replacing the live wreck.

License: `LicenseRef-PolyForm-Noncommercial-1.0.0`, repository `LICENSE`.
