# Prompt: Clean-Core Project Structure Agent

Goal:
Create the clean-core Unity project skeleton without migrating gameplay logic yet.

Context:
- Read AGENTS.md.
- Read docs/legacy-unity/current-prototype-state-2026-06-15.md.
- Read docs/design-audits/2026-06-14-planning-consistency-audit.md.
- Read this strategy package, especially 01_project_structure.md and
  05_scene_management.md.

Constraints:
- Do not delete or move existing Prototype files.
- Do not edit Autopilot runtime behavior.
- Do not change gameplay scenes except adding manifests if requested.
- Keep changes additive.

Tasks:
1. Create `Assets/_Weltraum` folder skeleton.
2. Add assembly definition files for Core, Simulation, Flight, Navigation, UI,
   Map, Tests and Editor.
3. Add placeholder README.md files in major folders explaining ownership.
4. Add Scene Manifest template.
5. Add or update root AGENTS.md and `.agent/PLANS.md`.
6. Run solution build if possible.
7. Record evidence under the active DevToolbox change.

Done when:
- Project compiles.
- Skeleton exists.
- Existing prototype remains playable.
- No runtime behavior changed.
