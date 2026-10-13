# Hestia crashsite hybrid v1 — native asset candidate

Owner-approved source: `art/factory/visual-reference/2026-10-13/crashsite/03-hybrid-revision.png`. This is an original Blender build of the enlarged, damaged lander with a side loading bay and two idle rooftop multi-barrel turrets. It is a first model iteration, visibly cleaner and less weathered than the concept.

Open `crashsite-hybrid-v1.blend` in Blender 4.3.2. Asset meshes are under the asset collection; the camera, lighting and ground belong to `PREVIEW_NOT_ASSET` and are excluded from the GLB. Rebuild from this directory:

```bash
blender -b -t 1 --python build_crashsite.py
```

This exact local authoring command ran successfully and generated the source, GLB, three 1440 × 900 CPU Cycles previews and `AUTHORING_REPORT.json`. Denoising is deliberately off because this Blender build lacks OpenImageDenoise. No external paid provider was used. The Game Development Studio CLI was unavailable; Blender, independent GLB inspection, source reopening and actual Three.js browser import provide the recorded checks.

The asset uses a 125 mm **art** lattice, six flat materials, eight semantic parts, 8,416 vertices and 4,208 exported triangles. GLB bounds are 14.75 × 4.75 × 6.5 m in Y-up coordinates. GLTFLoader produces 29 material primitives/draw calls in the detached review scene; eight source parts do not imply eight draws.

The public candidate payload is copied into the ordinary Vite build under `/factory/crashsite-hybrid-v1/`. It is **NOT_ADMITTED** by the closed gameplay asset loader. There is no new collider, World authority, cargo, ammunition, animation or working defense. The starter ship remains permanently inoperable. Existing wreck-cargo modules remain unchanged.

Native hull placement, support, obstacle/LOS checks, heavy cargo pickup/depot/player exit, budgets and combined save need a separate concrete integration contract and evidence before the model can replace the current technical cargo-access segment. The visual reference approval does not approve new terrain or native geometry. Final visual judgement: **OWNER_REVIEW_PENDING**.

Original project source and model: `LicenseRef-PolyForm-Noncommercial-1.0.0`, see repository `LICENSE`. The selected generated reference is design input, not runtime evidence. `SHA256SUMS.txt` covers all source/runtime/preview files present when sealed.
