# Test Protocol

## Change

`procedural-voxel-world-platform-plan-v1`

## Scope

Docs-only consolidation of four Research audits into the binding planning base
for Hestia, procedural Microvoxels, authored hotspots, planet streaming,
destruction, asset compilation, world persistence, Birth Clusters, renderer
boundaries and WebGL performance Evidence.

## Verification Results

| Check | Status | Evidence |
| --- | --- | --- |
| `git fetch --all --prune` | PASS | Completed before branch inspection; repository fetch refspec covers `main`, so the four named Research refs were additionally fetched explicitly. |
| Research remote SHAs | PASS | Remote refs match `a8973415`, `02a86ada`, `eacf46f3` and `eebe79a3`. |
| Research allowlists | PASS | Each branch has one commit from `c780656c` and exactly one Research document plus five Markdown DevToolbox artifacts. |
| Isolated worktree | PASS WITH CAVEAT | Branch starts at `origin/main` `c780656c29ff4e5794be9ba58d6b78396a5826d5`; checkout used LFS-smudge skip because an unrelated historical LFS object is missing server-side. |
| Research cherry-picks | PASS | All four checked commits were applied individually without conflicts. |
| DevToolbox `workspace_prepare_for_agent` | BLOCKED | Worktree rejected by the configured root guard as `unauthorized_path`; no override used. |
| Target-document content | NOT RUN | Pending documentation synthesis. |
| Relative links | NOT RUN | Pending final link check. |
| Work-package IDs and statuses | NOT RUN | Pending Master Plan update and uniqueness check. |
| Docs-only allowlist | NOT RUN | Pending final diff. |
| `git diff --check` | NOT RUN | Pending final diff. |
| Runtime build/tests | NOT APPLICABLE | The authorized scope contains no Runtime, package, Source, test, asset or Scene changes. |
| DevToolbox completion preflight | NOT RUN | Must run after final Evidence; no override permitted. |

## Prohibited Evidence

No Binary Captures, screenshots, images, external Source files, copied license
texts or generated Runtime artifacts may be committed by this change.
