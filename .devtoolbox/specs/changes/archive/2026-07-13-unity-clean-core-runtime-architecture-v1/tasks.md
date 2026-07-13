# Tasks: Clean-Core Runtime Architecture v1

## Phase 0: Planning Scaffold

- [x] Import clean-core strategy documents into `docs/architecture`, `docs/ux`,
  `docs/ai` and `docs/roadmap`.
- [x] Add repo-level `AGENTS.md`.
- [x] Add `.agent/PLANS.md`.
- [x] Create DevToolbox proposal, design, tasks and spec scaffold.
- [x] Record setup evidence in `tests/test-protocol.md`.

## Phase 1: Runtime Skeleton Later

- [x] Create the `Assets/_Weltraum` folder skeleton in a dedicated runtime
  implementation change.
- [x] Add assembly definitions and namespace rules in a dedicated runtime
  implementation change.
- [x] Add compile/build verification for the new assemblies.

## Phase 2: Legacy Boundary Later

- [ ] Document allowed adapter points from Prototype to Clean Core.
- [ ] Add tests or static checks that prevent accidental dependency inversion.
- [ ] Keep `Assets/Scripts/Prototype` unchanged unless a later task explicitly
  authorizes a targeted adapter or fix.

## Phase 3: Scene Manifest Later

- [ ] Create a scene manifest template.
- [ ] Apply the manifest to new Clean-Core scenes only after a scene-specific
  implementation task exists.
- [ ] Verify scene validation and screenshot evidence for any future scene work.
