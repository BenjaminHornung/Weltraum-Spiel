# Proposal: Voxel Meshing, Destruction, and Asset Audit v1

## Why

Weltraum-Spiel needs a source-backed decision for terrain, caves, microvoxels,
hard structures, authored GLB assets, persistent destruction, LOD, and later
mass-property calculation. Existing product documents do not yet define one
shared representation or meshing pipeline for these requirements.

## Scope

- Audit the named repositories, papers, specifications, demos, and authoring
  tools at exact revisions where applicable.
- Compare voxel representations, meshers, LOD seams, incremental rebuilds,
  collision/navigation projections, and destruction stages.
- Design and score an offline GLB/glTF-to-voxel asset compiler contract.
- Produce one research document with traceable evidence classes, limitations,
  license risks, a golden corpus, and no more than four follow-up spikes.

## Deliverables

- `docs/research/voxel-meshing-destruction-asset-audit-v1.md`
- This change's proposal, design, default spec, tasks, and test protocol.

## Non-goals

- No runtime, package, asset, scene, application, test, evidence, binary, image,
  roadmap, or existing architecture/concept-document changes.
- No integration or copying of external source, assets, binaries, captures, or
  lockfiles into Weltraum-Spiel.
- No claim that a visible demo proves an internal architecture.

## Success

The document answers the main architecture question, contains every requested
matrix and section, records repository provenance and licenses, distinguishes
claim classes, resolves the rabbit-hole entry, limits future spikes to four,
and passes repository allowlist and Markdown-oriented verification.
