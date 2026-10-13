# Independent read-only review

Reviewer: `/root/wreck_v2_readonly_review`. No edits, installations or commits.
Reviewed the approved reference, V1, final source/specification, actual GLB
bytes, source/public/dist identity, six final Blender views and the paired
Three.js import. The final authoring report matches every render/output hash.
The first pass was explicitly excluded from the final visual verdict.

**Technical export: PASS. Visual: OWNER_REVIEW_PENDING.**

19,552 triangles, 34 material primitives, six materials, eight semantic
parts, exactly two turrets and 15.125 m extent. Source/public/dist GLB hashes
match; V1's complete checksum manifest also passes. No blocking static/source
defect was found. The tracked diff from the continuation base contains only
two exact V2 LFS patterns; the new files are within the declared art scope.

V2 improves hull volume, bay depth, exposed aft propulsion and hollow barrel
clusters. Remaining reference drift:

- The canopy still reads as parallel stair/slats rather than broad framed
  glazing, particularly in view 05.
- Regular armor panels, the pristine ramp and clean fin/gun casings soften
  the reference's heavily fractured wreck appearance.
- Even, upright landing supports keep the hull elevated; the reference's
  grounded collapse remains weak.

These are model-shape differences, independent of the coastal scene and
lighting in the reference. Technical validity does not establish aesthetic
approval. Authoring comments were corrected to describe the added cooling
fins and palette wear accurately, separately from actual cut geometry.

**NOT_ADMITTED:** no live wreck, colliders, World state or inventory was
replaced. Turrets and magazine casings remain static visual intent; working
defense and finite ammunition remain future behavior.
