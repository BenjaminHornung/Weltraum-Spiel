# Prompt: Autopilot TestRange Agent

Goal:
Create a Unity PlayMode/MCP-testable Autopilot V2 TestRange scene and evidence
recorder.

Context:
- Read AGENTS.md.
- Read 03_autopilot_test_harness.md.
- Inspect existing `PrototypeAutopilotProvingGroundPlayModeTests`.
- Inspect current `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1`
  evidence format.

Constraints:
- Scene logic must be reusable and data-driven.
- No business logic hidden only in scene.
- Evidence must be written on failure too.
- Do not remove the legacy harness.

Tasks:
1. Add `Assets/_Weltraum/Scenes/TestRanges/AutopilotTestRange.unity`.
2. Add ScenarioCatalog ScriptableObject or JSON-driven catalog.
3. Add TestHarnessRunner.
4. Add EvidenceRecorder JSON/CSV/Markdown.
5. Add Gizmo/Telemetry overlay.
6. Add PlayMode tests with categories `AutopilotV2` and `AutopilotTestRange`.
7. Add scene manifest.
8. Run focused PlayMode tests and capture evidence.

Done when:
- Headless PlayMode test generates summary JSON and Markdown protocol.
- Interactive scene clearly shows route, obstacle, target envelope and status.
