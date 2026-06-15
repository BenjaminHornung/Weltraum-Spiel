# Test Protocol: Clean-Core Refactor Docs/Spec Setup

Date: 2026-06-15

## Scope

This was a docs/spec setup task only. No runtime refactor, autopilot
implementation, Unity scene, prefab, asset or Prototype script change was made.

## Files Added

Repo rules:

- `AGENTS.md`
- `.agent/PLANS.md`

Architecture docs:

- `docs/architecture/README.md`
- `docs/architecture/clean-core-refactor-overview.md`
- `docs/architecture/clean-core-runtime-architecture.md`
- `docs/architecture/autopilot-v2-design.md`
- `docs/architecture/autopilot-v2-test-harness.md`
- `docs/architecture/scene-management-v1.md`

UX docs:

- `docs/ux/player-ui-redesign-foundation-v1.md`

AI docs and prompts:

- `docs/ai/README.md`
- `docs/ai/agent-workflow-v1.md`
- `docs/ai/prompts/codex_autopilot_test_range_agent.md`
- `docs/ai/prompts/codex_autopilot_v2_agent.md`
- `docs/ai/prompts/codex_project_structure_agent.md`
- `docs/ai/prompts/codex_spec_cleanup_agent.md`
- `docs/ai/prompts/codex_ui_redesign_agent.md`

Roadmap docs:

- `docs/roadmap/README.md`
- `docs/roadmap/milestones.md`
- `docs/roadmap/spec-sorting-backlog.md`

## Spec Changes Added

- `.devtoolbox/specs/changes/clean-core-runtime-architecture-v1/`
  - `proposal.md`
  - `design.md`
  - `tasks.md`
  - `specs/clean-core-runtime-architecture/spec.md`
  - `tests/test-protocol.md`
- `.devtoolbox/specs/changes/autopilot-v2-core-planner-executor-v1/`
  - `proposal.md`
  - `design.md`
  - `tasks.md`
  - `specs/autopilot-v2-core-planner-executor/spec.md`
- `.devtoolbox/specs/changes/player-ui-redesign-foundation-v1/`
  - `proposal.md`
  - `design.md`
  - `tasks.md`
  - `specs/player-ui-redesign-foundation/spec.md`

## Validation

DevToolbox MCP `specs_validate` was not available in the current tool session:
tool discovery for `specs_validate` returned no callable tool.

Fallback checks attempted:

- `npx --yes openspec validate --change "clean-core-runtime-architecture-v1" --json --no-interactive`
  - Result: failed because this OpenSpec version does not support `--change`
    and suggested `--changes`.
- `npx --yes openspec validate --changes "<change-id>" --json --no-interactive`
  - Result for all three changes: command exited 0 but returned 0 items, so it
    was not accepted as useful validation evidence.
- `npx --yes openspec validate <change-id> --type change --json --no-interactive`
  - Result for all three changes: command found an item but reported no deltas.
    This appears not to be the requested DevToolbox `specs_validate` flow.
- `npx --yes openspec change list --json`
  - Result: failed in the sandbox with npm `EACCES` while trying to reach
    `https://registry.npmjs.org/openspec`.
  - Unsandboxed retry was requested and rejected by the approval reviewer due
    the risk of executing third-party npm code with full repo access.

## Runtime/Asset Scope Check

Command:

```text
git status --short -- Assets ProjectSettings Packages
```

Result: no output.

Command:

```text
git diff --name-only
```

Result: no output, because all created files are currently untracked additions.

Command:

```text
git status --short
```

Result: only untracked docs/spec/rules additions plus the untracked source
package directory `weltraum_refactor_strategy_package/`.

Conclusion: no tracked runtime code, Unity scene, prefab, package, project
setting, asset or `Assets/Scripts/Prototype` file was modified.
