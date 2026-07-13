# Unity Legacy Reference

Unity is not an active product architecture on this branch. This directory
retains compact behavior intent, historical architecture, source evidence,
asset inventories and planning records that may inform browser work.

Use [`legacy-manifest.md`](legacy-manifest.md) for the immutable source archive,
recovery instructions and the known pre-existing LFS limitation. Any source
path beginning with `Assets/`, `Packages/` or `ProjectSettings/` resolves only
inside tag `unity-legacy-final-2026-07` or branch
`archive/unity-legacy-final-2026-07`.

Do not copy MonoBehaviour, scene wiring or Unity project structure into the
browser mainline. Preserve behavior contracts and acceptance intent instead.

Key retained workflow and flight references:

- [`agent-workflows/agent-workflow-v1.md`](agent-workflows/agent-workflow-v1.md)
- [`flight/physics-flight-model.md`](flight/physics-flight-model.md)
