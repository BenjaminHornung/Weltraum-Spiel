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
| Isolated worktree | PASS WITH CAVEAT | The worktree started from the Research base `c780656c29ff4e5794be9ba58d6b78396a5826d5`; checkout used LFS-smudge skip because an unrelated historical LFS object is missing server-side. |
| Research cherry-picks | PASS | All four checked commits were applied individually without conflicts. |
| Final `origin/main` alignment | PASS | The branch was rebased without conflicts onto `ea4ccbadfa8c91787e4b4451e04b1fb4ad18a12f`; immediately before this Evidence commit it was 10 commits ahead and 0 behind. |
| Target-document content | PASS | All requested Research, Spielkonzept, Architecture and Adoption Matrix documents exist; all mandatory product and architecture directions are represented. |
| Relative links | PASS | 125 relative Markdown links across the changed files resolve; 0 are broken. |
| Adoption Matrix | PASS | All 27 required references occur exactly once with one of the six allowed verdicts; README claims remain distinct from code and observed-demo Evidence. |
| Work-package IDs and statuses | PASS | 292 package IDs are unique; all 19 requested packages are present, all statuses are valid and none of the new packages is `DONE` or `FOUNDATION`. |
| Docs-only allowlist | PASS | 41 changed files are Markdown below `docs/` or one of five allowlisted DevToolbox change directories (four Research changes plus this planning change); 0 Package, Runtime Source, test-code, image, binary or capture files are present. |
| `git diff --check` | PASS | The complete branch diff against `origin/main` has no whitespace errors. |
| Independent Docs Review | PASS | Both findings were corrected: stale Main/Evidence metadata was refreshed and the GLB observation was narrowed to visible viewport plus HTTP 200 without claiming parse, binding, compiler, semantics or determinism. Residual review risk is low. |
| DevToolbox prepare/status/validate/load/execution | BLOCKED | `workspace_prepare_for_agent`, status, validation, task load and execution creation reject the isolated worktree as `unauthorized_path`; no override used. |
| DevToolbox `verify_run` | NOT RUN | No execution ID can be created while the root guard rejects the worktree, so verification cannot be attached to a DevToolbox execution. |
| Runtime build/tests | NOT APPLICABLE | The authorized scope contains no Runtime, package, Source, test, asset or Scene changes. |
| DevToolbox completion preflight | BLOCKED | `tasks_completion_preflight` rejected the absolute tasks path as `unauthorized_path`; no override was used and `tasks_toggle` remains uncalled. |

## Prohibited Evidence

No Binary Captures, screenshots, images, external Source files, copied license
texts or generated Runtime artifacts may be committed by this change.
