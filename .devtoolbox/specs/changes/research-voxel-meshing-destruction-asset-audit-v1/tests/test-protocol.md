# Test Protocol: Voxel Meshing, Destruction, and Asset Audit v1

## Scope

This is documentation-only verification. Runtime builds and Unity tests are not
applicable because no source, package, scene, asset, or test file may change.

## Planned checks

1. Confirm branch and base SHA.
2. Confirm every required project/source and requested result section appears.
3. Confirm every external repository has provenance, license path, status fields,
   limitations, scores, risks, and verdict.
4. Confirm claim labels use only the six allowed classes.
5. Confirm no more than four later spikes.
6. Run `git diff --check`.
7. Compare all changed paths against the two-path allowlist.
8. Confirm no screenshot or external artifact is tracked.

## DevToolbox status

`specs_create_change`, `workspace_prepare_for_agent`, `specs_get_status`,
`specs_validate`, `tasks_load`, `execution_create`, and
`tasks_completion_preflight` were attempted against the isolated worktree.
Every call returned non-retryable `unauthorized_path` because the MCP server
workspace guard permits only the original repository root.

The blocking completion preflight was not bypassed. `tasks_toggle` was not
called, so the checkboxes remain open. `execution_add_notes` was not callable
because `execution_create` produced no execution ID. The original dirty
worktree was not modified. This change is therefore maintained manually in the
isolated worktree and verified with the available non-bypassing checks.

## Results

Fresh verification on 2026-07-13:

| Check | Result | Evidence |
| --- | --- | --- |
| Branch/base | PASS | branch `research/voxel-meshing-destruction-asset-audit-v1`; HEAD, `origin/main`, and merge-base all `c780656c29ff4e5794be9ba58d6b78396a5826d5` before the research commit |
| Required content | PASS | scripted scan found all 52 project/source/result/field tokens |
| Later spikes | PASS | section 19 contains exactly four numbered spike entries |
| Evidence-label shape | PASS | no combined slash-labels; only the six documented classes are used as evidence tags |
| Marketing terms | PASS | no unqualified `seamless`, `infinite`, `production ready`, `real-time`, or `fully destructible` occurrence |
| Path allowlist | PASS | exactly six files: the research document plus five required files in this change directory |
| External artifacts | PASS | no image, capture, GLB/glTF/VOX, binary, archive, or lockfile appears in changed paths |
| Runtime build/tests | NOT APPLICABLE | documentation-only change; runtime, package, asset, scene, and test paths are forbidden |
| DevToolbox validation/task closure | BLOCKED | non-retryable `unauthorized_path` for the isolated `C:\\tmp` worktree; preflight not bypassed and tasks not toggled |
| `git diff --check` | PASS | `git diff --check` and `git diff --cached --check` both exited 0 after the final whitespace correction |
