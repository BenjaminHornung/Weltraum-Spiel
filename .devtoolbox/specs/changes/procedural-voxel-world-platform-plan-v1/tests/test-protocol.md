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
| Final `origin/main` alignment | PASS | The post-cleanup `origin/main` at `051239d9dbb7761c74a52ac8b65743343ec43f18` was merged without conflicts as `dd0a49b43990b3ad8bf9498c627192fdac36d524`; no rebase or force-push was used for the public PR. |
| Target-document content | PASS | All requested Research, Spielkonzept, Architecture and Adoption Matrix documents exist; all mandatory product and architecture directions are represented. |
| Relative links | PASS | 132 relative Markdown links across the changed files resolve; 0 are broken. |
| Adoption Matrix | PASS | All 27 required references plus six additional references with independent Audit verdicts occur exactly once with one of the six allowed categories; README claims remain distinct from code and observed-demo Evidence. |
| Work-package IDs and statuses | PASS | 292 package IDs are unique; all 19 requested packages are present, all statuses are valid and none of the new packages is `DONE` or `FOUNDATION`. Twenty-two pre-existing Celestial/Gravity-, Combat-, Persistence/Universe-Time/Event-, Ship-Builder-Stats/Readiness- and Graphics-Settings-Pakete are reconciled to current Mainline Evidence. |
| Docs-only allowlist | PASS | 41 changed files are Markdown below `docs/` or one of five allowlisted DevToolbox change directories (four Research changes plus this planning change); 0 Package, Runtime Source, test-code, image, binary or capture files are present. |
| `git diff --check` | PASS | The complete branch diff against `origin/main` has no whitespace errors. |
| Independent Docs Review | PASS | Both pre-cleanup findings were corrected. After the repository cleanup, the GitHub Codex review identified stale Persistence/Universe-Time/Event statements; an additional read-only audit also found stale Ship-Builder-Stats/Readiness and Graphics-Settings statuses. The evidence-backed reconciliation was independently re-reviewed with no remaining High/Medium findings. A fresh exact-head GitHub review remains a PR merge gate. |
| DevToolbox prepare/status/validate/load/execution | BLOCKED | `workspace_prepare_for_agent`, status, validation, task load and execution creation reject the isolated worktree as `unauthorized_path`; no override used. |
| DevToolbox `verify_run` | NOT RUN | No execution ID can be created while the root guard rejects the worktree, so verification cannot be attached to a DevToolbox execution. |
| Runtime build/tests | NOT APPLICABLE | The authorized scope contains no Runtime, package, Source, test, asset or Scene changes. |
| DevToolbox completion preflight | BLOCKED | `tasks_completion_preflight` rejected the absolute tasks path as `unauthorized_path`; no override was used and `tasks_toggle` remains uncalled. |

## Prohibited Evidence

No Binary Captures, screenshots, images, external Source files, copied license
texts or generated Runtime artifacts may be committed by this change.
